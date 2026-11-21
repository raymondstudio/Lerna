import { Worker } from "node:worker_threads";
import path from "node:path";
import { extractImageText } from "@/lib/gemini/client";
import { UPLOAD_LIMITS } from "@/lib/uploads/limits";
import { MaterialBoundaryError, validateUploadBuffer } from "@/lib/uploads/validation";
import type { ExtractedMaterialSegment } from "./types";

let activeParsers = 0;
export async function extractMaterialText(params: {
  buffer: Buffer; mimeType: string; fileName: string; userId?: string; signal?: AbortSignal; operationId?: string;
}): Promise<ExtractedMaterialSegment[]> {
  validateUploadBuffer(params.buffer, params.mimeType);
  if (activeParsers >= 2) throw new MaterialBoundaryError("Document processing is busy. Retry shortly.", 429, "PROCESSING_BUSY");
  if (params.signal?.aborted) throw new MaterialBoundaryError("Document processing was cancelled.", 400, "CANCELLED");
  activeParsers++;
  try {
    const result = await new Promise<ExtractedMaterialSegment[] | { image: true }>((resolve, reject) => {
      const worker = new Worker(path.join(process.cwd(), "src/lib/materials/parser-worker.cjs"), {
        workerData: { buffer: params.buffer, mimeType: params.mimeType, limits: UPLOAD_LIMITS, root: process.cwd() },
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      });
      let settled = false;
      const finish = (error?: Error, value?: ExtractedMaterialSegment[] | { image: true }) => {
        if (settled) return; settled = true; clearTimeout(timer); params.signal?.removeEventListener("abort", abort);
        void worker.terminate().then(() => { if (error) reject(error); else resolve(value!); }, () => reject(error ?? new Error("Document parser could not be stopped.")));
      };
      const abort = () => finish(new MaterialBoundaryError("Document processing was cancelled.", 400, "CANCELLED"));
      const timer = setTimeout(() => finish(new MaterialBoundaryError("Document parsing exceeded its time limit.", 422, "PARSER_TIMEOUT")), UPLOAD_LIMITS.parserMilliseconds);
      params.signal?.addEventListener("abort", abort, { once: true });
      worker.once("error", () => finish(new MaterialBoundaryError("Document parsing failed.", 422, "PARSER_FAILED")));
      worker.once("exit", () => { if (!settled) finish(new MaterialBoundaryError("Document parser stopped.", 422, "PARSER_FAILED")); });
      worker.once("message", (message) => {
        if (!message?.ok) finish(new MaterialBoundaryError("Document parsing failed or exceeded a supported limit.", 422, "PARSER_LIMIT"));
        else finish(undefined, message.result);
      });
    });
    let segments: ExtractedMaterialSegment[];
    if (Array.isArray(result)) segments = result;
    else {
      if (!params.userId) throw new MaterialBoundaryError("Verified identity is required for image extraction.", 401);
      const text = await extractImageText(params.buffer, params.mimeType, params.fileName, { userId: params.userId, signal: params.signal, operationId: params.operationId });
      segments = text.trim() ? [{ text: text.trim(), section: "Image extraction" }] : [];
    }
    if (segments.length > UPLOAD_LIMITS.pages || segments.reduce((total, segment) => total + segment.text.length, 0) > UPLOAD_LIMITS.textCharacters) {
      throw new MaterialBoundaryError("Extracted document text exceeds the processing limit.", 422, "TEXT_LIMIT");
    }
    return segments;
  } finally { activeParsers--; }
}
