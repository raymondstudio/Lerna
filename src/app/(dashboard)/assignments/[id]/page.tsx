"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  Share2,
  Sparkles,
  Send,
  Loader2,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ShareModal } from "@/components/assignments/ShareModal";
import { MathMarkdown } from "@/components/assignments/MathMarkdown";
import type {
  AssignmentRecord,
  AssignmentMessageRecord,
} from "@/lib/repositories/assignments";

export default function AssignmentWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [assignment, setAssignment] = useState<AssignmentRecord | null>(null);
  const [messages, setMessages] = useState<AssignmentMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [followUpText, setFollowUpText] = useState("");
  const [showQuestions, setShowQuestions] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/assignments/${id}`);
        const data = await res.json();
        if (active && res.ok && data.success) {
          setAssignment(data.assignment);
          setMessages(data.messages || []);
        } else if (active) {
          setError(data.error?.message || "Failed to load assignment.");
        }
      } catch {
        if (active) setError("Network error loading assignment.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) loadData();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendingFollowUp]);

  const handleSendFollowUp = async (textToSend?: string) => {
    const text = (textToSend || followUpText).trim();
    if (!text || sendingFollowUp) return;

    try {
      setSendingFollowUp(true);
      setFollowUpText("");

      const tempUserMsg: AssignmentMessageRecord = {
        id: "temp-optimistic-message",
        assignmentId: id,
        userId: "current",
        role: "user",
        content: text,
        metadata: {},
        createdAt: "",
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      const res = await fetch(`/api/assignments/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to send follow-up.");
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.replyMessage,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sending message.");
    } finally {
      setSendingFollowUp(false);
    }
  };

  const handleSwitchModeAndRegenerate = async (newMode: "answer" | "explain") => {
    if (!assignment || regenerating) return;
    try {
      setRegenerating(true);
      setError(null);

      const res = await fetch(`/api/assignments/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to regenerate solutions.");
      }

      setAssignment(data.assignment);
      if (data.solutionMessage) {
        setMessages((prev) => [...prev, data.solutionMessage]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error switching mode.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleRetryProcessing = async () => {
    if (!assignment || regenerating) return;
    try {
      setRegenerating(true);
      setError(null);
      const res = await fetch(`/api/assignments/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: assignment.mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Processing retry failed.");
      }
      setAssignment(data.assignment);
      if (data.solutionMessage) {
        setMessages((prev) => [...prev, data.solutionMessage]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-[#0a0a0a] flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="text-sm">Opening assignment workspace...</p>
      </div>
    );
  }

  if (error && !assignment) {
    return (
      <div className="h-full bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold text-white">Assignment Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md">{error}</p>
        <Link
          href="/assignments"
          className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-xl transition-colors"
        >
          Back to Assignments
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-slate-100 overflow-hidden">
      {/* ── Top Workspace Bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/assignments"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
            title="Back to assignments"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {assignment?.courses?.code || "GENERAL"}
              </span>

              {assignment?.status === "completed" && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Solved</span>
                </span>
              )}
              {assignment?.status === "processing" && (
                <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Solving...</span>
                </span>
              )}
            </div>

            <h1 className="text-sm sm:text-base font-semibold text-white truncate mt-0.5">
              {assignment?.title}
            </h1>
          </div>
        </div>

        {/* Right Actions: Mode Switch & Share */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Mode Switcher */}
          <div className="hidden sm:flex items-center bg-[#141414] p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => assignment?.mode !== "answer" && handleSwitchModeAndRegenerate("answer")}
              disabled={regenerating}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                assignment?.mode === "answer"
                  ? "bg-cyan-500 text-black font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Answer Mode
            </button>
            <button
              onClick={() => assignment?.mode !== "explain" && handleSwitchModeAndRegenerate("explain")}
              disabled={regenerating}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                assignment?.mode === "explain"
                  ? "bg-cyan-500 text-black font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Explain Mode
            </button>
          </div>

          <button
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 text-white rounded-xl text-xs font-medium transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* ── Extracted Questions Collapsible Drawer ─────────────────── */}
      {assignment?.extractedQuestions && assignment.extractedQuestions.length > 0 && (
        <div className="border-b border-white/5 bg-[#141414] px-4 sm:px-6 py-2.5 shrink-0">
          <button
            onClick={() => setShowQuestions(!showQuestions)}
            className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Extracted Questions ({assignment.extractedQuestions.length})</span>
            </span>
            {showQuestions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showQuestions && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2 max-h-56 overflow-y-auto pr-2 scrollbar-thin">
              {assignment.extractedQuestions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-white/5 bg-[#0a0a0a] p-3 text-xs text-slate-200"
                >
                  <span className="font-semibold text-cyan-400 block mb-1">
                    Question {q.id}
                  </span>
                  <p className="line-clamp-2 leading-relaxed">{q.question}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main Conversation Stream ───────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto space-y-6">
        {assignment?.status === "failed" && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-white">Solution Generation Incomplete</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  The AI solver encountered a temporary issue while processing your assignment.
                </p>
              </div>
            </div>
            <button
              onClick={handleRetryProcessing}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
            >
              <RotateCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
              <span>Retry Solution</span>
            </button>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 mt-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`rounded-2xl p-5 sm:p-6 max-w-3xl leading-relaxed text-sm ${
                  isUser
                    ? "bg-cyan-500/10 border border-cyan-500/20 text-white rounded-br-sm"
                    : "bg-[#141414] border border-white/5 text-slate-200 rounded-bl-sm shadow-sm w-full"
                }`}
              >
                {!isUser ? (
                  <MathMarkdown content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap font-medium">{message.content}</p>
                )}
              </div>
            </div>
          );
        })}

        {sendingFollowUp && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="rounded-2xl p-4 bg-[#141414] border border-white/5 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Thinking and formulating response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ── Follow-Up Input Footer ─────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#0a0a0a] p-4 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendFollowUp();
          }}
          className="max-w-4xl mx-auto flex items-center gap-2.5"
        >
          <input
            type="text"
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            placeholder="Ask a clarifying question or request deeper explanation on any step..."
            disabled={sendingFollowUp || assignment?.status === "processing"}
            className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={sendingFollowUp || !followUpText.trim() || assignment?.status === "processing"}
            className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black transition-colors disabled:opacity-50 shrink-0"
            title="Send follow-up"
          >
            {sendingFollowUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </footer>

      {/* ── Share Modal ───────────────────────────────────────────── */}
      {shareModalOpen && assignment && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          assignmentId={assignment.id}
          assignmentTitle={assignment.title}
          initialIsPublic={assignment.isPublic}
          shareToken={assignment.shareToken}
          onVisibilityChange={(pub) => {
            setAssignment((prev) => (prev ? { ...prev, isPublic: pub } : null));
          }}
        />
      )}
    </div>
  );
}
