import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StudySessionRecord } from "@/lib/study-sessions/types";
import type { NoteOperation } from "@/lib/study-sessions/note-save-controller";
import type { ChatSource } from "@/lib/chat/types";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type PersistedStudySession = StudySessionRecord & { notesRevision: number; notesUpdatedAt?: string };
export const SESSION_COLUMNS = "id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes,notes_revision,notes_updated_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SessionApiError extends Error {
  constructor(public status: number, public code: string, message: string, public currentSession?: PersistedStudySession) { super(message); }
}
export function assertSessionId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !UUID.test(id)) throw new SessionApiError(400, "INVALID_ID", "A valid identifier is required.");
}

type MessageRow = { id: string; role: "user" | "assistant"; content: string; created_at: string; sources?: ChatSource[] | null };
type SessionRow = {
  id: string; title: string; created_at: string; updated_at: string;
  topic_category?: string | null; last_message?: string | null; course_id?: string | null;
  status?: "active" | "paused" | "completed" | null; duration_seconds?: number | null;
  topics_covered?: string[] | null; summary?: string | null; notes?: string | null;
  notes_revision?: number | string | null; notes_updated_at?: string | null; study_messages?: MessageRow[];
};
export function mapStudySessionRow(session: SessionRow): PersistedStudySession {
  return {
    id: session.id, title: session.title, topicCategory: session.topic_category ?? "General",
    lastMessage: session.last_message ?? "", createdAt: session.created_at, updatedAt: session.updated_at,
    courseId: session.course_id ?? undefined, status: session.status ?? "active",
    durationSeconds: session.duration_seconds ?? 0, topicsCovered: Array.isArray(session.topics_covered) ? session.topics_covered : [],
    summary: session.summary ?? undefined, notes: session.notes ?? "", notesRevision: Number(session.notes_revision ?? 0),
    notesUpdatedAt: session.notes_updated_at ?? undefined,
    messages: Array.isArray(session.study_messages) ? session.study_messages.map((message: MessageRow) => ({
      id: message.id, role: message.role, content: message.content, createdAt: message.created_at,
      sources: Array.isArray(message.sources) ? message.sources : [],
    })) : [],
  };
}

type Cursor = { at: string; id: string };
function cursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    if (value.length > 256) throw new Error();
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof decoded.at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(decoded.at) || !Number.isFinite(Date.parse(decoded.at))) throw new Error();
    assertSessionId(decoded.id);
    return { at: decoded.at, id: decoded.id };
  } catch { throw new SessionApiError(400, "INVALID_CURSOR", "This page link is invalid. Reload the session list."); }
}
function encodeCursor(at: string, id: string) { return Buffer.from(JSON.stringify({ at, id })).toString("base64url"); }

export async function getOwnedSession(client: Client, userId: string, sessionId: string) {
  assertSessionId(sessionId);
  const { data, error } = await client.from("study_sessions").select(SESSION_COLUMNS).eq("id", sessionId).eq("user_id", userId).maybeSingle();
  if (error) throw new SessionApiError(503, "SESSION_UNAVAILABLE", "The study session could not be loaded. Retry shortly.");
  if (!data) throw new SessionApiError(404, "NOT_FOUND", "Study session not found.");
  return data;
}

export async function listOwnedSessions(client: Client, userId: string, options: { limit: number; before: string | null; search: string }) {
  const before = cursor(options.before);
  let query = client.from("study_sessions").select(SESSION_COLUMNS).eq("user_id", userId);
  if (options.search) query = query.or(`title.ilike.%${options.search}%,topic_category.ilike.%${options.search}%,last_message.ilike.%${options.search}%`);
  if (before) query = query.or(`updated_at.lt.${before.at},and(updated_at.eq.${before.at},id.lt.${before.id})`);
  const { data, error } = await query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(options.limit + 1);
  if (error) throw new SessionApiError(503, "FETCH_FAILED", "Study sessions could not be loaded. Retry shortly.");
  const rows = (data ?? []).slice(0, options.limit);
  const last = rows.at(-1);
  return { sessions: rows.map(mapStudySessionRow), nextCursor: data && data.length > options.limit && last ? encodeCursor(last.updated_at, last.id) : null };
}

export async function getOwnedMessages(client: Client, userId: string, sessionId: string, limit?: number, beforeValue: string | null = null) {
  const before = cursor(beforeValue);
  let query = client.from("study_messages").select("id,role,content,created_at,sources").eq("session_id", sessionId).eq("user_id", userId);
  if (before) query = query.or(`created_at.lt.${before.at},and(created_at.eq.${before.at},id.lt.${before.id})`);
  if (limit) {
    const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    if (error) throw new SessionApiError(503, "HISTORY_UNAVAILABLE", "Session messages could not be loaded.");
    const rows = (data ?? []).slice(0, limit);
    const oldest = rows.at(-1);
    return { rows: rows.reverse(), nextCursor: data && data.length > limit && oldest ? encodeCursor(oldest.created_at, oldest.id) : null };
  }
  // Compatibility callers still receive complete history; range explicitly avoids the Data API's row cap.
  const rows: MessageRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("study_messages").select("id,role,content,created_at,sources")
      .eq("session_id", sessionId).eq("user_id", userId).order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new SessionApiError(503, "HISTORY_UNAVAILABLE", "Session messages could not be loaded.");
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return { rows, nextCursor: null };
  }
}

export async function saveOwnedNotes(client: Client, sessionId: string, operation: NoteOperation) {
  const { data, error } = await client.rpc("save_session_notes", {
    p_session_id: sessionId, p_notes: operation.notes,
    p_expected_revision: operation.expectedNotesRevision, p_operation_id: operation.operationId,
  });
  if (error) {
    if (error.code === "PT409") {
      let current: PersistedStudySession | undefined;
      if (error.message === "NOTES_CONFLICT" && error.details) {
        try { current = mapStudySessionRow(JSON.parse(error.details)); } catch { /* Never expose malformed database details. */ }
      }
      throw new SessionApiError(409, error.message === "NOTES_CONFLICT" ? "NOTES_CONFLICT" : "OPERATION_ID_REUSED",
        current ? "This note changed elsewhere. Your draft has been kept." : "This save identifier was already used. Reload before retrying.", current);
    }
    if (error.code === "PT428") throw new SessionApiError(428, "NOTES_PRECONDITION_REQUIRED", "Reload this page before saving notes. Your draft is kept.");
    if (error.code === "PT404" || error.code === "P0002") throw new SessionApiError(404, "NOT_FOUND", "Study session not found.");
    if (error.code === "PT413") throw new SessionApiError(413, "NOTE_TOO_LARGE", "Notes must be at most 100,000 bytes.");
    throw new SessionApiError(503, "SAVE_FAILED", "Save failed. Your draft is still here. Retry shortly.");
  }
  if (!data?.session || !data?.noteWrite) throw new SessionApiError(503, "SAVE_UNCONFIRMED", "The server could not confirm this save. Retry to check its outcome.");
  return { session: mapStudySessionRow(data.session), noteWrite: data.noteWrite };
}

export async function createOwnedSession(client: Client, userId: string, input: { title: string; topicCategory: string; courseId: string | null; operationId?: string }) {
  if (input.courseId) {
    const { data, error } = await client.from("courses").select("id").eq("id", input.courseId).eq("user_id", userId).maybeSingle();
    if (error) throw new SessionApiError(503, "COURSE_UNAVAILABLE", "The course could not be checked. Retry shortly.");
    if (!data) throw new SessionApiError(404, "NOT_FOUND", "Course not found.");
  }
  if (input.operationId) {
    const { data, error } = await client.from("study_sessions").select(SESSION_COLUMNS).eq("user_id", userId).eq("creation_operation_id", input.operationId).maybeSingle();
    if (error) throw new SessionApiError(503, "CREATE_FAILED", "The previous create attempt could not be checked.");
    if (data) return mapStudySessionRow(data);
  }
  const { data, error } = await client.from("study_sessions").insert({
    user_id: userId, title: input.title, topic_category: input.topicCategory, last_message: "", course_id: input.courseId,
    ...(input.operationId ? { creation_operation_id: input.operationId } : {}),
  }).select(SESSION_COLUMNS).single();
  if (error?.code === "23505" && input.operationId) {
    const replay = await client.from("study_sessions").select(SESSION_COLUMNS).eq("user_id", userId).eq("creation_operation_id", input.operationId).maybeSingle();
    if (!replay.error && replay.data) return mapStudySessionRow(replay.data);
  }
  if (error || !data) throw new SessionApiError(503, "CREATE_FAILED", "Unable to create the study session. Retry the same request.");
  return mapStudySessionRow(data);
}

export async function updateOwnedSession(client: Client, userId: string, sessionId: string, fields: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await getOwnedSession(client, userId, sessionId);
    const merged = { ...fields };
    if (typeof merged.duration_seconds === "number") merged.duration_seconds = Math.max(current.duration_seconds ?? 0, merged.duration_seconds);
    if (Array.isArray(merged.topics_covered)) {
      merged.topics_covered = [...new Set([...(Array.isArray(current.topics_covered) ? current.topics_covered : []), ...merged.topics_covered])];
      if ((merged.topics_covered as unknown[]).length > 100) throw new SessionApiError(400, "INVALID_TOPICS", "A session can have at most 100 topics.");
    }
    if (current.status === "completed" && merged.status) merged.status = "completed";
    const { data, error } = await client.from("study_sessions").update(merged).eq("id", sessionId).eq("user_id", userId)
      .eq("updated_at", current.updated_at).select(SESSION_COLUMNS).maybeSingle();
    if (error) throw new SessionApiError(503, "UPDATE_FAILED", "The study session could not be updated. Retry shortly.");
    if (data) return mapStudySessionRow(data);
  }
  throw new SessionApiError(409, "SESSION_CHANGED", "This session is being updated elsewhere. Your changes are kept; retry shortly.");
}

export async function deleteOwnedSession(client: Client, userId: string, sessionId: string) {
  const { data, error } = await client.from("study_sessions").delete().eq("id", sessionId).eq("user_id", userId).select("id");
  if (error) throw new SessionApiError(503, "DELETE_FAILED", "Unable to delete this conversation.");
  if (!data?.length) throw new SessionApiError(404, "NOT_FOUND", "Conversation not found.");
}

export async function recentSummaryMessages(client: Client, userId: string, sessionId: string) {
  const { data, error } = await client.from("study_messages").select("role,content").eq("session_id", sessionId).eq("user_id", userId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30);
  if (error) throw new SessionApiError(503, "HISTORY_UNAVAILABLE", "Session messages could not be loaded.");
  return (data ?? []).reverse();
}

export async function getOwnedNoteVariants(client: Client, sessionId: string) {
  const { data, error } = await client.rpc("get_session_note_variants", { p_session_id: sessionId });
  if (error) throw new SessionApiError(503, "RECOVERY_UNAVAILABLE", "Earlier note versions could not be loaded. Your current note is unchanged.");
  return Array.isArray(data) ? data : [];
}
