import type { StudySessionRecord } from "./types";

export async function loadStudyHistory(signal: AbortSignal, before?: string): Promise<{
  sessions: StudySessionRecord[]; nextCursor: string | null;
} | null> {
  const params = new URLSearchParams({ summary: "true", limit: "20" });
  if (before) params.set("before", before);
  const response = await fetch(`/api/study-sessions?${params}`, { signal, cache: "no-store" });
  const payload = await response.json();
  // A fetch mock, proxy, or already buffered response may still resolve after abort.
  if (signal.aborted) return null;
  if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Sessions could not be loaded.");
  return { sessions: payload.data.sessions, nextCursor: payload.data.nextCursor ?? null };
}
