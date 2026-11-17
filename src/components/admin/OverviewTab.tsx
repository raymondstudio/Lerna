"use client";

import { useAdminData } from "./use-admin-data";
import { metricNumber } from "./metric-values";
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  UploadCloud, 
  Cpu, 
  Coins, 
  Calendar,
  Image as ImageIcon,
  AlertTriangle
} from "lucide-react";
import { ActivityPanel } from "./ActivityPanel";

type KpiStats = {
  totalUsers: number | null;
  totalProfiles: number | null;
  newUsersToday: number | null;
  activeUsersToday: number | null;
  mau: number | null;
  totalSessions: number | null;
  totalMessages: number | null;
  totalDocs: number | null;
  totalImages: number | null;
  aiRequests: number | null;
  aiCost: number | null;
  revenue: number | null;
  premiumUsers: number | null;
  countries: Array<{ label: string; value: number }>;
  universities: Array<{ label: string; value: number }>;
  departments: Array<{ label: string; value: number }>;
};

function groups(value: unknown): Array<{ label: string; value: number }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { label: string; value: number } => item && typeof item.label === "string" && typeof item.value === "number");
}

export function OverviewTab() {
  const { data: raw, loading, error, reload: fetchKPIStats } = useAdminData<Record<string, unknown>>("/api/admin/stats");
  const stats: KpiStats = {
    totalUsers: metricNumber(raw?.total_users),
    totalProfiles: metricNumber(raw?.total_profiles),
    newUsersToday: metricNumber(raw?.new_users_today),
    activeUsersToday: metricNumber(raw?.active_users_today),
    mau: metricNumber(raw?.mau),
    totalSessions: metricNumber(raw?.total_sessions),
    totalMessages: metricNumber(raw?.total_messages),
    totalDocs: metricNumber(raw?.total_docs),
    totalImages: metricNumber(raw?.total_images),
    aiRequests: metricNumber(raw?.ai_requests),
    aiCost: metricNumber(raw?.ai_cost),
    revenue: metricNumber(raw?.revenue),
    premiumUsers: metricNumber(raw?.premium_users),
    countries: groups(raw?.countries), universities: groups(raw?.universities), departments: groups(raw?.departments),
  };
  const kpis = [
    { name: "Total Users", value: stats.totalUsers, icon: Users, desc: "Total database accounts" },
    { name: "New Today", value: stats.newUsersToday, icon: Calendar, desc: "Created last 24h" },
    { name: "Active Today", value: stats.activeUsersToday, icon: Users, desc: "Last active 24h" },
    { name: "Monthly Active", value: stats.mau, icon: Users, desc: "Last active 30d" },
    
    { name: "Study Sessions", value: stats.totalSessions, icon: BookOpen, desc: "Total study workspaces" },
    { name: "Total Chats", value: stats.totalMessages, icon: MessageSquare, desc: "Total messages logged" },
    { name: "Uploaded Docs", value: stats.totalDocs, icon: UploadCloud, desc: "Uploaded study materials" },
    { name: "Uploaded Images", value: stats.totalImages, icon: ImageIcon, desc: "OCR uploaded images" },
    
    { name: "AI Requests", value: stats.aiRequests, icon: Cpu, desc: "Total Gemini calls" },
    { name: "Estimated AI Cost", value: stats.aiCost === null ? "Unavailable" : `$${stats.aiCost.toFixed(4)}`, icon: Coins, desc: "Known standard-provider token estimates" },
    { name: "Revenue", value: stats.revenue === null ? "Unavailable" : String(stats.revenue), icon: Coins, desc: "Successful payments; see currency report", highlight: true },
    { name: "Premium Users", value: stats.premiumUsers, icon: Users, desc: "Paid premium accounts", highlight: true },
  ];

  return (
    <div className="space-y-8">
      {/* Top Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">System Performance & KPIs</h2>
          <p className="text-slate-400 text-xs mt-1">Aggregated statistics and usage metrics across core microservices.</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
          Activity available below
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><strong>API Query Failed:</strong> {error}</span>
        </div>
      )}

      {/* Counts mismatch warning */}
      {!loading && stats.totalUsers !== null && stats.totalProfiles !== null && stats.totalUsers !== stats.totalProfiles && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 animate-pulse" />
          <span>
            <strong>Data Integrity Alert:</strong> There is a discrepancy between auth user registrations ({stats.totalUsers}) and profile records ({stats.totalProfiles}). This indicates a pending onboarding/backfill repair.
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx} 
              className={`p-5 rounded-2xl border transition-all bg-[#141414]/50 backdrop-blur-md hover:border-white/10 ${
                kpi.highlight ? "border-cyan-500/20" : "border-white/5"
              }`}
            >
              <div className="flex justify-between items-center gap-3">
                <span className="text-xs text-slate-400 font-semibold">{kpi.name}</span>
                <Icon className={`h-4.5 w-4.5 ${kpi.highlight ? "text-cyan-400" : "text-slate-500"}`} />
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {loading ? "..." : error ? "Unavailable" : kpi.value}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{kpi.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#141414]/50 p-5">
        <ActivityPanel compact />
      </div>
      {/* Demographics Distributions Row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Universities Card */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-semibold text-white">Active Universities</h3>
          <div className="space-y-2 text-xs">
            {stats.universities.length === 0 ? (
              <p className="text-slate-500 italic">No university metrics recorded.</p>
            ) : (
              stats.universities.map(u => (
                <div key={u.label} className="flex justify-between items-center bg-[#0a0a0a]/30 p-2 rounded-lg">
                  <span className="text-slate-300 font-medium truncate max-w-[180px]">{u.label || "Direct"}</span>
                  <span className="text-cyan-400 font-bold">{u.value} users</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Departments Card */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-semibold text-white">Course Departments</h3>
          <div className="space-y-2 text-xs">
            {stats.departments.length === 0 ? (
              <p className="text-slate-500 italic">No department metrics recorded.</p>
            ) : (
              stats.departments.map(d => (
                <div key={d.label} className="flex justify-between items-center bg-[#0a0a0a]/30 p-2 rounded-lg">
                  <span className="text-slate-300 font-medium truncate max-w-[180px]">{d.label}</span>
                  <span className="text-cyan-400 font-bold">{d.value} users</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Countries Card */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-semibold text-white">Geographic Demographics</h3>
          <div className="space-y-2 text-xs">
            {stats.countries.length === 0 ? (
              <p className="text-slate-500 italic">No geographic metrics recorded.</p>
            ) : (
              stats.countries.map(c => (
                <div key={c.label} className="flex justify-between items-center bg-[#0a0a0a]/30 p-2 rounded-lg">
                  <span className="text-slate-300 font-medium">{c.label}</span>
                  <span className="text-cyan-400 font-bold">{c.value} users</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
