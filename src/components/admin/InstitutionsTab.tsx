"use client";

import { useEffect, useState } from "react";
import { 
  Building, 
  Check, 
  Trash2, 
  TrendingUp, 
  MapPin, 
  Globe, 
  AlertTriangle, 
  School, 
  GraduationCap, 
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstitutionsTab() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      const res = await fetch("/api/admin/institutions/analytics");
      const json = await res.json();
      if (json.success && json.data) {
        setAnalytics(json.data);
      } else {
        setError(json.error || "Failed to load institution analytics");
      }
    } catch (err: any) {
      console.error("[institutions-tab] failed to fetch analytics:", err);
      setError(err.message || String(err));
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const res = await fetch("/api/admin/institutions/verify");
      const json = await res.json();
      if (json.success && json.data) {
        setPendingReviews(json.data);
      }
    } catch (err: any) {
      console.error("[institutions-tab] failed to fetch pending reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchReviews();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      setActioningId(id);
      const res = await fetch("/api/admin/institutions/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.success) {
        // Refresh local listings
        setPendingReviews(prev => prev.filter(r => r.id !== id));
        void fetchAnalytics();
      } else {
        alert(json.error || "Failed to verify school");
      }
    } catch (err) {
      console.error("Error verifying school:", err);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Are you sure you want to reject and delete this institution?")) return;
    try {
      setActioningId(id);
      const res = await fetch(`/api/admin/institutions/verify?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (json.success) {
        setPendingReviews(prev => prev.filter(r => r.id !== id));
        void fetchAnalytics();
      } else {
        alert(json.error || "Failed to reject school");
      }
    } catch (err) {
      console.error("Error rejecting school:", err);
    } finally {
      setActioningId(null);
    }
  };

  if (loadingAnalytics && !analytics) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><strong>API Query Failed:</strong> {error}</span>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Institution Analytics & Approvals</h2>
        <p className="text-slate-400 text-xs mt-1">
          Review student distribution across schools, states, and manage custom user-added institutions.
        </p>
      </div>

      {/* Main Aggregated Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Top University</span>
            <div className="text-md font-bold text-white mt-1.5 truncate max-w-[170px]">
              {analytics?.byUniversity?.[0]?.name || "N/A"}
            </div>
            <span className="text-[10px] text-cyan-400 font-bold block mt-0.5">
              {analytics?.byUniversity?.[0]?.user_count || 0} active users
            </span>
          </div>
          <GraduationCap className="h-6 w-6 text-cyan-400 shrink-0" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Top Secondary School</span>
            <div className="text-md font-bold text-white mt-1.5 truncate max-w-[170px]">
              {analytics?.bySecondary?.[0]?.name || "N/A"}
            </div>
            <span className="text-[10px] text-cyan-400 font-bold block mt-0.5">
              {analytics?.bySecondary?.[0]?.user_count || 0} active users
            </span>
          </div>
          <School className="h-6 w-6 text-cyan-400 shrink-0" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Top State</span>
            <div className="text-md font-bold text-white mt-1.5 truncate max-w-[170px]">
              {analytics?.byState?.[0]?.state || "N/A"}
            </div>
            <span className="text-[10px] text-cyan-400 font-bold block mt-0.5">
              {analytics?.byState?.[0]?.user_count || 0} active users
            </span>
          </div>
          <MapPin className="h-6 w-6 text-cyan-400 shrink-0" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Pending Reviews</span>
            <div className="text-md font-bold text-white mt-1.5">
              {pendingReviews.length} custom schools
            </div>
            <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
              Awaiting verification
            </span>
          </div>
          <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side: Leaderboards */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Universities Leaderboard */}
          <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Universities Leaderboard</h3>
              </div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Top 10</span>
            </div>

            <div className="space-y-3">
              {analytics?.byUniversity?.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">No university users registered.</p>
              ) : (
                analytics?.byUniversity?.map((item: any, idx: number) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0a]/50 border border-white/5 hover:bg-[#0a0a0a]/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-500 w-5">#{idx + 1}</span>
                      <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-cyan-400 shrink-0">{item.user_count} users</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Secondary Schools Leaderboard */}
          <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <School className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Secondary Schools Leaderboard</h3>
              </div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Top 10</span>
            </div>

            <div className="space-y-3">
              {analytics?.bySecondary?.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">No secondary school users registered.</p>
              ) : (
                analytics?.bySecondary?.map((item: any, idx: number) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0a]/50 border border-white/5 hover:bg-[#0a0a0a]/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-500 w-5">#{idx + 1}</span>
                      <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-cyan-400 shrink-0">{item.user_count} users</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Geographics & Approvals */}
        <div className="space-y-6">
          
          {/* Geography Distribution */}
          <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <MapPin className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Geographic Distribution</h3>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Users by State</span>
                <div className="space-y-2">
                  {analytics?.byState?.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic text-center">No state data available.</p>
                  ) : (
                    analytics?.byState?.slice(0, 5).map((item: any) => (
                      <div key={item.state} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{item.state}</span>
                        <span className="font-bold text-white">{item.user_count} users</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Users by Country</span>
                <div className="space-y-2">
                  {analytics?.byCountry?.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic text-center">No country data available.</p>
                  ) : (
                    analytics?.byCountry?.slice(0, 5).map((item: any) => (
                      <div key={item.country} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-cyan-400" />
                          {item.country}
                        </span>
                        <span className="font-bold text-white">{item.user_count} users</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Reviews Panel */}
          <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <Building className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Verification Queue</h3>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {loadingReviews ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
                </div>
              ) : pendingReviews.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">Verification queue is empty.</p>
              ) : (
                pendingReviews.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-[#0a0a0a]/50 border border-white/5 space-y-3.5">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-white block">{item.name}</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                        {item.institution_type} • {item.state ? `${item.state}, ` : ""}{item.country}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={actioningId === item.id}
                        onClick={() => handleApprove(item.id)}
                        className="flex-1 h-7 text-[10px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold gap-1"
                      >
                        <Check className="h-3 w-3 stroke-[3]" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actioningId === item.id}
                        onClick={() => handleReject(item.id)}
                        className="flex-1 h-7 text-[10px] rounded-lg border border-white/5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
