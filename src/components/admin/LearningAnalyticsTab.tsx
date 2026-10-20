"use client";

import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, AlertTriangle } from "lucide-react";
import { metricCounts, metricNumber } from "./metric-values";

type LearningStats = {
  totalSessions: number | null; totalMessages: number | null; totalDocs: number | null; totalImages: number | null;
  avgDurationMinutes: number | null; quizAccuracy: number | null; categoryDistribution: Record<string, number>;
  totalQuizQuestions: number | null; correctAnswers: number | null;
};
export function LearningAnalyticsTab() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/admin/stats', { signal: controller.signal, cache: 'no-store' }),
          fetch('/api/admin/analytics', { signal: controller.signal, cache: 'no-store' }),
        ]);
        if (responses.some(response => !response.ok)) throw new Error('Unable to load study and practice measurements.');
        const [summary, analytics] = await Promise.all(responses.map(response => response.json()));
        if (!summary.success || !summary.data || !analytics.success || !analytics.data) throw new Error('Study and practice measurements are unavailable.');
        const s = summary.data, a = analytics.data;
        const questions = metricNumber(a.totalQuizQuestions);
        if (!controller.signal.aborted) setStats({
          totalSessions: metricNumber(s.total_sessions), totalMessages: metricNumber(s.total_messages),
          totalDocs: metricNumber(s.total_docs), totalImages: metricNumber(s.total_images),
          avgDurationMinutes: metricNumber(a.avgDurationMinutes), quizAccuracy: questions ? metricNumber(a.quizAccuracy) : null,
          totalQuizQuestions: questions, correctAnswers: metricNumber(a.correctAnswers), categoryDistribution: metricCounts(a.categoryDistribution),
        });
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Study measurements are unavailable.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, []);
  const count = (value: number | null | undefined) => loading ? '…' : value == null ? 'N/A' : value.toLocaleString();
  const categories = stats?.categoryDistribution ?? {};
  const materials = stats?.totalDocs != null && stats.totalImages != null ? stats.totalDocs + stats.totalImages : null;

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Study & Practice Activity</h2>
        <p className="text-slate-400 text-xs mt-1">
          Review stored study activity and client-reported practice submissions. Practice answers and scores are unverified and do not establish academic achievement.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* KPI Summaries */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Study Sessions</span>
          <div className="text-2xl font-bold text-white mt-1.5">{count(stats?.totalSessions)}</div>
          <p className="text-[10px] text-slate-500 mt-1">Total active workspaces</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Tutor Chats</span>
          <div className="text-2xl font-bold text-white mt-1.5">{count(stats?.totalMessages)}</div>
          <p className="text-[10px] text-slate-500 mt-1">Stored tutor messages</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Scanned Materials</span>
          <div className="text-2xl font-bold text-white mt-1.5">{count(materials)}</div>
          <p className="text-[10px] text-slate-500 mt-1">
            {count(stats?.totalDocs)} documents / {count(stats?.totalImages)} images
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Avg. Session Time</span>
          <div className="text-2xl font-bold text-cyan-400 mt-1.5">{loading ? "…" : stats?.avgDurationMinutes == null ? "N/A" : `${stats.avgDurationMinutes}m`}</div>
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
            {Object.keys(categories).length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">No topic data available</p>
            ) : (
              Object.entries(categories).map(([category, count], idx) => {
                const total = Object.values(categories).reduce((a, b) => a + b, 0);
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
            <h3 className="text-sm font-semibold text-white">Client-reported practice accuracy</h3>
          </div>

          <div className="flex flex-col items-center py-4 space-y-2">
            <div className="text-5xl font-black text-white">{loading ? "…" : stats?.quizAccuracy == null ? "N/A" : `${stats.quizAccuracy}%`}</div>
            <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Unverified practice answers</div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Client-reported practice questions</span>
              <span className="text-white font-bold">{count(stats?.totalQuizQuestions)}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Client-reported correct answers</span>
              <span className="text-cyan-400 font-bold">{count(stats?.correctAnswers)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
