"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, NotebookPen } from "lucide-react";
import type { usePersistedNotes } from "@/hooks/use-persisted-notes";

export function QuickNotes({ notes, disabled = false }: { notes: ReturnType<typeof usePersistedNotes>; disabled?: boolean }) {
  return <SessionQuickNotes key={notes.sessionId ?? 'loading'} notes={notes} disabled={disabled} />;
}

function SessionQuickNotes({ notes, disabled = false }: { notes: ReturnType<typeof usePersistedNotes>; disabled?: boolean }) {
  const id = useId();
  const [variants, setVariants] = useState<Array<{ id: string; content: string; preservedAt: string }> | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const recoveryAbort = useRef<AbortController | null>(null);
  useEffect(() => () => recoveryAbort.current?.abort(), []);
  const loadVersions = async () => {
    if (!notes.sessionId || recoveryLoading) return;
    const abort = new AbortController();
    recoveryAbort.current = abort;
    setRecoveryLoading(true);
    setRecoveryError(null);
    try {
      const response = await fetch(`/api/study-sessions/${encodeURIComponent(notes.sessionId)}?notesOnly=true&noteVariants=true`, { signal: abort.signal });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Earlier note versions could not be loaded.");
      if (!abort.signal.aborted) setVariants(payload.data.noteVariants ?? []);
    } catch (caught) { if (!abort.signal.aborted) setRecoveryError(caught instanceof Error ? caught.message : "Earlier note versions could not be loaded."); }
    finally { if (!abort.signal.aborted) setRecoveryLoading(false); }
  };
  const labels = { saved: "Saved", saving: "Saving…", unsaved: "Unsaved", failed: "Save failed — retry", conflict: "Conflicting changes" };
  const copyDraft = () => {
    const url = URL.createObjectURL(new Blob([notes.value], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "lerna-note-draft.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-white">
      <label htmlFor={id} className="flex items-center gap-2"><NotebookPen size={15} className="text-cyan-400" />Quick Notes</label>
      <span role="status" aria-live="polite" className="flex items-center gap-1 text-xs font-normal text-slate-400">
        {notes.status === "saved" ? <Check size={12} className="text-emerald-500" /> : notes.status === "saving" ? <Loader2 size={12} className="animate-spin text-cyan-500" /> : <AlertCircle size={12} className="text-amber-400" />}
        {labels[notes.status]}
      </span>
    </div>
    <textarea id={id} value={notes.value} onChange={event => notes.edit(event.target.value)} onBlur={() => { void notes.flush(); }}
      disabled={disabled} aria-describedby={notes.error ? `${id}-error` : undefined}
      placeholder="Jot down thoughts, formulas, reminders…" rows={8}
      className="w-full resize-y rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-sm leading-relaxed text-slate-300 placeholder-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-60" />
    {notes.error && <p id={`${id}-error`} role="alert" className="text-xs leading-relaxed text-amber-300">{notes.error}</p>}
    {notes.draftWarning && <p className="text-xs leading-relaxed text-amber-300">{notes.draftWarning}</p>}
    {notes.conflict && <div className="space-y-3 rounded-xl border border-amber-500/30 p-3 text-xs text-slate-300">
      <details><summary className="cursor-pointer font-medium">Compare saved version</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans">{notes.conflict.notes || "(Empty note)"}</pre></details>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={notes.useSavedVersion} className="rounded-lg border border-white/20 px-3 py-2 focus-visible:outline focus-visible:outline-cyan-400">Use saved version</button>
        <button type="button" onClick={() => { void notes.keepDraftAndSave(); }} className="rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-black focus-visible:outline focus-visible:outline-white">Keep draft and save</button>
      </div>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" disabled={disabled || notes.status === "saving" || notes.status === "saved" || notes.status === "conflict"} onClick={() => { void notes.flush(); }}
        className="rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-medium text-cyan-300 focus-visible:outline focus-visible:outline-cyan-400 disabled:opacity-40">{notes.status === "failed" ? "Retry save" : "Save now"}</button>
      {notes.status !== "saved" && <button type="button" onClick={copyDraft} className="rounded-lg px-2 py-2 text-xs text-slate-300 underline underline-offset-4 focus-visible:outline focus-visible:outline-cyan-400">Download draft</button>}
    </div>
    <details className="text-xs text-slate-400" onToggle={event => { if (event.currentTarget.open && variants === null) void loadVersions(); }}>
      <summary className="cursor-pointer py-2">Earlier note recovery</summary>
      {recoveryLoading && <p role="status" className="py-2">Checking preserved versions…</p>}
      {recoveryError && <p role="alert" className="py-2 text-amber-300">{recoveryError} <button type="button" onClick={() => { void loadVersions(); }} className="underline">Retry</button></p>}
      {variants?.length === 0 && <p className="py-2">No earlier versions need recovery.</p>}
      {variants?.map(variant => <div key={variant.id} className="my-2 rounded-lg border border-white/10 p-3">
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words font-sans text-slate-300">{variant.content}</pre>
        <button type="button" disabled={disabled || notes.status !== "saved"} onClick={() => notes.recoverVersion(variant.content)} className="mt-3 rounded-lg border border-cyan-500/30 px-3 py-2 text-cyan-300 disabled:opacity-40">Load as a draft</button>
        {notes.status !== "saved" && <p className="mt-2">Save or resolve your current draft before loading another version.</p>}
      </div>)}
    </details>
  </div>;
}
