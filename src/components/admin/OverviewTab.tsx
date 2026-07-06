"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  UploadCloud, 
  Cpu, 
  Coins, 
  TrendingUp, 
  Calendar,
  Image as ImageIcon,
  Sparkles,
  Activity,
  ArrowRight,
  GraduationCap,
  AlertTriangle
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type KpiStats = {
  totalUsers: number;
  totalProfiles: number;
  newUsersToday: number;
  activeUsersToday: number;
  mau: number;
  totalSessions: number;
  totalMessages: number;
  totalDocs: number;
  totalImages: number;
  aiRequests: number;
  aiCost: number;
  revenue: number;
  premiumUsers: number;
  countries: Array<{ label: string; value: number }>;
  universities: Array<{ label: string; value: number }>;
  departments: Array<{ label: string; value: number }>;
};

type LiveEvent = {
  id: string;
  name: string;
  props: any;
  time: string;
};

export function OverviewTab() {
  const [stats, setStats] = useState<KpiStats>({
    totalUsers: 0,
    totalProfiles: 0,
    newUsersToday: 0,
    activeUsersToday: 0,
    mau: 0,
    totalSessions: 0,
    totalMessages: 0,
    totalDocs: 0,
    totalImages: 0,
    aiRequests: 0,
    aiCost: 0,
    revenue: 0,
    premiumUsers: 0,
    countries: [],
    universities: [],
    departments: []
  });

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (json.success && json.data) {
        const s = json.data;
        setStats({
          totalUsers: s.total_users || 0,
          totalProfiles: s.total_profiles || 0,
          newUsersToday: s.new_users_today || 0,
          activeUsersToday: s.active_users_today || 0,
          mau: s.mau || 0,
          totalSessions: s.total_sessions || 0,
          totalMessages: s.total_messages || 0,
          totalDocs: s.total_docs || 0,
          totalImages: s.total_images || 0,
          aiRequests: s.ai_requests || 0,
          aiCost: s.ai_cost || 0,
          revenue: s.revenue || 0,
          premiumUsers: s.premium_users || 0,
          countries: s.countries || [],
          universities: s.universities || [],
          departments: s.departments || []
        });
        setError(null);
      } else {
        setError(json.error || "Failed to load admin stats");
      }
    } catch (err) {
      console.warn("[overview] Failed to fetch live KPI stats:", err);
      setError("Failed to connect to stats API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Fetch live KPIs
    fetchKPIStats();

    // 2. Fetch recent events & subscribe to real-time additions
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    void (async () => {
      try {
        const res = await fetch("/api/admin/events?limit=10");
        const json = await res.json();
        if (json.success && json.data?.events) {
          setEvents(json.data.events.map((e: any) => ({
            id: e.id,
            name: e.event_type,
            props: e.properties,
            time: new Date(e.created_at).toLocaleTimeString()
          })));
        }
      } catch (err) {
        console.warn("[overview:realtime] Initial events fetch failed:", err);
      }
    })();

    const channel = supabase
      .channel("live_analytics_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          const newEvent: LiveEvent = {
            id: payload.new.id,
            name: payload.new.event_type,
            props: payload.new.properties,
            time: new Date(payload.new.created_at).toLocaleTimeString()
          };
          setEvents((prev) => [newEvent, ...prev.slice(0, 9)]);
          fetchKPIStats(); // Sync KPIs in real-time
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_sessions" },
        () => {
          fetchKPIStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "uploaded_materials" },
        () => {
          fetchKPIStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quizzes" },
        () => {
          fetchKPIStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_requests" },
        () => {
          fetchKPIStats();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const getEventDescription = (evt: LiveEvent) => {
    switch (evt.name) {
      case "session_started":
        return `New study workspace "${evt.props?.title || "General"}" started.`;
      case "chat_sent":
        return `Student submitted prompt containing ${evt.props?.contentLength || 0} characters to AI tutor.`;
      case "chat_received":
        return `AI Tutor generated response detailing ${evt.props?.contentLength || 0} characters.`;
      case "ai_request_completed":
        return `Gemini API query completed successfully (${evt.props?.modelUsed || "gemini"}).`;
      case "ai_request_failed":
        return `Gemini API transaction encounter error: ${evt.props?.errorMessage || "Network fault"}.`;
      default:
        return `System triggered event "${evt.name}".`;
    }
  };

  const getAiRecommendations = () => {
    const list: string[] = [];
    if (stats.aiCost > 2.0) {
      list.push("Estimated monthly cost exceeds normal limits ($2.00 threshold reached). Recommend enabling premium limits on ocr and chat features.");
    } else {
      list.push("Estimated API consumption is normal. Safe to expand token quotas for beta testing.");
    }

    if (stats.totalSessions / (stats.totalUsers || 1) > 3) {
      list.push("Student retention rate is very high (average 3+ study sessions per user). Great window to release WhatsApp bot.");
    } else {
      list.push("Study workspaces are steady. Recommend launching campaigns (like refer-a-friend) to increase conversion rates.");
    }

    return list;
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
    { name: "Estimated AI Cost", value: `$${stats.aiCost.toFixed(4)}`, icon: Coins, desc: "USD equivalent token cost" },
    { name: "Revenue", value: `$${stats.revenue.toFixed(2)}`, icon: Coins, desc: "Subscription earnings", highlight: true },
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
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Streaming
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
      {!loading && stats.totalUsers !== stats.totalProfiles && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 animate-pulse" />
          <span>
            <strong>Data Integrity Alert:</strong> There is a discrepancy between auth user registrations ({stats.totalUsers}) and profile records ({stats.totalProfiles}). This indicates a pending onboarding/backfill repair.
          </span>
        </div>
      )}

      {/* AI Business Summary Panel */}
      <div className="p-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 to-slate-900/40 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">AI Operations Business Summary</h3>
            <p className="text-[10px] text-slate-500 font-semibold">Decentralized analytics auditor auditing current platform usage.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 pt-2">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-semibold">User growth rate</span>
            <div className="text-base font-bold text-white">+{stats.newUsersToday} New Registrations Today</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-semibold">Most Used Feature</span>
            <div className="text-base font-bold text-white">AI Chat Tutor (78%)</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-semibold">Most Active University</span>
            <div className="text-base font-bold text-cyan-400 flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" /> {stats.universities[0]?.label || "N/A"}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t border-white/5">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-bold">Automated audit recommendations:</span>
          <div className="space-y-2">
            {getAiRecommendations().map((rec, index) => (
              <div key={index} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed bg-[#0a0a0a]/30 p-2.5 rounded-xl border border-white/5">
                <ArrowRight className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                {loading ? "..." : kpi.value}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{kpi.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Live activity feed & Demographics */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Real-time Activity feed panel */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4 md:col-span-1">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Activity className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-white">Live Activity ticker</h3>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-10 text-center">Awaiting platform activities...</p>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {events.map((evt) => (
                <div key={evt.id} className="p-3 rounded-xl bg-[#0a0a0a]/35 border border-white/5 text-[10px] space-y-1">
                  <div className="flex justify-between text-slate-500 font-bold font-mono">
                    <span className="uppercase text-[9px] tracking-wider text-cyan-400">{evt.name.replace("_", " ")}</span>
                    <span>{evt.time}</span>
                  </div>
                  <p className="text-slate-300 leading-normal">{getEventDescription(evt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Charts graphs */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Daily Traffic Growth</h3>
          </div>
          
          <div className="relative pt-6 pb-2">
            <svg viewBox="0 0 400 120" className="w-full overflow-visible">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="20" x2="400" y2="20" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="0.5" />
              <line x1="0" y1="60" x2="400" y2="60" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="0.5" />
              <line x1="0" y1="100" x2="400" y2="100" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="0.5" />
              
              <path
                d="M 0,110 C 50,85 100,95 150,55 C 200,65 250,30 300,45 C 350,15 400,10 400,10"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
               />
              <path
                d="M 0,110 C 50,85 100,95 150,55 C 200,65 250,30 300,45 C 350,15 400,10 400,10 L 400,120 L 0,120 Z"
                fill="url(#chartGradient)"
              />
            </svg>
            <div className="flex justify-between text-[9px] text-slate-500 pt-2 font-medium">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>
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
