"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords,
  Users,
  Timer,
  Trophy,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Share2,
  Loader2,
  Crown,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useArenaRoom, useArenaActions } from "@/hooks/use-arena";
import { firePodiumCelebration } from "@/lib/arena/confetti";

export default function ArenaBattlePage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string) || "";
  const { user } = useAuth();

  const { data: room, isLoading, error, broadcastUpdate } = useArenaRoom(code);
  const { startBattle, isStarting, updateProgress, submitAnswers, isSubmitting } =
    useArenaActions(code, broadcastUpdate);

  // Local Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [confettiFired, setConfettiFired] = useState(false);

  // Remaining Seconds calculation (Synchronized from room.endsAt)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Active user participant record
  const currentParticipant = useMemo(
    () => room?.participants.find((p) => p.userId === user?.id),
    [room?.participants, user?.id]
  );

  const isHost = Boolean(room?.isHost || (room && user && room.hostId === user.id));

  // Timer Tick
  useEffect(() => {
    if (!room || room.status !== "in_progress" || !room.endsAt) {
      setRemainingSeconds(null);
      return;
    }

    const updateTimer = () => {
      const endsAtMs = new Date(room.endsAt!).getTime();
      const diffSecs = Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
      setRemainingSeconds(diffSecs);

      // Auto-submit when timer expires
      if (diffSecs === 0 && currentParticipant?.status !== "submitted") {
        void submitAnswers({ answers, timeTakenSeconds: room.durationSeconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.status, room?.endsAt, room?.durationSeconds, currentParticipant?.status, answers, submitAnswers]);

  // Trigger Confetti once upon battle completion
  useEffect(() => {
    if (room?.status === "completed" && !confettiFired) {
      firePodiumCelebration();
      setConfettiFired(true);
    }
  }, [room?.status, confettiFired]);

  // Handle Option Click
  const handleSelectOption = useCallback(
    (questionId: string, option: string) => {
      if (currentParticipant?.status === "submitted" || room?.status !== "in_progress") return;

      const nextAnswers = { ...answers, [questionId]: option };
      setAnswers(nextAnswers);

      void updateProgress({
        totalAnswered: Object.keys(nextAnswers).length,
        answers: nextAnswers,
      });
    },
    [answers, currentParticipant?.status, room?.status, updateProgress]
  );

  // Toggle Flag Question
  const toggleFlag = (index: number) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Copy Code to Clipboard
  const handleCopyCode = () => {
    if (!room?.code) return;
    void navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    if (!room?.code) return;
    const text = encodeURIComponent(
      `Join my Lerna quiz battle! Room Code: ${room.code}\nLink: ${window.location.href}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  // Format Timer mm:ss
  const formatTimer = (totalSeconds: number | null) => {
    if (totalSeconds === null) return "--:--";
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="h-7 w-7 text-cyan-400 animate-spin mb-3" />
        <p className="text-xs text-slate-500">Connecting to battle room {code}…</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="h-full overflow-y-auto bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 space-y-4">
        <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold">Room Not Found</h2>
        <p className="text-xs text-slate-400 text-center max-w-sm">
          {error instanceof Error ? error.message : "The room code does not exist or has expired."}
        </p>
        <Button onClick={() => router.push("/arena")} className="bg-cyan-500 text-black font-semibold text-xs">
          Back to Arena
        </Button>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 1: LOBBY
  // ───────────────────────────────────────────────────────────────────────────
  if (room.status === "lobby") {
    const canStart = room.participants.length >= 2;

    return (
      <div className="h-full overflow-y-auto bg-[#0a0a0a] font-body text-white">
        {/* Header */}
        <div className="border-b border-white/5 bg-[#141414] shrink-0 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push("/arena")}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 p-0 h-auto"
            >
              <ChevronLeft className="h-4 w-4" />
              Arena Hub
            </Button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Lobby Waiting Room
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          {/* Room Code Banner */}
          <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 text-center space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">{room.title}</h1>
              <p className="text-xs text-slate-400 mt-1">
                Share this room code with 2 to 4 classmates to join:
              </p>
            </div>

            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-[#0a0a0a] border border-white/10">
              <span className="font-mono text-3xl font-black tracking-widest text-cyan-400">
                {room.code}
              </span>
              <button
                onClick={handleCopyCode}
                title="Copy Code"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex justify-center pt-1">
              <button
                onClick={handleShareWhatsApp}
                className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share link on WhatsApp
              </button>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
              <span>Participants ({room.participants.length})</span>
              <span>Min 2 required</span>
            </div>

            <div className="space-y-2">
              {room.participants.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#141414] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-xs font-bold text-cyan-400 border border-cyan-500/20">
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white">{p.displayName}</span>
                      {p.userId === room.hostId && (
                        <span className="ml-2 text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-mono border border-cyan-500/20">
                          HOST
                        </span>
                      )}
                      {p.userId === user?.id && (
                        <span className="ml-1 text-[10px] text-slate-500">(You)</span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
            <div className="text-xs text-slate-400 space-y-0.5">
              <p>{room.questionCount} Questions</p>
              <p>{Math.round(room.durationSeconds / 60)} Minutes Timer</p>
            </div>

            {isHost ? (
              <Button
                onClick={() => startBattle()}
                disabled={isStarting || !canStart}
                className="bg-cyan-500 text-black font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Swords className="h-4 w-4" />
                    {canStart ? "Start Live Battle" : "Waiting for Player…"}
                  </>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for host to start…
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 2: LIVE QUIZ ARENA
  // ───────────────────────────────────────────────────────────────────────────
  if (room.status === "in_progress") {
    const isSubmitted = currentParticipant?.status === "submitted";
    const currentQ = room.questions[currentQuestionIndex];
    const totalQ = room.questions.length;
    const answeredCount = Object.keys(answers).length;

    const timerColor =
      remainingSeconds !== null && remainingSeconds < 20
        ? "text-red-400"
        : remainingSeconds !== null && remainingSeconds < 60
        ? "text-amber-400"
        : "text-cyan-400";

    if (isSubmitted) {
      return (
        <div className="h-full overflow-y-auto bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Quiz Submitted!</h2>
          <p className="text-xs text-slate-400 max-w-sm">
            Waiting for other participants to finish or the timer to expire.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141414] border border-white/5 font-mono text-xs text-slate-300">
            <Timer className="h-3.5 w-3.5 text-cyan-400" />
            Time remaining: {formatTimer(remainingSeconds)}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto bg-[#0a0a0a] font-body text-white">
        {/* Top Sticky Bar */}
        <div className="border-b border-white/5 bg-[#141414] shrink-0 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Swords className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white truncate max-w-xs">{room.title}</h1>
                <p className="text-[11px] text-slate-500">Question {currentQuestionIndex + 1} of {totalQ}</p>
              </div>
            </div>

            <div className={`flex items-center gap-2 font-mono text-sm font-bold ${timerColor}`}>
              <Timer className="h-4 w-4" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Opponent Progress Bar */}
          <div className="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Live Progress
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {room.participants.map((p) => {
                const count = p.userId === user?.id ? answeredCount : p.totalAnswered;
                const pPct = totalQ > 0 ? Math.round((count / totalQ) * 100) : 0;

                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span className="truncate">{p.displayName}</span>
                      <span className="font-mono text-slate-500">{count}/{totalQ}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all duration-300"
                        style={{ width: `${pPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Question */}
          {currentQ && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Select one answer</span>
                <button
                  type="button"
                  onClick={() => toggleFlag(currentQuestionIndex)}
                  className={`flex items-center gap-1 text-xs cursor-pointer ${
                    flaggedQuestions.has(currentQuestionIndex) ? "text-amber-400" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {flaggedQuestions.has(currentQuestionIndex) ? "Flagged" : "Flag"}
                </button>
              </div>

              {/* Card */}
              <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-5">
                <p className="text-base text-slate-200 leading-relaxed font-medium">
                  {currentQ.question}
                </p>

                <div className="space-y-2.5">
                  {currentQ.options.map((opt, optIdx) => {
                    const label = ["A", "B", "C", "D"][optIdx];
                    const isSelected = answers[currentQ.id] === opt;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, opt)}
                        className={`w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-cyan-500/20 border border-cyan-500/50 text-white font-medium"
                            : "bg-[#1c1f26] border border-white/10 hover:border-cyan-500/40 hover:bg-[#202020] text-slate-300"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                            isSelected ? "bg-cyan-500 text-black" : "bg-white/5 text-slate-400"
                          }`}
                        >
                          {label}
                        </span>
                        <span className="text-sm leading-relaxed">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-xl bg-[#141414] border border-white/5">
                {room.questions.map((q, idx) => {
                  const isAnswered = Boolean(answers[q.id]);
                  const isCurrent = idx === currentQuestionIndex;
                  const isFlagged = flaggedQuestions.has(idx);

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-cyan-500 text-black font-bold"
                          : isFlagged
                          ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                          : isAnswered
                          ? "bg-white/10 text-cyan-300"
                          : "bg-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 p-0 h-auto cursor-pointer disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() =>
                      submitAnswers({
                        answers,
                        timeTakenSeconds: room.durationSeconds - (remainingSeconds ?? 0),
                      })
                    }
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-500 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Quiz"}
                  </Button>

                  {currentQuestionIndex < totalQ - 1 && (
                    <Button
                      onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQ - 1, prev + 1))}
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 3: RESULTS / SHOWDOWN
  // ───────────────────────────────────────────────────────────────────────────
  const sortedParticipants = [...room.participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.timeTakenSeconds ?? 9999) - (b.timeTakenSeconds ?? 9999);
  });

  const isTwoPlayerShowdown = sortedParticipants.length === 2;
  const winner = sortedParticipants[0];

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a] font-body text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#141414] shrink-0 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/arena")}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 p-0 h-auto"
          >
            <ChevronLeft className="h-4 w-4" />
            Arena Hub
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Battle Finished
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Results Card */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold uppercase">
            <Crown className="h-3.5 w-3.5 text-amber-400" />
            Winner: {winner?.displayName}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {sortedParticipants.map((p, idx) => (
              <div
                key={p.id}
                className={`p-4 rounded-xl border text-center space-y-2 ${
                  idx === 0
                    ? "bg-amber-500/10 border-amber-500/30 text-white"
                    : "bg-[#0a0a0a] border-white/5 text-slate-300"
                }`}
              >
                <p className="text-xs text-slate-400 font-mono">
                  {idx === 0 ? "🥇 1st Place" : idx === 1 ? "🥈 2nd Place" : "🥉 3rd Place"}
                </p>
                <p className="font-bold text-sm truncate">{p.displayName}</p>
                <p className="text-2xl font-black text-white">{p.score}/{room.questionCount}</p>
                <p className="text-[11px] text-slate-500">
                  {p.timeTakenSeconds ? `${Math.round(p.timeTakenSeconds)}s` : "--"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Review Questions */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Review Questions & Explanations
          </p>

          <div className="space-y-3">
            {room.questions.map((q, idx) => {
              const userChoice = currentParticipant?.answers?.[q.id];
              const isCorrect = userChoice && q.correctAnswer && userChoice === q.correctAnswer;

              return (
                <div key={q.id} className="bg-[#141414] border border-white/5 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-400">Question {idx + 1}</span>
                    {userChoice && (
                      <span className={isCorrect ? "text-green-400" : "text-red-400"}>
                        {isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-200">{q.question}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt) => {
                      const isCorrectOpt = q.correctAnswer === opt;
                      const isUserOpt = userChoice === opt;

                      return (
                        <div
                          key={opt}
                          className={`p-2.5 rounded-lg border flex items-center justify-between ${
                            isCorrectOpt
                              ? "bg-green-500/10 border-green-500/40 text-green-300 font-medium"
                              : isUserOpt
                              ? "bg-red-500/10 border-red-500/40 text-red-300"
                              : "bg-[#0a0a0a] border-white/5 text-slate-400"
                          }`}
                        >
                          <span>{opt}</span>
                          {isCorrectOpt && <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15 text-xs text-slate-300 leading-relaxed">
                      <span className="text-cyan-400 font-semibold block mb-0.5">Explanation:</span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
