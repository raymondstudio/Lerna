"use client";

import { useEffect, useState } from "react";
import { Loader2, X, User, Calendar, Cpu, FolderOpen, Globe, Laptop, HelpCircle, GraduationCap, Coins, MessageSquare, ShieldAlert, Shield, History, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

type UserDetails = {
  profile: {
    id: string;
    firstName?: string;
    lastName?: string;
    name: string;
    email: string;
    provider: string;
    joinedDate: string;
    lastLogin: string;
    status: string;
    device: string;
    subscriptionStatus: string;
    gender?: string;
    age?: number;
    isStudent?: boolean;
    institution?: string;
    department?: string;
    studyLevel?: string;
    studyGoals?: string[];
  };
  preferences?: {
    teachingStyle?: string;
    preferredQuizFormat?: string;
    preferredLanguage?: string;
  };
  attribution: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
  } | null;
  sessions: Array<{
    id: string;
    title: string;
    topic_category: string;
    status: string;
    created_at: string;
  }>;
  uploads: Array<{
    id: string;
    file_name: string;
    file_type: string;
    created_at: string;
  }>;
  supportTickets?: Array<{
    id: string;
    subject: string;
    message: string;
    status: string;
    created_at: string;
  }>;
  feedback?: Array<{
    id: string;
    type: string;
    message: string;
    rating: number;
    created_at: string;
  }>;
  loginHistory?: Array<{
    id: string;
    path: string;
    user_agent: string;
    created_at: string;
  }>;
  aiUsage: {
    totalRequestsCount: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCost: number;
  };
};

export function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);

  // Subscription plan management states
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [selectedPlanStatus, setSelectedPlanStatus] = useState("active");
  const [isPromo, setIsPromo] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const handleSavePlan = async () => {
    try {
      setSavingPlan(true);
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-plan",
          value: {
            plan: selectedPlan,
            status: selectedPlanStatus,
            isPromo
          }
        })
      });
      const json = await res.json();
      if (json.success) {
        alert("Subscription plan updated successfully.");
        onClose(); // Close drawer to trigger refresh
      } else {
        alert(json.error || "Failed to update plan.");
      }
    } catch (err) {
      console.error("[user-drawer] Failed to save plan:", err);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleRevokePlan = async () => {
    const confirmRevoke = window.confirm("Are you sure you want to revoke this user's subscription and reset them to the Free Plan?");
    if (!confirmRevoke) return;

    try {
      setSavingPlan(true);
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-plan",
          value: {
            plan: "free",
            status: "inactive",
            isPromo: false
          }
        })
      });
      const json = await res.json();
      if (json.success) {
        alert("Subscription revoked.");
        onClose();
      } else {
        alert(json.error || "Failed to revoke subscription.");
      }
    } catch (err) {
      console.error("[user-drawer] Failed to revoke plan:", err);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleResetUsage = async () => {
    const confirmReset = window.confirm("Are you sure you want to reset today's usage stats for this user?");
    if (!confirmReset) return;

    try {
      setSavingPlan(true);
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-usage" })
      });
      const json = await res.json();
      if (json.success) {
        alert("Usage limits reset successfully.");
        onClose();
      } else {
        alert(json.error || "Failed to reset usage.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleExtendSubscription = async () => {
    const daysStr = window.prompt("Enter number of days to extend subscription by:", "30");
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days <= 0) {
      alert("Invalid number of days.");
      return;
    }

    try {
      setSavingPlan(true);
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend-subscription",
          value: { days }
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(`Subscription extended by ${days} days.`);
        onClose();
      } else {
        alert(json.error || "Failed to extend subscription.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPlan(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/users/${userId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          setSelectedPlan(json.data.profile.subscriptionStatus || "free");
        } else {
          setError(json.error || "Failed to load user metadata.");
        }

        // Fetch chronological timeline
        const timelineRes = await fetch(`/api/admin/users/${userId}/timeline`);
        const timelineJson = await timelineRes.json();
        if (timelineJson.success && Array.isArray(timelineJson.data)) {
          setTimeline(timelineJson.data);
        }
      } catch (err) {
        setError("Error connecting to server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-out Panel */}
      <div className="relative w-full max-w-lg h-full bg-[#141414]/95 border-l border-white/10 backdrop-blur-xl shadow-2xl overflow-y-auto z-10 flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#1a1a1a]/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">User Inspection Report</h3>
              <p className="text-[10px] text-slate-500 font-medium font-mono">ID: {userId.slice(0, 8)}...</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-white rounded-lg">
            <X className="h-4.5 w-4.5" />
          </Button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
              <span className="text-xs text-slate-500">Loading user report...</span>
            </div>
          ) : error || !data ? (
            <div className="text-center py-20 text-red-400 text-xs italic">
              {error || "Report unavailable."}
            </div>
          ) : (
            <div className="space-y-6 text-xs">
              
              {/* Profile Block */}
              <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a]/30 space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">
                      {data.profile.firstName || data.profile.lastName 
                        ? `${data.profile.firstName || ""} ${data.profile.lastName || ""}`.trim() 
                        : data.profile.name}
                    </h4>
                    <span className="text-slate-500 font-mono text-[11px] block mt-0.5">{data.profile.email}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    data.profile.status === "Admin" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                    data.profile.status === "Suspended" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                    "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {data.profile.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-2 border-t border-white/5">
                  <div>Joined: <strong>{new Date(data.profile.joinedDate).toLocaleDateString()}</strong></div>
                  <div>Last Login: <strong>{new Date(data.profile.lastLogin).toLocaleDateString()}</strong></div>
                  <div>Provider: <strong className="capitalize">{data.profile.provider}</strong></div>
                  <div>Device: <strong>{data.profile.device}</strong></div>
                  <div>Age: <strong>{data.profile.age || "N/A"}</strong></div>
                  <div>Gender: <strong>{data.profile.gender || "N/A"}</strong></div>
                  <div>Student: <strong>{data.profile.isStudent ? "Yes" : "No"}</strong></div>
                  <div>Level: <strong>{data.profile.studyLevel || "N/A"}</strong></div>
                  <div>Plan Expiration: <strong>{(data as any).subscription?.current_period_end ? new Date((data as any).subscription.current_period_end).toLocaleDateString() : "N/A"}</strong></div>
                  <div>Renewal Type: <strong className="capitalize">{(data as any).subscription?.payment_provider || "manual"}</strong></div>
                  <div className="col-span-2 truncate">School: <strong>{data.profile.institution || "N/A"} ({data.profile.department || "N/A"})</strong></div>
                  <div className="col-span-2 truncate">Goals: <strong>{data.profile.studyGoals?.join(", ") || "N/A"}</strong></div>
                </div>
              </div>

              {/* Administrative Plan Controls */}
              <div className="p-4 rounded-xl border border-white/5 bg-[#141416]/60 space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1.5 border-b border-white/5">
                  <Shield className="h-4 w-4 text-cyan-400" /> Administrative Plan Controls
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase block">Manual Plan Tier</label>
                      <select
                        value={selectedPlan}
                        onChange={e => setSelectedPlan(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0d0f12] text-xs text-slate-300 focus:outline-none focus:border-cyan-500/30"
                      >
                        <option value="free">Free Plan</option>
                        <option value="student">Student Plan</option>
                        <option value="pro">Pro Plan</option>
                        <option value="team">Team Plan</option>
                        <option value="premium">Premium Legacy</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>

                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase block">Status</label>
                      <select
                        value={selectedPlanStatus}
                        onChange={e => setSelectedPlanStatus(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0d0f12] text-xs text-slate-300 focus:outline-none focus:border-cyan-500/30"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="canceled">Canceled</option>
                        <option value="past_due">Past Due</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPromo"
                      checked={isPromo}
                      onChange={e => setIsPromo(e.target.checked)}
                      className="rounded border-white/10 bg-[#0d0f12] text-cyan-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
                    />
                    <label htmlFor="isPromo" className="text-[10px] text-slate-400 font-medium cursor-pointer select-none">
                      Grant Promotional Access (30 Days)
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    <Button
                      size="sm"
                      onClick={handleSavePlan}
                      disabled={savingPlan}
                      className="flex-1 h-8 bg-cyan-500 hover:bg-cyan-600 text-black text-[10px] font-bold rounded-lg border-none"
                    >
                      {savingPlan ? "Saving..." : "Apply Plan Change"}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRevokePlan}
                      disabled={savingPlan}
                      className="flex-1 h-8 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-[10px] font-bold rounded-lg"
                    >
                      Revoke Access
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-1.5 border-t border-white/5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleExtendSubscription}
                      disabled={savingPlan}
                      className="flex-1 h-8 border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded-lg"
                    >
                      Extend Term
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleResetUsage}
                      disabled={savingPlan}
                      className="flex-1 h-8 border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-400 text-[10px] font-bold rounded-lg"
                    >
                      Reset Daily Usage
                    </Button>
                  </div>
                </div>
              </div>

              {/* Preferences Block */}
              {data.preferences && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                    <Laptop className="h-4 w-4 text-cyan-400" /> Learning Settings
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[#0a0a0a]/20 border border-white/5 rounded-xl text-[10px] text-slate-400">
                    <div>Teaching style: <strong className="text-white">{data.preferences.teachingStyle || "Intermediate"}</strong></div>
                    <div>Quiz Format: <strong className="text-white">{data.preferences.preferredQuizFormat || "Mixed"}</strong></div>
                    <div className="col-span-2">Language: <strong className="text-white">{data.preferences.preferredLanguage || "English"}</strong></div>
                  </div>
                </div>
              )}

              {/* KPI metrics */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3.5 rounded-xl border border-white/5 bg-[#0a0a0a]/30 text-center space-y-1">
                  <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider block">Study Workspaces</span>
                  <div className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-cyan-400" /> {data.sessions.length}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-white/5 bg-[#0a0a0a]/30 text-center space-y-1">
                  <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider block">Uploaded Files</span>
                  <div className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                    <FolderOpen className="h-4 w-4 text-cyan-400" /> {data.uploads.length}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-white/5 bg-[#0a0a0a]/30 text-center space-y-1">
                  <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider block">Gemini Cost</span>
                  <div className="text-base font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                    <Coins className="h-4 w-4 text-emerald-400" /> ${data.aiUsage.totalCost.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Marketing Attribution Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <Globe className="h-4 w-4 text-cyan-400" /> Marketing Attribution
                </div>
                {data.attribution ? (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[#0a0a0a]/20 border border-white/5 rounded-xl text-[10px]">
                    <div>Source: <strong className="text-white capitalize">{data.attribution.utm_source || "direct"}</strong></div>
                    <div>Medium: <strong className="text-white">{data.attribution.utm_medium || "N/A"}</strong></div>
                    <div>Campaign: <strong className="text-white">{data.attribution.utm_campaign || "N/A"}</strong></div>
                    <div className="col-span-2 truncate">Referrer: <strong className="text-white">{data.attribution.referrer || "direct"}</strong></div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">No attribution metadata logged.</p>
                )}
              </div>

              {/* Support Tickets Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <HelpCircle className="h-4 w-4 text-cyan-400" /> Helpdesk Tickets ({data.supportTickets?.length || 0})
                </div>
                {data.supportTickets && data.supportTickets.length > 0 ? (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {data.supportTickets.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-lg bg-[#0a0a0a]/40 border border-white/5 flex items-center justify-between text-[10px]">
                        <div className="truncate max-w-[280px]">
                          <span className="font-semibold text-white block">{t.subject}</span>
                          <span className="text-slate-500 font-mono">{t.message.slice(0, 50)}...</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                          t.status === "resolved" ? "bg-emerald-500/10 text-emerald-400" :
                          t.status === "pending" ? "bg-yellow-500/10 text-yellow-400" :
                          "bg-cyan-500/10 text-cyan-400"
                        }`}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">No support tickets submitted.</p>
                )}
              </div>

              {/* User Feedback Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <MessageSquare className="h-4 w-4 text-cyan-400" /> Feedback Reviews ({data.feedback?.length || 0})
                </div>
                {data.feedback && data.feedback.length > 0 ? (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {data.feedback.map((f) => (
                      <div key={f.id} className="p-2.5 rounded-lg bg-[#0a0a0a]/40 border border-white/5 space-y-1 text-[10px]">
                        <div className="flex justify-between font-bold text-yellow-400">
                          <span>{"★".repeat(f.rating)}</span>
                          <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-slate-400 uppercase">{f.type}</span>
                        </div>
                        <p className="text-slate-300 italic">"{f.message}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">No feedback entries.</p>
                )}
              </div>

              {/* Login History Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <ShieldAlert className="h-4 w-4 text-cyan-400" /> Recent Page Views (Login Logs)
                </div>
                {data.loginHistory && data.loginHistory.length > 0 ? (
                  <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 font-mono text-[9px] text-slate-500">
                    {data.loginHistory.map((l) => (
                      <div key={l.id} className="flex justify-between p-1 hover:bg-white/[0.02] rounded">
                        <span className="truncate max-w-[250px]">{l.path}</span>
                        <span>{new Date(l.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">No access logs.</p>
                )}
              </div>

              {/* AI Compute details */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <Cpu className="h-4 w-4 text-cyan-400" /> AI Consumption Statistics
                </div>
                <div className="p-3.5 rounded-xl bg-[#0a0a0a]/20 border border-white/5 space-y-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total API Queries</span>
                    <span className="font-bold text-white">{data.aiUsage.totalRequestsCount} calls</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Prompt / Input Tokens</span>
                    <span className="font-bold text-white">{data.aiUsage.totalPromptTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Completion / Output Tokens</span>
                    <span className="font-bold text-white">{data.aiUsage.totalCompletionTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Study Sessions List */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <Calendar className="h-4 w-4 text-cyan-400" /> Recent Study Workspaces ({data.sessions.length})
                </div>
                {data.sessions.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No active workspaces.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {data.sessions.map((s) => (
                      <div key={s.id} className="p-2.5 rounded-lg bg-[#0a0a0a]/40 border border-white/5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-white truncate max-w-[250px]">{s.title || "Untitled Session"}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${
                          s.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
                        }`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Uploads List */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <FolderOpen className="h-4 w-4 text-cyan-400" /> Scanned Materials ({data.uploads.length})
                </div>
                {data.uploads.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No scanned files.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {data.uploads.map((u) => (
                      <div key={u.id} className="p-2.5 rounded-lg bg-[#0a0a0a]/40 border border-white/5 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-white truncate max-w-[300px]">{u.file_name}</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">{u.file_type.split("/")[1] || "File"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feature Entitlements Checklist */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <Shield className="h-4 w-4 text-cyan-400" /> Active Feature Entitlements
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#0a0a0a]/20 border border-white/5 rounded-xl text-[10px]">
                  {[
                    { key: "ai_chat", label: "AI Tutor Chat" },
                    { key: "advanced_quizzes", label: "Advanced Quizzes" },
                    { key: "puzzle_generation", label: "Puzzle Challenges" },
                    { key: "flashcards", label: "Recall Flashcards" },
                    { key: "ocr", label: "OCR Scan Scanning" },
                    { key: "voice_tutor", label: "Voice Tutor Sessions" },
                    { key: "unlimited_uploads", label: "Unlimited Uploads" },
                    { key: "analytics", label: "Advanced Analytics" },
                  ].map((feat) => {
                    const planName = (data.profile.subscriptionStatus || "free").toLowerCase();
                    const hasFeat = 
                      (planName === "student" && ["ai_chat", "advanced_quizzes", "flashcards", "ocr", "voice_tutor"].includes(feat.key)) ||
                      (["pro", "premium", "team", "enterprise"].includes(planName));
                    return (
                      <div key={feat.key} className="flex items-center gap-1.5">
                        <span className={hasFeat ? "text-cyan-400 font-bold" : "text-slate-600"}>
                          {hasFeat ? "✓" : "✕"}
                        </span>
                        <span className={hasFeat ? "text-slate-200" : "text-slate-500 line-through"}>
                          {feat.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Subscription History Log */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <History className="h-4 w-4 text-cyan-400" /> Subscription History Log
                </div>
                {!(data as any).subscriptionHistory || (data as any).subscriptionHistory.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No plan changes logged.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {(data as any).subscriptionHistory.map((h: any) => (
                      <div key={h.id} className="p-2 bg-[#0a0a0a]/30 border border-white/5 rounded text-[10px] space-y-0.5">
                        <div className="flex justify-between text-slate-400">
                          <span>Plan: <strong className="text-white capitalize">{h.old_plan || "none"} → {h.new_plan || "none"}</strong></span>
                          <span>{new Date(h.created_at).toLocaleDateString()}</span>
                        </div>
                        {h.reason && <p className="text-slate-500 text-[9px] italic">Reason: {h.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transactions & Invoices */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <Receipt className="h-4 w-4 text-cyan-400" /> Transactions & Invoices
                </div>
                {(!(data as any).invoices || (data as any).invoices.length === 0) && (!(data as any).billingHistory || (data as any).billingHistory.length === 0) ? (
                  <p className="text-[10px] text-slate-500 italic">No invoices or payments registered.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 text-[9px] font-mono">
                    {(data as any).invoices?.map((inv: any) => (
                      <div key={inv.id} className="flex justify-between p-1.5 border-b border-white/5 bg-white/[0.01]">
                        <span className="text-slate-400">Invoice: {inv.invoice_number}</span>
                        <span className="text-slate-200">{inv.amount} {inv.currency} ({inv.status})</span>
                      </div>
                    ))}
                    {(data as any).billingHistory?.map((tx: any) => (
                      <div key={tx.id} className="flex justify-between p-1.5 border-b border-white/5">
                        <span className="text-slate-500">Ref: {tx.reference} ({tx.provider})</span>
                        <span className="text-slate-300">{tx.amount} {tx.currency} ({tx.status})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chronological Event Timeline */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-white/5 pb-1.5">
                  <Calendar className="h-4 w-4 text-cyan-400" /> Chronological Activity Timeline
                </div>
                {timeline.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No activity logs recorded.</p>
                ) : (
                  <div className="relative border-l border-white/10 ml-2 pl-4 space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                    {timeline.map((evt, index) => (
                      <div key={evt.id || index} className="relative text-[11px] text-slate-400">
                        {/* Event bullet point */}
                        <div className="absolute -left-[21px] top-1 bg-cyan-500 w-2 h-2 rounded-full border border-slate-900" />
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-white capitalize">
                            {evt.event_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {new Date(evt.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {evt.properties && Object.keys(evt.properties).length > 0 && (
                          <div className="mt-1 p-2 rounded bg-white/5 text-[9px] font-mono text-slate-500 max-w-full overflow-x-auto">
                            {JSON.stringify(evt.properties)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
