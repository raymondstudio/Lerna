"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "lerna_public_signup_dismissed";

export function PublicSignUpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if dismissed in this browser session
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY);
      if (dismissed) return;
    } catch {
      // In case storage is blocked in privacy mode
    }

    // Gentle delay after reader has had time to read the first solution
    const timer = setTimeout(() => {
      setOpen(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  };

  if (!open) return null;

  return (
    <aside aria-label="Sign up prompt" className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="rounded-2xl border border-white/10 bg-[#141414]/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/60 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Dismiss sign-up prompt"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 pr-4">
            <h4 className="text-sm font-semibold text-white">Enjoying these solutions?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Create your free Lerna account to organize your own assignments, get step-by-step AI worked solutions, and learn smarter.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
          <Link
            href="/?auth=login"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Already have an account? Sign In
          </Link>

          <Button
            asChild
            size="sm"
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold gap-1 text-xs"
          >
            <Link href="/?auth=signup">
              <span>Sign Up Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
