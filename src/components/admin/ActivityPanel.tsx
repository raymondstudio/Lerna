"use client";
import { ExportLink } from "@/components/admin/ExportLink";
import { useEffect, useMemo, useState } from "react";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { CATEGORIES, OUTCOMES, SEVERITIES } from "@/lib/activity/contracts";
import type { ActivitySource } from "@/lib/activity/environment";
import { parseAdminAnalyticsRange } from "@/lib/admin/analytics-range";

function wallTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}
const control = "rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400";
const filterOptions: ReadonlyArray<readonly [string, readonly string[]]> = [["category", CATEGORIES], ["outcome", OUTCOMES], ["severity", SEVERITIES]];
export function ActivityPanel({ userId, compact = false }: { userId?: string; compact?: boolean }) {
  const [sources, setSources] = useState<ActivitySource[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState("");
  const [range, setRange] = useState("3h");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [customStart, setCustomStart] = useState(() => wallTime(new Date(Date.now() - 86400000), "Africa/Lagos"));
  const [customEnd, setCustomEnd] = useState(() => wallTime(new Date(), "Africa/Lagos"));
  const [filters, setFilters] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/activity/sources", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error ?? "Activity sources unavailable.");
      setSources(body.data.sources); setEnvironment(body.data.current);
    }).catch((error) => { if (!controller.signal.aborted) setSourceError(error instanceof Error ? error.message : "Activity sources unavailable."); });
    return () => controller.abort();
  }, []);
  const selection = useMemo(() => {
    const params = new URLSearchParams({ range, timezone, limit: compact ? "10" : "50", summary: compact ? "false" : "true" });
    if (environment) params.set("environment", environment);
    if (userId) params.set("user_id", userId);
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      if (range === "custom") {
        const resolved = parseAdminAnalyticsRange(new URLSearchParams({ range: "custom", timezone, start_at: customStart, end_at: customEnd }));
        params.set("start_at", resolved.startAt); params.set("end_at", resolved.endAt);
      }
      return { query: params.toString(), error: null };
    } catch (error) { return { query: "range=3h&limit=10", error: error instanceof Error ? error.message : "Invalid date range." }; }
  }, [environment, range, timezone, compact, userId, filters, customStart, customEnd]);
  const feed = useActivityFeed(selection.query, "/api/admin/events", !selection.error);
  return <section className="space-y-4" aria-label={userId ? "User activity timeline" : "Activity investigation"}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-100">{userId ? "User activity timeline" : "Activity"}</h3>
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-slate-400">Environment <select aria-label="Activity environment" className={control} value={environment} onChange={(event) => setEnvironment(event.target.value)}>{!environment && <option value="">Loading sources…</option>}{sources.map((source) => <option key={source.environment} value={source.environment} disabled={!source.available}>{source.environment}{source.available ? "" : " — unavailable"}</option>)}</select></label>
        <label className="text-xs text-slate-400">Range <select aria-label="Activity range" className={control} value={range} onChange={(event) => setRange(event.target.value)}>{[["3h", "3 hours"], ["24h", "1 day"], ["3d", "3 days"], ["7d", "7 days"], ["30d", "30 days"], ["custom", "Custom"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
    </div>
    {!compact && <>
      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        <label>Timezone <select className={control} value={timezone} onChange={(event) => setTimezone(event.target.value)}><option>Africa/Lagos</option><option>UTC</option><option>America/New_York</option><option>Europe/London</option><option>Asia/Kolkata</option></select></label>
        {range === "custom" && <><label>Start <input type="datetime-local" className={control} value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>End <input type="datetime-local" className={control} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setFilters(Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>); }}>
        {!userId && <input aria-label="Filter by user ID" name="user_id" placeholder="User UUID" className={control} />}
        {filterOptions.map(([name, options]) => <select key={name} name={name} aria-label={`Filter ${name}`} className={control}><option value="">All {name}</option>{options.map((value) => <option key={value}>{value}</option>)}</select>)}
        <input aria-label="Filter normalized route" name="route" placeholder="Route, e.g. /notes" className={control} />
        <input aria-label="Filter request correlation" name="request_id" placeholder="Request UUID" className={control} />
        <input aria-label="Filter activity correlation" name="activity_id" placeholder="Activity UUID" className={control} />
        <button className={control} type="submit">Apply filters</button>
      </form>
    </>}
    <div className="flex flex-wrap gap-3 text-xs text-slate-400" aria-live="polite">
      <span>{feed.connection}</span><span>Last updated: {feed.data ? new Date(feed.data.lastUpdated).toLocaleString("en-GB", { timeZone: timezone }) : "Pending"} ({timezone})</span>
      <button type="button" className="text-cyan-300 underline" onClick={feed.refresh}>Refresh</button>
    </div>
    {(sourceError || selection.error || feed.error) && <p role="alert" className="rounded-lg border border-amber-500/30 p-3 text-xs text-amber-200">{sourceError ?? selection.error ?? feed.error} {feed.data ? "Previously loaded events may be stale." : "Events could not be loaded."}</p>}
    {!compact && feed.data?.summary && <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 md:grid-cols-5">{Object.entries({ "Events": feed.data.summary.total, "Successful note writes": feed.data.summary.successfulNoteWrites, "Successful live AI requests": feed.data.summary.successfulAiRequests, "Failed outcomes": feed.data.summary.failed, "Reported route views": feed.data.summary.reportedViews }).map(([label, count]) => <div key={label} className="rounded-lg border border-white/10 p-3"><span className="block text-slate-400">{label}</span><strong className="text-lg text-white">{count}</strong></div>)}</div>}
    {feed.loading && !feed.data && <p className="text-xs text-slate-400">Loading activity…</p>}
    {!feed.loading && !feed.error && feed.data?.events.length === 0 && <p className="py-6 text-xs text-slate-400">No events match these filters. Page views are retained for 30 days; operational events for 90 days.</p>}
    <ol className="max-h-[480px] space-y-2 overflow-y-auto">
      {feed.data?.events.map((event) => <li key={`${event.environment}:${event.id}`} className="rounded-lg border border-white/10 p-3 text-xs text-slate-300">
        <div className="flex flex-wrap justify-between gap-2"><strong className="break-all text-slate-100">{event.event_type}</strong><time dateTime={event.received_at}>{new Date(event.received_at).toLocaleString("en-GB", { timeZone: timezone })}</time></div>
        <p className="mt-1 break-all text-slate-400">{event.environment} · {event.outcome} · {event.severity} · {event.source}{event.route ? ` · ${event.route}` : ""}</p>
        {!compact && <p className="mt-1 break-all text-slate-500">Actor: {event.user_id ?? "System / deleted account"}{event.request_id ? ` · Request: ${event.request_id}` : ""}{event.activity_id ? ` · Activity: ${event.activity_id}` : ""}</p>}
      </li>)}
    </ol>
    <div className="flex flex-wrap gap-3 text-xs">
      {feed.data?.nextCursor && <button type="button" className={control} onClick={feed.older}>Older events</button>}
      {feed.historical && <button type="button" className={control} onClick={feed.live}>Back to live</button>}
      {!compact && !selection.error && <><ExportLink className={control} href={`/api/admin/exports?dataset=user_activity&format=csv&${selection.query}`}>Export CSV</ExportLink><ExportLink className={control} href={`/api/admin/exports?dataset=user_activity&format=json&${selection.query}`}>Export JSON</ExportLink></>}
    </div>
    {!compact && <p className="text-xs text-slate-500">Reported page views do not prove reading or learning. Successful operations count persisted outcomes; retries are deduplicated. Exports require MFA and contain at most 10,000 events. Unconfigured sources remain unavailable.</p>}
  </section>;
}
