"use client";

import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, CheckSquare, Clock } from "lucide-react";

type LearningStats = {
  totalSessions: number;
  totalMessages: number;
  totalDocs: number;
  totalImages: number;
  avgDurationMinutes: number;
  quizAccuracy: number;
  categoryDistribution: Record<string, number>;
  totalQuizQuestions: number;
  correctAnswers: number;
};

export function LearningAnalyticsTab() {
  const [stats, setStats] = useState<LearningStats>({
    totalSessions: 0,
    totalMessages: 0,
    totalDocs: 0,
    totalImages: 0,
    avgDurationMinutes: 0,
    quizAccuracy: 0,
    categoryDistribution: {},
    totalQuizQuestions: 0,
    correctAnswers: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [statsRes, analyticsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/analytics")
        ]);
        const statsJson = await statsRes.json();
        const analyticsJson = await analyticsRes.json();

        let updatedStats = { ...stats };

        if (statsJson.success && statsJson.data) {
          const s = statsJson.data;
          updatedStats.totalSessions = s.total_sessions || 0;
          updatedStats.totalMessages = s.total_messages || 0;
          updatedStats.totalDocs = s.total_docs || 0;
          updatedStats.totalImages = s.total_images || 0;
        }

        if (analyticsJson.success && analyticsJson.data) {
          const a = analyticsJson.data;
          updatedStats.avgDurationMinutes = Number(a.avgDurationMinutes) || 0;
          updatedStats.quizAccuracy = Number(a.quizAccuracy) || 0;
          updatedStats.totalQuizQuestions = Number(a.totalQuizQuestions) || 0;
          updatedStats.correctAnswers = Number(a.correctAnswers) || 0;
          if (a.categoryDistribution) {
            updatedStats.categoryDistribution = a.categoryDistribution;
          }
        }

        setStats(updatedStats);
      } catch (err) {
        console.warn("[learning-analytics] failed to load live stats:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Academic & Learning Analytics</h2>
        <p className="text-slate-400 text-xs mt-1">
          Review metrics regarding study sessions, courses, document scan uploads, and quiz question accuracy rates.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* KPI Summaries */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Study Sessions</span>
          <div className="text-2xl font-bold text-white mt-1.5">{loading ? "..." : stats.totalSessions}</div>
          <p className="text-[10px] text-slate-500 mt-1">Total active workspaces</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Tutor Chats</span>
          <div className="text-2xl font-bold text-white mt-1.5">{loading ? "..." : stats.totalMessages}</div>
          <p className="text-[10px] text-slate-500 mt-1">Total academic prompts log</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Scanned Materials</span>
          <div className="text-2xl font-bold text-white mt-1.5">{loading ? "..." : (stats.totalDocs + stats.totalImages)}</div>
          <p className="text-[10px] text-slate-500 mt-1">
            {stats.totalDocs} PDFs / {stats.totalImages} Images
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Avg. Session Time</span>
          <div className="text-2xl font-bold text-cyan-400 mt-1.5">{loading ? "..." : `${stats.avgDurationMinutes}m`}</div>
          <p className="text-[10px] text-slate-500 mt-1">Minutes per active session</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Category breakdown bar charts */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md md:col-span-3 space-y-5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Popular Topic Categories</h3>
          </div>

          <div className="space-y-4">
            {Object.keys(stats.categoryDistribution).length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">No topic data available</p>
            ) : (
              Object.entries(stats.categoryDistribution).map(([category, count], idx) => {
                const total = Object.values(stats.categoryDistribution).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{category}</span>
                      <span className="text-slate-500 font-medium">
                        {count} sessions ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#0a0a0a] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right side stats */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md md:col-span-2 space-y-6 flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <GraduationCap className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Quiz Accuracy</h3>
          </div>

          <div className="flex flex-col items-center py-4 space-y-2">
            <div className="text-5xl font-black text-white">{loading ? "..." : `${stats.quizAccuracy}%`}</div>
            <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Average Score Accuracy</div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Quiz Questions</span>
              <span className="text-white font-bold">{loading ? "..." : stats.totalQuizQuestions.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Correct Answers</span>
              <span className="text-cyan-400 font-bold">{loading ? "..." : stats.correctAnswers.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
