import { generateEmbedding } from "@/lib/gemini/client";
import { UPLOADED_MATERIALS_BUCKET } from "@/lib/uploads/constants";
import { chunkMaterial, createSummary } from "./chunking";
import { indexMaterialInElastic } from "./elastic";
import { extractMaterialText } from "./extract";
import { MATERIAL_SELECT, type MaterialRow } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => any;
  };
};

async function updateMaterialStatus(
  supabase: SupabaseClientLike,
  materialId: string,
  userId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("uploaded_materials")
    .update(values)
    .eq("id", materialId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function fetchOwnedMaterial(
  supabase: SupabaseClientLike,
  materialId: string,
  userId: string
): Promise<MaterialRow | null> {
  const { data, error } = await supabase
    .from("uploaded_materials")
    .select(MATERIAL_SELECT)
    .eq("id", materialId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as MaterialRow | null;
}

export async function processMaterial(params: {
  supabase: SupabaseClientLike;
  materialId: string;
  userId: string;
}) {
  console.log(`[ingestion] Starting processMaterial for materialId="${params.materialId}"`);
  const material = await fetchOwnedMaterial(params.supabase, params.materialId, params.userId);

  if (!material) {
    console.error(`[ingestion] Material not found in database: materialId="${params.materialId}"`);
    throw new Error("Material not found.");
  }

  console.log(`[ingestion] Material metadata loaded: name="${material.file_name}", type="${material.file_type}", path="${material.storage_path}"`);

  await updateMaterialStatus(params.supabase, material.id, params.userId, {
    status: "processing",
    ocr_status: "processing",
    embedding_status: "processing",
    error_message: null,
  });

  try {
    console.log(`[ingestion] Downloading material from storage bucket "${UPLOADED_MATERIALS_BUCKET}"...`);
    const { data, error } = await params.supabase.storage.from(UPLOADED_MATERIALS_BUCKET).download(material.storage_path);

    if (error || !data) {
      console.error(`[ingestion] Download from storage failed:`, error);
      throw error ?? new Error("Unable to download uploaded material.");
    }
    console.log(`[ingestion] Download successful, file size = ${data.size} bytes`);

    console.log(`[ingestion] Extracting text content from material...`);
    const buffer = Buffer.from(await data.arrayBuffer());
    const segments = await extractMaterialText({
      buffer,
      mimeType: material.file_type,
      fileName: material.file_name,
    });
    console.log(`[ingestion] Extraction successful: extracted ${segments.length} text segments`);

    if (segments.length === 0) {
      console.error(`[ingestion] Extraction returned zero readable content segments`);
      throw new Error("No readable educational content was found in this material.");
    }

    const fullText = segments.map((segment) => segment.text).join("\n\n");
    console.log(`[ingestion] Creating document summary...`);
    const summary = createSummary(fullText);
    console.log(`[ingestion] Summary created (length = ${summary.length} chars)`);

    console.log(`[ingestion] Chunking document...`);
    const chunks = chunkMaterial({
      documentId: material.id,
      documentName: material.file_name,
      userId: material.user_id,
      sessionId: material.session_id,
      segments,
    });
    console.log(`[ingestion] Chunking successful: generated ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.error(`[ingestion] Chunking resulted in zero searchable chunks`);
      throw new Error("Unable to create searchable chunks from this material.");
    }

    console.log(`[ingestion] Generating embeddings for ${chunks.length} chunks via Gemini API...`);
    const chunksWithEmbeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[ingestion] [Chunk ${i + 1}/${chunks.length}] Generating embedding...`);
      const embedding = await generateEmbedding(chunk.text, "RETRIEVAL_DOCUMENT");
      chunksWithEmbeddings.push({
        ...chunk,
        embedding,
      });
    }
    console.log(`[ingestion] Embeddings generated successfully`);

    console.log(`[ingestion] Indexing document chunks in ElasticSearch...`);
    await indexMaterialInElastic({
      material,
      chunks: chunksWithEmbeddings,
      summary,
    });
    console.log(`[ingestion] ElasticSearch indexing completed successfully`);

    const processedAt = new Date().toISOString();
    console.log(`[ingestion] Marking material as ready in database...`);
    await updateMaterialStatus(params.supabase, material.id, params.userId, {
      status: "ready",
      ocr_status: "completed",
      embedding_status: "completed",
      error_message: null,
      processed_at: processedAt,
      chunk_count: chunks.length,
      summary,
      source_metadata: {
        extractionSegments: segments.length,
        embeddingModel: "gemini-embedding-001",
        embeddingDimensions: 768,
      },
    });
    console.log(`[ingestion] Ingestion pipeline finished successfully`);

    return {
      ...material,
      status: "ready" as const,
      error_message: null,
      processed_at: processedAt,
      chunk_count: chunks.length,
      summary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process this material.";
    console.error(`[ingestion] Ingestion pipeline failed: ${message}`, error);

    await updateMaterialStatus(params.supabase, material.id, params.userId, {
      status: "failed",
      ocr_status: "failed",
      embedding_status: "failed",
      error_message: message,
    });

    throw new Error(message);
  }
}
