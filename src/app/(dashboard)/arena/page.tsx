"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords,
  Users,
  Trophy,
  Timer,
  BookOpen,
  ArrowRight,
  Plus,
  Loader2,
  AlertCircle,
  History,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCourses } from "@/hooks/use-courses";
import { useArenaList } from "@/hooks/use-arena";

type Tab = "create" | "join" | "history";

export default function ArenaHubPage() {
  const router = useRouter();
  const { data: courses = [] } = useCourses();
  const { data: recentBattles = [], isLoading: loadingBattles } = useArenaList();

  const [activeTab, setActiveTab] = useState<Tab>("create");

  // Create Room State
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join Room State
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourseId || undefined,
          count: questionCount,
          durationMinutes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create battle room.");
      }

      router.push(`/arena/${json.data.code}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create battle room.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.toUpperCase().trim();
    if (!clean) return;

    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/arena/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Room not found or already completed.");
      }

      router.push(`/arena/${clean}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join battle room.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a] font-body text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#141414] shrink-0 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Swords className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none text-white">
                Quiz Arena
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Live multiplayer study battles</p>
            </div>
          </div>

          <div className="flex bg-[#0a0a0a] border border-white/10 rounded-xl p-0.5">
            <button
              onClick={() => setActiveTab("create")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "create"
                  ? "bg-cyan-500 text-black"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Create Battle
            </button>
            <button
              onClick={() => setActiveTab("join")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "join"
                  ? "bg-cyan-500 text-black"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Join with Code
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-cyan-500 text-black"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <History size={12} />
              History
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {/* TAB 1: CREATE BATTLE */}
          {activeTab === "create" && (
            <motion.div
              key="create-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Host a Study Showdown</h2>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Generate a battle room code, pick your course curriculum, and challenge 2 to 4 classmates in a live quiz.
                </p>
              </div>

              <form onSubmit={handleCreateRoom} className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
                {/* Select Course */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Target Course
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">— General Academic Knowledge —</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question Count */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Number of Questions
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 5, 10, 15].map((cnt) => (
                      <button
                        type="button"
                        key={cnt}
                        onClick={() => setQuestionCount(cnt)}
                        className={`flex items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          questionCount === cnt
                            ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                            : "bg-[#0a0a0a] border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                        }`}
                      >
                        {cnt} Questions
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Time Limit
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 3, 5, 10].map((mins) => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setDurationMinutes(mins)}
                        className={`flex items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          durationMinutes === mins
                            ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                            : "bg-[#0a0a0a] border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                        }`}
                      >
                        {mins} Minutes
                      </button>
                    ))}
                  </div>
                </div>

                {createError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-cyan-500 text-black font-semibold text-sm py-3 rounded-xl hover:bg-cyan-400 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Battle Room…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Room & Launch Lobby
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          )}

          {/* TAB 2: JOIN WITH CODE */}
          {activeTab === "join" && (
            <motion.div
              key="join-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Enter Room Code</h2>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Enter the 6-character room code shared by your study partner or host.
                </p>
              </div>

              <form onSubmit={handleJoinRoom} className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Room Code
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="e.g. K9X2P4"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>

                {joinError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{joinError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={joining || !joinCode.trim()}
                  className="w-full bg-cyan-500 text-black font-semibold text-sm py-3 rounded-xl hover:bg-cyan-400 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {joining ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entering Room…
                    </>
                  ) : (
                    <>
                      <span>Enter Battle Lobby</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          )}

          {/* TAB 3: BATTLE HISTORY */}
          {activeTab === "history" && (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Your Battle History</h2>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Past multiplayer battles and results.
                </p>
              </div>

              {loadingBattles ? (
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading battle history…
                </div>
              ) : recentBattles.length === 0 ? (
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-12 text-center text-slate-500 text-xs">
                  No battles found. Host or join a battle to see results here!
                </div>
              ) : (
                <div className="space-y-2">
                  {recentBattles.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => router.push(`/arena/${b.code}`)}
                      className="bg-[#141414] border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 font-mono text-xs font-bold">
                          {b.code}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{b.title}</p>
                          <p className="text-xs text-slate-500">
                            {b.questionCount} Questions • {Math.round(b.durationSeconds / 60)}m
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                            b.status === "completed"
                              ? "bg-green-500/10 text-green-400"
                              : b.status === "in_progress"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-cyan-500/10 text-cyan-400"
                          }`}
                        >
                          {b.status}
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
