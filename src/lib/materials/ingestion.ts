import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding, providerArtifactScope } from "@/lib/gemini/client";
import { processingArtifact, processingIdentity } from "./processing-artifacts";
import type { ExtractedMaterialSegment } from "./types";
import { chunkMaterial, createSummary } from "./chunking";
import { deleteMaterialFromElastic, indexMaterialInElastic } from "./elastic";
import { extractMaterialText } from "./extract";
import { UPLOAD_LIMITS } from "@/lib/uploads/limits";
import { MaterialBoundaryError, assertOwnedStoragePath, validateUploadMetadata, validateUploadBuffer } from "@/lib/uploads/validation";
import {
  fetchOwnedMaterial, requireOwnedMaterialSession, downloadOwnedUpload, claimMaterialProcessing,
  finishMaterialProcessing, queueMaterialIndexCleanup,
} from "@/lib/repositories/materials";

export { fetchOwnedMaterial } from "@/lib/repositories/materials";

export async function processMaterial(params: { supabase: SupabaseClient; materialId: string; userId: string; signal?: AbortSignal }) {
  const material = await fetchOwnedMaterial(params.supabase, params.materialId, params.userId);
  if (!material || !material.session_id) throw new MaterialBoundaryError("Material not found.", 404, "NOT_FOUND");
  await requireOwnedMaterialSession(params.supabase, material.session_id, params.userId);
  assertOwnedStoragePath(material.storage_path, params.userId, material.session_id);
  const claimId = crypto.randomUUID();
  const claim = await claimMaterialProcessing(params.supabase, material.id, claimId);
  if (claim === "ready") {
    const ready = await fetchOwnedMaterial(params.supabase, material.id, params.userId);
    if (!ready) throw new MaterialBoundaryError("Material not found.", 404, "NOT_FOUND");
    return ready;
  }
  if (claim === "busy") throw new MaterialBoundaryError("This document is already processing. Reload shortly.", 409, "PROCESSING_BUSY");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_LIMITS.processingMilliseconds);
  const abort = () => controller.abort();
  params.signal?.addEventListener("abort", abort, { once: true });
  if (params.signal?.aborted) controller.abort();
  try {
    const buffer = await downloadOwnedUpload(params.supabase, material.storage_path);
    const metadata = validateUploadMetadata(material.file_name, material.file_type, buffer.length);
    validateUploadBuffer(buffer, metadata.mimeType);
    const scope = providerArtifactScope();
    const extraction = processingIdentity({ materialId: material.id, userId: params.userId, scope: `${scope}:parser-v1:gemini-2.5-flash`, kind: "extraction", content: buffer });
    const segments = await processingArtifact({ materialId: material.id, claimId, key: extraction.key, kind: "extraction" },
      (value): value is ExtractedMaterialSegment[] => Array.isArray(value) && value.length <= UPLOAD_LIMITS.pages && value.every(segment => segment && typeof segment.text === "string") && value.reduce((sum, segment) => sum + segment.text.length, 0) <= UPLOAD_LIMITS.textCharacters,
      () => extractMaterialText({ buffer, mimeType: metadata.mimeType, fileName: material.file_name, userId: params.userId, signal: controller.signal, operationId: extraction.operationId }));
    if (!segments.length) throw new MaterialBoundaryError("No readable text was found in this document.", 422, "NO_READABLE_TEXT");
    const fullText = segments.map((segment) => segment.text).join("\n\n");
    if (fullText.length > UPLOAD_LIMITS.textCharacters) throw new MaterialBoundaryError("Extracted text exceeds the document limit.", 422, "TEXT_LIMIT");
    const summary = createSummary(fullText);
    const chunks = chunkMaterial({ documentId: material.id, documentName: material.file_name, userId: params.userId, sessionId: material.session_id, segments });
    if (!chunks.length || chunks.length > UPLOAD_LIMITS.chunks || chunks.some((chunk) => chunk.text.length > UPLOAD_LIMITS.chunkCharacters)) {
      throw new MaterialBoundaryError("Document exceeds the searchable text limit. Split it into smaller files.", 422, "CHUNK_LIMIT");
    }
    const embedded = [];
    for (const chunk of chunks) {
      if (controller.signal.aborted) throw new MaterialBoundaryError("Document processing exceeded its deadline.", 422, "PROCESSING_TIMEOUT");
      const identity = processingIdentity({ materialId: material.id, userId: params.userId, scope: `${scope}:gemini-embedding-001:768:RETRIEVAL_DOCUMENT`, kind: "embedding", content: chunk.text });
      const embedding = await processingArtifact({ materialId: material.id, claimId, key: identity.key, kind: "embedding" },
        (value): value is number[] => Array.isArray(value) && value.length === 768 && value.every(item => typeof item === "number" && Number.isFinite(item)),
        () => generateEmbedding(chunk.text, "RETRIEVAL_DOCUMENT", { userId: params.userId, signal: controller.signal, operationId: identity.operationId }));
      embedded.push({ ...chunk, embedding });
    }
    if (controller.signal.aborted) throw new MaterialBoundaryError("Document processing exceeded its deadline.", 422, "PROCESSING_TIMEOUT");
    const current = await fetchOwnedMaterial(params.supabase, material.id, params.userId);
    if (!current) throw new MaterialBoundaryError("Material is no longer available.", 409, "PROCESSING_CONFLICT");
    await indexMaterialInElastic({ material, chunks: embedded, summary, signal: controller.signal });
    const processedAt = new Date().toISOString();
    const values = { ocr_status: "completed", embedding_status: "completed", error_message: null, processed_at: processedAt,
      chunk_count: chunks.length, summary, source_metadata: { extractionSegments: segments.length, embeddingModel: "gemini-embedding-001", embeddingDimensions: 768 } };
    await finishMaterialProcessing(params.supabase, material.id, claimId, "ready", values);
    return { ...material, ...values, status: "ready" as const };
  } catch (error) {
    // SQL remains the visibility authority even while dependency cleanup is pending.
    let cleanupFailed = false;
    try { await deleteMaterialFromElastic(material.id, params.userId); } catch { cleanupFailed = true; }
    if (cleanupFailed) await queueMaterialIndexCleanup(params.supabase, material.id);
    try {
      await finishMaterialProcessing(params.supabase, material.id, claimId, "failed", {
        ocr_status: "failed", embedding_status: "failed", error_message: "Document processing failed. Retry or use a smaller supported file.",
      });
    } catch {
      // A concurrent delete/claim change must not be overwritten; retry cleanup durably.
      await queueMaterialIndexCleanup(params.supabase, material.id);
    }
    if (error instanceof MaterialBoundaryError) throw error;
    throw new MaterialBoundaryError("Document processing failed. Retry or use a smaller supported file.", 503, "PROCESS_FAILED");
  } finally { clearTimeout(timer); params.signal?.removeEventListener("abort", abort); }
}
