"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] global error boundary", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white">
        <div className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-slate-950/40">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Lerna AI</p>
            <h1 className="mt-4 text-3xl font-semibold">Something went wrong.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The app hit an unexpected runtime error. Your data is safe, and you can retry immediately.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={reset} className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950">
                Try again
              </button>
              <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200">
                Go home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}