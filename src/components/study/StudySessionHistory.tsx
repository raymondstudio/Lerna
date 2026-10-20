"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudySessionRecord } from "@/lib/study-sessions/types";
import { loadStudyHistory } from "@/lib/study-sessions/history-loader";

export function StudySessionHistory({ userId, onOpen }: { userId: string; onOpen: (id: string) => void }) {
  return <OwnedStudySessionHistory key={userId} onOpen={onOpen} />;
}

function OwnedStudySessionHistory({ onOpen }: { onOpen: (id: string) => void }) {
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (before?: string) => {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    try {
      const page = await loadStudyHistory(abort.signal, before);
      if (!page) return;
      setSessions(current => {
        const merged: StudySessionRecord[] = before ? [...current, ...page.sessions] : page.sessions;
        return merged.filter((session, index) => merged.findIndex(other => other.id === session.id) === index);
      });
      setCursor(page.nextCursor);
    } catch (caught) {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "Sessions could not be loaded.");
    } finally { if (!abort.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    request.current = abort;
    void loadStudyHistory(abort.signal).then(page => {
      if (!page || abort.signal.aborted) return;
      setSessions(page.sessions);
      setCursor(page.nextCursor);
    }).catch(caught => {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "Sessions could not be loaded.");
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); request.current?.abort(); };
  }, []);
  const requestPage = (before?: string) => { setLoading(true); setError(null); void load(before); };
  return <section aria-labelledby="recent-study-sessions" className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#141414] p-5">
    <h2 id="recent-study-sessions" className="text-sm font-semibold text-white">Your study sessions</h2>
    {loading && !sessions.length && <p role="status" className="mt-3 text-sm text-slate-400">Loading saved sessions…</p>}
    {error && <div role="alert" className="mt-3 text-sm text-amber-300">{error} <button type="button" onClick={() => requestPage(sessions.length ? cursor ?? undefined : undefined)} className="underline">Retry</button></div>}
    {!loading && !error && !sessions.length && <p className="mt-3 text-sm text-slate-400">Your saved sessions will appear here. Start with a course above.</p>}
    <ul className="mt-3 divide-y divide-white/5">{sessions.map(session => <li key={session.id}>
      <button type="button" onClick={() => onOpen(session.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left focus-visible:outline focus-visible:outline-cyan-400">
        <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{session.title}</span><span className="text-xs text-slate-400">{new Date(session.updatedAt).toLocaleString()} · {session.status === "completed" ? "Completed" : "In progress"}</span></span>
        <span className="shrink-0 text-xs text-cyan-300">{session.status === "completed" ? "Review" : "Resume"}</span>
      </button>
    </li>)}</ul>
    {cursor && <button type="button" disabled={loading} onClick={() => requestPage(cursor)} className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">{loading ? "Loading…" : "Load older sessions"}</button>}
  </section>;
}
