"use client";

import { useEffect, useState } from "react";
import { Cpu, DollarSign, AlertTriangle } from "lucide-react";
import { metricCounts, metricNumber } from "./metric-values";

type AiStats = {
  totalRequests: number | null; successRate: number | null; totalTokens: number | null;
  estimatedCost: number | null; unknown: number | null; simulated: number | null; costUnavailable: number | null;
  modelCounts: Record<string, number>; monthlyTrends: Array<{ date: string; cost: number | null }>;
};

export function AiAnalyticsTab() {
  const [stats, setStats] = useState<AiStats | null>(null);
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
        if (responses.some(response => !response.ok)) throw new Error('Unable to load AI measurements.');
        const [summary, analytics] = await Promise.all(responses.map(response => response.json()));
        if (!summary.success || !summary.data || !analytics.success || !analytics.data) throw new Error('AI measurements are unavailable.');
        const s = summary.data, a = analytics.data;
        if (!controller.signal.aborted) setStats({
          totalRequests: metricNumber(s.ai_requests), successRate: metricNumber(s.success_rate),
          totalTokens: metricNumber(s.total_tokens), estimatedCost: metricNumber(s.ai_cost),
          unknown: metricNumber(s.ai_unknown), simulated: metricNumber(s.ai_simulated), costUnavailable: metricNumber(s.ai_cost_unavailable),
          modelCounts: metricCounts(a.modelCounts),
          monthlyTrends: Array.isArray(a.costTrends) ? a.costTrends.map((trend: { date: string; cost: unknown }) => ({ date: trend.date, cost: metricNumber(trend.cost) })) : [],
        });
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'AI measurements are unavailable.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, []);
  const count = (value: number | null | undefined) => loading ? '…' : value == null ? 'N/A' : value.toLocaleString();
  const trends = stats?.monthlyTrends ?? [];
  const models = stats?.modelCounts ?? {};

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><strong>API Query Failed:</strong> {error}</span>
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">AI Compute & Model Expenses</h2>
        <p className="text-slate-400 text-xs mt-1">
          Monitor token counts, pipeline invocation status, and estimated running Gemini API cost.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* KPI blocks */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">AI Requests</span>
          <div className="text-2xl font-bold text-white mt-1.5">{count(stats?.totalRequests)}</div>
          <p className="text-[10px] text-slate-500 mt-1">Decided provider outcomes</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Success Rate</span>
          <div className="text-2xl font-bold text-cyan-400 mt-1.5">{loading ? "…" : stats?.successRate == null ? "N/A" : `${stats.successRate}%`}</div>
          <p className="text-[10px] text-emerald-500 mt-1">Succeeded / decided outcomes</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Total Tokens</span>
          <div className="text-2xl font-bold text-white mt-1.5">{count(stats?.totalTokens)}</div>
          <p className="text-[10px] text-slate-500 mt-1">Prompt + Completion</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Estimated Cost</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5">{loading ? "…" : stats?.estimatedCost == null ? "N/A" : `$${stats.estimatedCost.toFixed(4)}`}</div>
          <p className="text-[10px] text-slate-500 mt-1">Versioned USD estimate; unknown costs stay unavailable</p>
        </div>
      </div>

      <p className="text-xs text-slate-400">Unknown provider outcomes: {count(stats?.unknown)} · Simulated: {count(stats?.simulated)} · Rows without an available cost estimate: {count(stats?.costUnavailable)}. Unknown and simulated outcomes are excluded from the success rate.</p>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Cost trends bar graph */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md md:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Daily Cost Trend</h3>
            </div>
            <span className="text-xs text-slate-500">USD last 7 days</span>
          </div>

          {/* Simple custom SVG Cost Bars */}
          <div className="flex items-end justify-between h-[150px] pt-6 pb-2 px-2 relative">
            {!loading && trends.length === 0 && <p className="text-xs text-slate-500">No cost measurements available.</p>}
            {trends.map((trend) => {
              const maxVal = Math.max(...trends.map((t) => t.cost ?? 0), 0.1);
              const heightPct = ((trend.cost ?? 0) / maxVal) * 100;
              return (
                <div key={trend.date} className="flex flex-col items-center flex-1 group">
                  {/* Tooltip */}
                  <div className="absolute bottom-[160px] opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] text-white z-10 font-bold">
                    {trend.cost == null ? "N/A" : `$${trend.cost.toFixed(2)}`}
                  </div>
                  {/* Bar */}
                  <div className="w-8 bg-gradient-to-t from-cyan-600/30 to-cyan-400 rounded-md transition-all duration-300 hover:brightness-110" style={{ height: `${trend.cost == null ? 0 : Math.max(0, heightPct)}px` }} />
                  <span className="text-[10px] text-slate-500 mt-2 font-medium">{trend.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model distribution lists */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Model Distribution</h3>
          </div>

          <div className="space-y-4">
            {Object.entries(models).map(([model, count]) => {
              const total = Object.values(models).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={model} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-300">{model}</span>
                    <span className="text-slate-500 font-medium">{count} requests</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0a0a0a] rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
