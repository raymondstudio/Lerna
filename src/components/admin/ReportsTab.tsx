"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, FileBarChart, Loader2 } from "lucide-react";

import { useAdminAnalytics } from "@/context/admin-analytics-context";
import { ADMIN_METRIC_DEFINITIONS } from "@/lib/admin/metric-definitions";

type MetricValue = number | null;
type ReportData = {
  range: { label: string; start_at: string; end_at: string; timezone: string; bucket: string };
  metrics: Record<string, MetricValue>;
  comparison: { metrics: Record<string, MetricValue> } | null;
  series: Array<Record<string, number | string>>;
  breakdowns: { traffic_sources: Array<{ source: string; users: number }>; revenue_by_currency: Array<{ currency: string; amount: number; payments: number }> };
  coverage: Record<string, string | null>;
  limitations: string[];
};

const KPI_CONFIG = [
  ["new_users", "New users", "number"], ["active_users", "Active users", "number"], ["returning_users", "Returning users", "number"],
  ["unique_chat_users", "Unique chat users", "number"], ["total_messages", "Messages", "number"], ["messages_per_chat_user", "Messages / chat user", "decimal"],
  ["study_sessions", "Study sessions", "number"], ["study_time_seconds", "Study time", "duration"], ["uploads", "Documents uploaded", "number"],
  ["quiz_attempts", "Quiz attempts", "number"], ["ai_requests", "AI requests", "number"], ["ai_estimated_cost", "Estimated AI cost", "currency"],
] as const;
const EXPORT_DATASETS = ["users", "user_activity", "messages", "study_sessions", "uploads", "ai_usage", "marketing", "quiz_analytics", "subscriptions", "payments"] as const;

function formatMetric(value: MetricValue, type: string) {
  if (value === null || value === undefined) return "Not available";
  if (type === "currency") return `$${Number(value).toFixed(4)}`;
  if (type === "decimal") return Number(value).toFixed(2);
  if (type === "duration") return Number(value) >= 3600 ? `${(Number(value) / 3600).toFixed(1)}h` : `${Math.round(Number(value) / 60)}m`;
  return Number(value).toLocaleString();
}

function comparison(current: MetricValue, previous: MetricValue) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function ReportsTab() {
  const { queryString, refreshToken } = useAdminAnalytics();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<(typeof EXPORT_DATASETS)[number]>("messages");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/admin/analytics?${queryString}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load report.");
        setData(payload.data);
        setError(null);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [queryString, refreshToken]);

  const maxMessages = useMemo(() => Math.max(1, ...(data?.series ?? []).map((point) => Number(point.messages ?? 0))), [data]);
  const period = data?.range ? `${new Date(data.range.start_at).toLocaleString([], { timeZone: data.range.timezone })} – ${new Date(data.range.end_at).toLocaleString([], { timeZone: data.range.timezone })}` : "";
  const exportUrl = (format: "csv" | "json") => `/api/admin/exports?dataset=${dataset}&format=${format}&${queryString}`;

  if (loading && !data) return <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-cyan-400" /> Loading historical report…</div>;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><FileBarChart className="h-5 w-5 text-cyan-400" /><h2 className="text-xl font-semibold text-white">Lerna AI — Growth Report</h2></div><p className="mt-1 text-xs text-slate-400">{data?.range.label ?? "Selected period"} · {period}</p><p className="mt-1 text-[10px] text-slate-500">Half-open range [start, end) · timestamps stored in UTC · buckets rendered in {data?.range.timezone ?? "the selected timezone"}</p></div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
      </div>
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CONFIG.map(([key, label, type]) => {
          const value = data?.metrics?.[key] ?? null;
          const prior = data?.comparison?.metrics?.[key] ?? null;
          const delta = comparison(value, prior);
          return <div key={key} className="rounded-2xl border border-white/5 bg-[#141414]/60 p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-white">{formatMetric(value, type)}</div><div className="mt-1 min-h-4 text-[10px]">{!data?.comparison ? <span className="text-slate-600">No comparison for All Time</span> : delta === null ? <span className="text-slate-500">No valid prior baseline</span> : <span className={`inline-flex items-center gap-1 ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs prior period</span>}</div></div>;
        })}
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#141414]/60 p-5">
        <div className="mb-5"><h3 className="text-sm font-semibold text-white">Messages and active chat users</h3><p className="text-[10px] text-slate-500">Adaptive {data?.range.bucket ?? "time"} buckets</p></div>
        <div className="flex h-48 items-end gap-1 overflow-x-auto border-b border-white/5 pb-1">{(data?.series ?? []).map((point) => { const messages = Number(point.messages ?? 0); const users = Number(point.unique_chat_users ?? 0); return <div key={String(point.start_at)} className="flex min-w-3 flex-1 items-end gap-px" title={`${messages} messages, ${users} chat users`}><div className="w-2/3 rounded-t bg-cyan-500/70" style={{ height: `${Math.max(2, (messages / maxMessages) * 100)}%` }} /><div className="w-1/3 rounded-t bg-violet-400/80" style={{ height: `${Math.max(2, (users / maxMessages) * 100)}%` }} /></div>; })}</div>
        <div className="mt-3 flex gap-4 text-[10px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan-500/70" />Messages</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-400/80" />Unique chat users</span></div>
      </div>

      <ReportDetails data={data} dataset={dataset} setDataset={setDataset} exportUrl={exportUrl} />
    </div>
  );
}

function ReportDetails({
  data,
  dataset,
  setDataset,
  exportUrl,
}: {
  data: ReportData | null;
  dataset: (typeof EXPORT_DATASETS)[number];
  setDataset: (value: (typeof EXPORT_DATASETS)[number]) => void;
  exportUrl: (format: "csv" | "json") => string;
}) {
  return <>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/5 bg-[#141414]/60 p-5">
        <h3 className="text-sm font-semibold text-white">Traffic sources</h3>
        <div className="mt-4 space-y-2 text-xs">{(data?.breakdowns?.traffic_sources ?? []).length ? data?.breakdowns.traffic_sources.map((item) => <div key={item.source} className="flex justify-between rounded-lg bg-black/20 px-3 py-2"><span className="text-slate-300">{item.source}</span><strong className="text-cyan-300">{item.users.toLocaleString()}</strong></div>) : <p className="text-slate-500">No attribution rows in this period.</p>}</div>
      </div>
      <div className="rounded-2xl border border-white/5 bg-[#141414]/60 p-5">
        <h3 className="text-sm font-semibold text-white">Revenue by currency</h3>
        <div className="mt-4 space-y-2 text-xs">{(data?.breakdowns?.revenue_by_currency ?? []).length ? data?.breakdowns.revenue_by_currency.map((item) => <div key={item.currency} className="flex justify-between rounded-lg bg-black/20 px-3 py-2"><span className="text-slate-300">{item.currency} · {item.payments} payments</span><strong className="text-emerald-300">{Number(item.amount).toLocaleString()}</strong></div>) : <p className="text-slate-500">No successful payments in this period.</p>}</div>
      </div>
    </div>

    <div className="rounded-2xl border border-white/5 bg-[#141414]/60 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Detailed export<select value={dataset} onChange={(event) => setDataset(event.target.value as typeof dataset)} className="mt-1 block h-9 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs normal-case text-slate-200">{EXPORT_DATASETS.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
        <a href={exportUrl("csv")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 text-xs font-bold text-black hover:bg-cyan-400"><Download className="h-3.5 w-3.5" /> Export CSV</a>
        <a href={exportUrl("json")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:text-white"><Download className="h-3.5 w-3.5" /> Export JSON</a>
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/5 bg-[#141414]/60 p-5"><h3 className="text-sm font-semibold text-white">Data coverage</h3><div className="mt-3 space-y-2 text-[11px]">{Object.entries(data?.coverage ?? {}).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><span className="capitalize text-slate-400">{key.replaceAll("_", " ")}</span><span className="text-right text-slate-300">{value ? new Date(value).toLocaleString([], { timeZone: data?.range.timezone }) : "No records yet"}</span></div>)}</div></div>
      <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-5"><h3 className="text-sm font-semibold text-amber-200">Known reporting limits</h3><ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-amber-100/60">{(data?.limitations ?? []).map((item) => <li key={item}>• {item}</li>)}</ul></div>
    </div>

    <details className="rounded-xl border border-white/5 bg-black/20 p-4 text-[11px] text-slate-400"><summary className="cursor-pointer font-semibold text-slate-300">KPI definitions and authoritative sources</summary><div className="mt-3 grid gap-2 md:grid-cols-2">{Object.entries(ADMIN_METRIC_DEFINITIONS).map(([key, definition]) => <div key={key}><strong className="text-slate-300">{key.replaceAll("_", " ")}:</strong> {definition.definition} <span className="text-cyan-400/70">{definition.source}.{definition.timestamp}</span></div>)}</div></details>
  </>;
}
