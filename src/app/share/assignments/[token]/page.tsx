"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Sparkles,
  Lock,
  Loader2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathMarkdown } from "@/components/assignments/MathMarkdown";
import { PublicSignUpModal } from "@/components/assignments/PublicSignUpModal";
import type {
  AssignmentRecord,
  AssignmentMessageRecord,
} from "@/lib/repositories/assignments";

export default function PublicAssignmentPage() {
  const params = useParams();
  const token = params?.token as string;

  const [assignment, setAssignment] = useState<AssignmentRecord | null>(null);
  const [messages, setMessages] = useState<AssignmentMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/assignments/public/${token}`);
        const data = await res.json();
        if (active && res.ok && data.success) {
          setAssignment(data.assignment);
          setMessages(data.messages || []);
        } else if (active) {
          setError(data.error?.message || "This assignment is not publicly available.");
        }
      } catch {
        if (active) setError("Could not load shared assignment.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (token) load();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="text-sm">Loading shared assignment...</p>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center space-y-4 text-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center text-slate-500">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Assignment Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md">
          {error || "This link may have been revoked by the owner or has expired."}
        </p>
        <Button asChild className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
          <Link href="/">Explore Lerna AI</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col">
      {/* ── Public Top Bar ────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-heading text-lg font-bold text-white tracking-tight">
              Lerna<span className="text-cyan-400"> AI</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#141414] text-slate-400 border border-white/10">
              Shared Solution
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="border-white/10 bg-[#141414] text-slate-300 hover:text-white text-xs">
            <Link href="/?auth=login">Sign In</Link>
          </Button>
          <Button asChild size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs">
            <Link href="/?auth=signup">Sign Up Free</Link>
          </Button>
        </div>
      </header>

      {/* ── Main Content Area ──────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Assignment Metadata Card */}
        <div className="rounded-2xl border border-white/5 bg-[#141414] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {assignment.courses?.code || "General"}
              </span>

              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/5">
                {assignment.mode === "explain" ? "Explain Mode" : "Answer Mode"}
              </span>
            </div>

            <span className="text-xs text-slate-500">
              Read-only verified publication
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {assignment.title}
          </h1>

          {assignment.description && (
            <p className="text-sm text-slate-400 leading-relaxed">
              {assignment.description}
            </p>
          )}
        </div>

        {/* Solved Solutions Stream */}
        <div className="space-y-6">
          {messages
            .filter((m) => m.role === "assistant")
            .map((msg, index) => (
              <div
                key={msg.id}
                className="rounded-2xl border border-white/5 bg-[#141414] p-6 sm:p-8 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      {index === 0 ? "Complete Worked Solution" : "Tutor Clarification"}
                    </span>
                  </div>
                </div>

                <MathMarkdown content={msg.content} />
              </div>
            ))}
        </div>
      </main>

      {/* Dismissible Public Sign-Up Modal */}
      <PublicSignUpModal />
    </div>
  );
}
