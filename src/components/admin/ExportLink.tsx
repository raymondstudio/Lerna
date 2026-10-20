"use client";
import { useState, type ReactNode } from "react";

export function ExportLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState(false);
  async function download() {
    setBusy(true); setError(null); setStepUp(false);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        if (failure?.code === "MFA_REQUIRED") { setStepUp(true); return; }
        throw new Error(typeof failure?.error === "string" ? failure.error : "The export could not be prepared. Retry shortly.");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = objectUrl;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "lerna-export.csv";
      link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      if (response.headers.get("X-Lerna-Export-Truncated") === "true") setError("This export reached its row limit. Narrow the filters to export the remaining activity.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Export failed."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" className={className} disabled={busy} onClick={() => void download()}>{busy ? "Preparing export…" : children}</button>
    {stepUp && <a className="text-sm text-cyan-300 underline" href={`/auth/mfa?next=${encodeURIComponent(typeof window === "undefined" ? "/admin" : window.location.pathname + window.location.search)}`}>Verify with MFA, then retry this export</a>}
    {error && <span role="alert" className="max-w-sm text-xs text-amber-300">{error}</span>}
  </span>;
}
