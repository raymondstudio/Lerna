import { MAX_NOTE_BYTES, type NoteDraft } from "./note-save-controller";

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function noteDraftKey(userId: string, sessionId: string) { return `lerna.note-draft.v1:${userId}:${sessionId}`; }

export function readNoteDraft(storage: DraftStorage, key: string, now = Date.now()): NoteDraft | null {
  try {
    const value = storage.getItem(key);
    if (!value) return null;
    const draft: NoteDraft = JSON.parse(value);
    const valid = draft.version === 1 && typeof draft.content === "string" && typeof draft.baseContent === "string"
      && Number.isSafeInteger(draft.baseRevision) && draft.baseRevision >= 0
      && Number.isFinite(draft.savedAt) && draft.savedAt <= now && now - draft.savedAt < DRAFT_TTL_MS
      && new TextEncoder().encode(draft.content).byteLength <= MAX_NOTE_BYTES * 2;
    const operation = draft.operation;
    if (!valid || (operation && (typeof operation.notes !== "string" || typeof operation.operationId !== "string"
      || !/^[0-9a-f-]{36}$/i.test(operation.operationId) || !Number.isSafeInteger(operation.expectedNotesRevision)
      || operation.expectedNotesRevision < 0 || new TextEncoder().encode(operation.notes).byteLength > MAX_NOTE_BYTES))) {
      storage.removeItem(key);
      return null;
    }
    return draft;
  } catch { return null; }
}

export function writeNoteDraft(storage: DraftStorage, key: string, draft: NoteDraft | null): boolean {
  try {
    if (draft) storage.setItem(key, JSON.stringify(draft));
    else storage.removeItem(key);
    return true;
  } catch { return false; }
}
