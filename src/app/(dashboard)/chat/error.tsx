"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ChatError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[chat] route error boundary", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-slate-950/40">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Chat error</p>
        <h2 className="mt-4 text-3xl font-semibold text-white">The chat view crashed.</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          This fallback keeps the app usable instead of showing a black recovery screen. Try reloading the chat view or returning to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950">
            Retry chat
          </button>
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}