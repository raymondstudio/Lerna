"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { NoteSaveController, NoteSaveError, type NoteOperation, type NoteReceipt, type NoteSaveState, type NoteSnapshot } from "@/lib/study-sessions/note-save-controller";
import { noteDraftKey, readNoteDraft, writeNoteDraft } from "@/lib/study-sessions/note-drafts";
import { registerUnsavedWork } from "@/lib/study-sessions/unsaved-work";

const EMPTY: NoteSaveState = { value: "", status: "saved", revision: 0, error: null, conflict: null };
let mountedTabId: string | null = null;
function recoveryTabId() {
  if (mountedTabId) return mountedTabId;
  try {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    // A duplicated tab can inherit sessionStorage. A new navigation gets its own writer key.
    const previous = navigation?.type === "reload" || navigation?.type === "back_forward" ? sessionStorage.getItem("lerna.note-tab") : null;
    mountedTabId = previous ?? crypto.randomUUID();
    sessionStorage.setItem("lerna.note-tab", mountedTabId);
  } catch { mountedTabId = crypto.randomUUID(); }
  return mountedTabId;
}

export async function saveNote(sessionId: string, operation: NoteOperation): Promise<NoteReceipt> {
  let response: Response;
  try {
    response = await fetch(`/api/study-sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operation), signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new NoteSaveError("The connection was interrupted. Your draft is still here."); }
  const payload = await response.json().catch(() => null);
  if (response.ok && !payload) throw new NoteSaveError("The server did not confirm this save. Retry to check its outcome.");
  if (!response.ok || !payload?.success) {
    const retryHeader = response.headers.get("Retry-After");
    const seconds = retryHeader ? Number(retryHeader) : Number.NaN;
    const retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1_000) : undefined;
    throw new NoteSaveError(payload?.error?.message ?? "Save failed. Your draft is still here. Retry when ready.", response.status,
      payload?.error?.currentSession, retryAfterMs);
  }
  if (!payload.data?.session || !payload.data?.noteWrite) throw new NoteSaveError("The server did not confirm this save. Retry to check its outcome.");
  return payload.data;
}

class NotesConnection {
  private controller: NoteSaveController | null = null;
  private listeners = new Set<() => void>();
  private stopController: (() => void) | null = null;
  private snapshot: { state: NoteSaveState; draftWarning: string | null } = { state: EMPTY, draftWarning: null };
  constructor(private identity: string | null) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish(state: NoteSaveState, draftWarning = this.snapshot.draftWarning) {
    this.snapshot = { state, draftWarning };
    for (const listener of this.listeners) listener();
  }
  start(session: NoteSnapshot | null) {
    if (!this.identity || !session) return;
    if (this.controller) { this.controller.hydrate(session); return; }
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Private browsing may disable storage. */ }
    const draftKey = `${this.identity}:${recoveryTabId()}`;
    const recovered = storage ? readNoteDraft(storage, draftKey) : null;
    let recoveryAvailable = Boolean(recovered);
    const controller = new NoteSaveController(session, {
      save: operation => saveNote(session.id, operation),
      changed: (next, draft) => {
        if (this.controller !== controller) return;
        const written = Boolean(storage && writeNoteDraft(storage, draftKey, draft));
        recoveryAvailable = Boolean(written && draft);
        this.publish(next, written ? this.snapshot.draftWarning : "Local draft recovery is unavailable. Keep this tab open until Saved appears.");
      },
    }, recovered);
    this.controller = controller;
    const unregister = registerUnsavedWork({
      isUnsaved: () => controller.getSnapshot().status !== "saved",
      flush: () => controller.flush(),
      hasRecoveryDraft: () => recoveryAvailable,
    });
    this.publish(controller.getSnapshot(), storage ? null : "Local draft recovery is unavailable. Keep this tab open until Saved appears.");
    controller.schedule();
    this.stopController = () => {
      // Persist before disposal; an in-flight outcome can be resolved idempotently on reopen.
      if (storage) writeNoteDraft(storage, draftKey, controller.getDraft());
      unregister();
      controller.dispose();
      if (this.controller === controller) this.controller = null;
    };
  }
  stop() { this.stopController?.(); this.stopController = null; }
  hydrate(session: NoteSnapshot) { this.controller?.hydrate(session); }
  isUnsaved() { return this.controller && this.controller.getSnapshot().status !== "saved"; }
  edit(value: string) { this.controller?.edit(value); }
  flush() { return this.controller?.flush() ?? Promise.resolve(!this.identity); }
  useSavedVersion() { this.controller?.useSavedVersion(); }
  keepDraftAndSave() { return this.controller?.keepDraftAndSave() ?? Promise.resolve(false); }
  recoverVersion(content: string) { this.controller?.recoverVersion(content); }
}

export function usePersistedNotes(userId: string | undefined, session: NoteSnapshot | null) {
  const identity = userId && session ? noteDraftKey(userId, session.id) : null;
  const connection = useMemo(() => new NotesConnection(identity), [identity]);
  const snapshot = useSyncExternalStore(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
  useEffect(() => { connection.start(session); }, [connection, session]);
  useEffect(() => () => connection.stop(), [connection]);
  const sessionId = session?.id;

  useEffect(() => {
    if (!sessionId || !identity) return;
    const abort = new AbortController();
    let latest = 0;
    async function revalidate() {
      const generation = ++latest;
      try {
        const response = await fetch(`/api/study-sessions/${encodeURIComponent(sessionId!)}?notesOnly=true`, {
          signal: abort.signal, cache: "no-store",
        });
        const payload = await response.json();
        if (!abort.signal.aborted && response.ok && payload.success && payload.data?.session && generation === latest) {
          connection.hydrate(payload.data.session);
        }
      } catch { /* Existing draft/save state remains visible; revalidation never clears it. */ }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void revalidate(); };
    const onFocus = () => { void revalidate(); };
    const onOnline = () => { void revalidate(); };
    const onStorage = (event: StorageEvent) => { if (event.key?.startsWith(`${identity}:`)) void revalidate(); };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (connection.isUnsaved()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      abort.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [identity, sessionId, connection]);

  return {
    ...snapshot.state, draftWarning: snapshot.draftWarning,
    sessionId: session?.id,
    edit: useCallback((value: string) => connection.edit(value), [connection]),
    flush: useCallback(() => connection.flush(), [connection]),
    useSavedVersion: useCallback(() => connection.useSavedVersion(), [connection]),
    keepDraftAndSave: useCallback(() => connection.keepDraftAndSave(), [connection]),
    recoverVersion: useCallback((content: string) => connection.recoverVersion(content), [connection]),
  };
}
