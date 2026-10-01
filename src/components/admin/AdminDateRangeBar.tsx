"use client";

import { CalendarRange, Download } from "lucide-react";

import { useAdminAnalytics } from "@/context/admin-analytics-context";
import { ADMIN_RANGE_PRESETS, type AdminRangePreset } from "@/lib/admin/analytics-range";

export function AdminDateRangeBar() {
  const range = useAdminAnalytics();
  const exportUrl = (format: "csv" | "json") => `/api/admin/exports?dataset=summary&format=${format}&${range.queryString}`;

  return (
    <div className="border-b border-white/5 bg-[#111111] px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-3">
        <label className="min-w-44 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Reporting period
          <select
            value={range.preset}
            onChange={(event) => range.setPreset(event.target.value as AdminRangePreset)}
            className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-500/60"
          >
            {ADMIN_RANGE_PRESETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        {range.preset === "custom" && (
          <>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Start
              <input type="datetime-local" value={range.customStart} onChange={(event) => range.setCustomStart(event.target.value)} className="mt-1 block h-9 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs normal-case text-slate-200 [color-scheme:dark]" />
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              End
              <input type="datetime-local" value={range.customEnd} onChange={(event) => range.setCustomEnd(event.target.value)} className="mt-1 block h-9 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs normal-case text-slate-200 [color-scheme:dark]" />
            </label>
          </>
        )}

        <label className="min-w-40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Timezone
          <input value={range.timezone} onChange={(event) => range.setTimezone(event.target.value)} list="admin-timezones" className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs normal-case tracking-normal text-slate-200" />
          <datalist id="admin-timezones">
            <option value="UTC" /><option value="Africa/Lagos" /><option value="Europe/London" /><option value="America/New_York" /><option value="America/Los_Angeles" /><option value="Asia/Dubai" />
          </datalist>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[10px] text-slate-500 lg:flex"><CalendarRange className="h-3.5 w-3.5" /> UTC storage · local reporting</span>
          <a href={exportUrl("csv")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"><Download className="h-3.5 w-3.5" /> CSV</a>
          <a href={exportUrl("json")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"><Download className="h-3.5 w-3.5" /> JSON</a>
        </div>
      </div>
    </div>
  );
}
