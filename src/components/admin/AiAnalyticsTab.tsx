"use client";

import { useEffect, useState } from "react";
import { Cpu, DollarSign, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";

type AiStats = {
  totalRequests: number;
  successRate: number;
  totalTokens: number;
  estimatedCost: number;
  modelCounts: Record<string, number>;
  monthlyTrends: Array<{ date: string; cost: number }>;
};

export function AiAnalyticsTab() {
  const [stats, setStats] = useState<AiStats>({
    totalRequests: 0,
    successRate: 100.0,
    totalTokens: 0,
    estimatedCost: 0.0,
    modelCounts: {},
    monthlyTrends: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [statsRes, analyticsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/analytics")
        ]);
        
        if (!statsRes.ok || !analyticsRes.ok) {
          throw new Error("Failed to load statistics from admin services.");
        }

        const statsJson = await statsRes.json();
        const analyticsJson = await analyticsRes.json();

        if (!statsJson.success) throw new Error(statsJson.error || "Failed to load stats");
        if (!analyticsJson.success) throw new Error(analyticsJson.error || "Failed to load analytics");

        let updatedStats = { ...stats };

        if (statsJson.data) {
          const s = statsJson.data;
          updatedStats.totalRequests = s.ai_requests || 0;
          updatedStats.estimatedCost = s.ai_cost || 0;
          updatedStats.totalTokens = Number(s.total_tokens) || 0;
          updatedStats.successRate = Number(s.success_rate) || 100.0;
        }

        if (analyticsJson.data) {
          const a = analyticsJson.data;
          if (a.modelCounts) {
            updatedStats.modelCounts = a.modelCounts;
          }
          if (a.costTrends && Array.isArray(a.costTrends)) {
            updatedStats.monthlyTrends = a.costTrends;
          }
        }

        setStats(updatedStats);
        setError(null);
      } catch (err: any) {
        console.warn("[ai-analytics] failed to load live stats:", err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
          <div className="text-2xl font-bold text-white mt-1.5">{loading ? "..." : stats.totalRequests.toLocaleString()}</div>
          <p className="text-[10px] text-slate-500 mt-1">Queries submitted to API</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Success Rate</span>
          <div className="text-2xl font-bold text-cyan-400 mt-1.5">{loading ? "..." : `${stats.successRate}%`}</div>
          <p className="text-[10px] text-emerald-500 mt-1">Errors cached & handled</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Total Tokens</span>
          <div className="text-2xl font-bold text-white mt-1.5">{loading ? "..." : stats.totalTokens.toLocaleString()}</div>
          <p className="text-[10px] text-slate-500 mt-1">Prompt + Completion</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Estimated Cost</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5">{loading ? "..." : `$${stats.estimatedCost.toFixed(4)}`}</div>
          <p className="text-[10px] text-slate-500 mt-1">USD equivalent pricing</p>
        </div>
      </div>

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
            {stats.monthlyTrends.map((trend, idx) => {
              const maxVal = Math.max(...stats.monthlyTrends.map((t) => t.cost), 0.1);
              const heightPct = (trend.cost / maxVal) * 100;
              return (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                  {/* Tooltip */}
                  <div className="absolute bottom-[160px] opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] text-white z-10 font-bold">
                    ${trend.cost.toFixed(2)}
                  </div>
                  {/* Bar */}
                  <div className="w-8 bg-gradient-to-t from-cyan-600/30 to-cyan-400 rounded-md transition-all duration-300 hover:brightness-110" style={{ height: `${Math.max(8, heightPct)}px` }} />
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
            {Object.entries(stats.modelCounts).map(([model, count], idx) => {
              const total = Object.values(stats.modelCounts).reduce((a, b) => a + b, 0);
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
