import { NextResponse } from "next/server";
import { AuthApiError } from "@/lib/auth/require-active-user-api";
import { SessionApiError, assertSessionId } from "@/lib/repositories/study-sessions";
import { MAX_NOTE_BYTES } from "./note-save-controller";

export async function readSessionBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new SessionApiError(400, "INVALID_REQUEST", "A JSON object is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 650_000) { await reader.cancel(); throw new SessionApiError(413, "REQUEST_TOO_LARGE", "The request is too large."); }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new SessionApiError(400, "INVALID_REQUEST", "A valid JSON object is required."); }
}
export function boundedText(value: unknown, name: string, maximum: number, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > maximum) {
    throw new SessionApiError(400, "INVALID_REQUEST", `${name} must be ${allowEmpty ? "at most" : "between 1 and"} ${maximum} characters.`);
  }
  return value;
}
export function noteOperation(body: Record<string, unknown>) {
  if (typeof body.notes !== "string") throw new SessionApiError(400, "INVALID_NOTES", "Notes must be text.");
  if (new TextEncoder().encode(body.notes).byteLength > MAX_NOTE_BYTES) throw new SessionApiError(413, "NOTE_TOO_LARGE", "Notes must be at most 100,000 bytes.");
  if (body.expectedNotesRevision === undefined || body.operationId === undefined) throw new SessionApiError(428, "NOTES_PRECONDITION_REQUIRED", "Reload this page before saving notes. Your draft is kept.");
  if (!Number.isSafeInteger(body.expectedNotesRevision) || (body.expectedNotesRevision as number) < 0) throw new SessionApiError(400, "INVALID_REVISION", "A valid note revision is required.");
  assertSessionId(body.operationId);
  return { notes: body.notes, expectedNotesRevision: body.expectedNotesRevision as number, operationId: body.operationId };
}
export function sessionFailure(error: unknown, requestId: string) {
  const known = error instanceof SessionApiError || error instanceof AuthApiError;
  return NextResponse.json({ success: false, requestId, error: {
    code: known ? error.code : "SERVER_ERROR",
    message: known ? error.message : "The study session request could not be completed. Retry shortly.",
    ...(error instanceof SessionApiError && error.currentSession ? { currentSession: error.currentSession } : {}),
  } }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
export function boundedLimit(value: string | null, defaultValue: number, maximum = 200) {
  if (value === null) return defaultValue;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) throw new SessionApiError(400, "INVALID_LIMIT", `Limit must be between 1 and ${maximum}.`);
  return number;
}
