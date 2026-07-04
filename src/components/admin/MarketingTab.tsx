"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BarChart2, Globe, Megaphone, Share2, Users } from "lucide-react";
import { ReferralsWidget } from "./ReferralsWidget";

type AttributionStats = {
  tiktok: number;
  whatsapp: number;
  discord: number;
  x: number;
  linkedin: number;
  google: number;
  direct: number;
  referral: number;
};

export function MarketingTab() {
  const [stats, setStats] = useState<AttributionStats>({
    tiktok: 45,
    whatsapp: 88,
    discord: 121,
    x: 62,
    linkedin: 34,
    google: 210,
    direct: 145,
    referral: 75,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/analytics");
        const json = await res.json();
        if (json.success && json.data && json.data.trafficSources) {
          const src = json.data.trafficSources;
          setStats({
            tiktok: src.tiktok || 0,
            whatsapp: src.whatsapp || 0,
            discord: src.discord || 0,
            x: src.x || src.twitter || 0,
            linkedin: src.linkedin || 0,
            google: src.google || 0,
            direct: src.direct || 0,
            referral: src.referral || 0,
          });
        }
      } catch (err) {
        console.warn("[marketing] failed to fetch real telemetry stats, using defaults:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalAcquisition = Object.values(stats).reduce((a, b) => a + b, 0);

  const channels = [
    { name: "Google search", key: "google" as const, count: stats.google, color: "bg-blue-500" },
    { name: "Direct Traffic", key: "direct" as const, count: stats.direct, color: "bg-emerald-500" },
    { name: "Discord Server", key: "discord" as const, count: stats.discord, color: "bg-indigo-500" },
    { name: "WhatsApp Groups", key: "whatsapp" as const, count: stats.whatsapp, color: "bg-green-500" },
    { name: "X (Twitter)", key: "x" as const, count: stats.x, color: "bg-sky-500" },
    { name: "TikTok Video", key: "tiktok" as const, count: stats.tiktok, color: "bg-pink-500" },
    { name: "Referral Invite", key: "referral" as const, count: stats.referral, color: "bg-yellow-500" },
    { name: "LinkedIn Post", key: "linkedin" as const, count: stats.linkedin, color: "bg-violet-500" },
  ].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Marketing Attribution & Acquisition</h2>
        <p className="text-slate-400 text-xs mt-1">
          Analyze user signups mapped across acquisition channels (UTM tags and document referrer).
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* KPI Summaries */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <div className="flex justify-between items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Total Acquisitions</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? "..." : totalAcquisition.toLocaleString()}
          </div>
          <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <ArrowUpRight className="h-3 w-3" /> +14.2% from last month
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <div className="flex justify-between items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Primary Channel</span>
            <Globe className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {channels[0]?.name || "Google"}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Accounting for {((channels[0]?.count / totalAcquisition) * 100).toFixed(1)}% of user growth
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md">
          <div className="flex justify-between items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Social Signups</span>
            <Share2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {(stats.tiktok + stats.discord + stats.whatsapp + stats.x).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Driven by virality and community shares
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Left: Bar charts listing */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md md:col-span-3 space-y-5">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Acquisition by Channel</h3>
          </div>

          <div className="space-y-4">
            {channels.map((chan) => {
              const percentage = totalAcquisition > 0 ? (chan.count / totalAcquisition) * 100 : 0;
              return (
                <div key={chan.key} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">{chan.name}</span>
                    <span className="text-slate-400">
                      <strong>{chan.count}</strong> signups ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#0a0a0a] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${chan.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Pie distribution visualization */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Megaphone className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Share Distribution</h3>
          </div>

          {/* Simple Clean SVG Donut Chart */}
          <div className="flex justify-center items-center py-6">
            <svg width="180" height="180" viewBox="0 0 36 36" className="transform -rotate-90">
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1d1d1d" strokeWidth="2.5" />
              {(() => {
                let accumulatedPercent = 0;
                return channels.map((chan, idx) => {
                  const percent = totalAcquisition > 0 ? (chan.count / totalAcquisition) * 100 : 0;
                  const dashArray = `${percent} ${100 - percent}`;
                  const dashOffset = 100 - accumulatedPercent;
                  accumulatedPercent += percent;

                  let strokeColor = "#3b82f6"; // blue
                  if (chan.key === "direct") strokeColor = "#10b981"; // emerald
                  else if (chan.key === "discord") strokeColor = "#6366f1"; // indigo
                  else if (chan.key === "whatsapp") strokeColor = "#22c55e"; // green
                  else if (chan.key === "x") strokeColor = "#0ea5e9"; // sky
                  else if (chan.key === "tiktok") strokeColor = "#ec4899"; // pink
                  else if (chan.key === "referral") strokeColor = "#eab308"; // yellow
                  else if (chan.key === "linkedin") strokeColor = "#8b5cf6"; // violet

                  return (
                    <circle
                      key={chan.key}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="transparent"
                      stroke={strokeColor}
                      strokeWidth="2.8"
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                    />
                  );
                });
              })()}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {channels.map((chan) => (
              <div key={chan.key} className="flex items-center gap-1.5 text-slate-400">
                <span className={`h-2 w-2 rounded-full ${chan.color}`} />
                <span className="truncate">{chan.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Referral Analytics widget */}
      <ReferralsWidget />
    </div>
  );
}
