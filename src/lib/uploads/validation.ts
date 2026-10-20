import { UPLOAD_LIMITS } from "./limits";
import { ALLOWED_UPLOAD_MIME_TYPES } from "./constants";

export class MaterialBoundaryError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "INVALID_MATERIAL") { super(message); }
}
export const isResourceId = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const extensionTypes: Record<string, string> = {
  pdf: "application/pdf", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export function validateUploadMetadata(fileName: unknown, fileType: unknown, size: unknown) {
  if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 240 || /[\\/\u0000-\u001f\u007f]/.test(fileName)) {
    throw new MaterialBoundaryError("Use a valid file name of up to 240 characters.");
  }
  if (!Number.isSafeInteger(size) || (size as number) <= 0 || (size as number) > UPLOAD_LIMITS.fileBytes) {
    throw new MaterialBoundaryError("Files must be nonempty and no larger than 20 MiB.", 413, "FILE_TOO_LARGE");
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const expected = extensionTypes[extension];
  const declared = typeof fileType === "string" ? fileType.toLowerCase().split(";")[0].trim() : "";
  const mimeType = !declared || declared === "application/octet-stream" ? expected : declared === "image/jpg" ? "image/jpeg" : declared;
  if (!expected || mimeType !== expected || !ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as typeof ALLOWED_UPLOAD_MIME_TYPES[number])) {
    throw new MaterialBoundaryError("Supported files: PDF, DOCX, PPTX, TXT, PNG, JPEG and WEBP.", 415, "UNSUPPORTED_FILE");
  }
  return { fileName, mimeType, size: size as number };
}
export function validateUploadBuffer(buffer: Buffer, mimeType: string) {
  if (buffer.length === 0 || buffer.length > UPLOAD_LIMITS.fileBytes) throw new MaterialBoundaryError("File size exceeds the upload limit.", 413);
  const starts = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  let matches = false;
  if (mimeType === "application/pdf") matches = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  else if (mimeType.endsWith("document") || mimeType.endsWith("presentation")) matches = starts(0x50, 0x4b, 0x03, 0x04);
  else if (mimeType === "image/png") matches = starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  else if (mimeType === "image/jpeg") matches = starts(0xff, 0xd8, 0xff);
  else if (mimeType === "image/webp") matches = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  else if (mimeType === "text/plain") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      matches = !text.includes("\u0000") && !/^\s*(?:<!doctype\s+html|<html\b|<svg\b)/i.test(text);
    } catch { matches = false; }
  }
  if (!matches) throw new MaterialBoundaryError("File contents do not match the supported file type.", 415, "CONTENT_TYPE_MISMATCH");
}
export function assertOwnedStoragePath(path: unknown, userId: string, sessionId: string) {
  if (typeof path !== "string" || !path.startsWith(`${userId}/${sessionId}/`)
    || !/^[A-Za-z0-9._-]{1,320}$/.test(path.slice(userId.length + sessionId.length + 2))) {
    throw new MaterialBoundaryError("The uploaded file does not belong to this session.", 404, "NOT_FOUND");
  }
  return path;
}
export async function readBoundedBody(request: Pick<Request, "headers" | "body" | "signal">, limit = UPLOAD_LIMITS.requestBytes, timeoutMs = 30_000) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new MaterialBoundaryError("Request exceeds the upload limit.", 413, "BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new MaterialBoundaryError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new MaterialBoundaryError("The request body timed out.", 408, "BODY_TIMEOUT")); void reader.cancel().catch(() => {}); }, timeoutMs);
  });
  try {
    while (true) {
      if (request.signal.aborted) throw new MaterialBoundaryError("Upload was cancelled.", 400, "CANCELLED");
      const result = await Promise.race([reader.read(), deadline]);
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) throw new MaterialBoundaryError("Request exceeds the upload limit.", 413, "BODY_TOO_LARGE");
      chunks.push(result.value);
    }
  } catch (error) { void reader.cancel().catch(() => {}); throw error; }
  finally { clearTimeout(timer); reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
