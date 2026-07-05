"use client";

import { useEffect, useState } from "react";
import { Loader2, X, User, Calendar, Cpu, FolderOpen, Globe, Laptop, HelpCircle, GraduationCap, Coins, MessageSquare, ShieldAlert } from "lucide-react";
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

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/users/${userId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to load user metadata.");
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
                  <div className="col-span-2 truncate">School: <strong>{data.profile.institution || "N/A"} ({data.profile.department || "N/A"})</strong></div>
                  <div className="col-span-2 truncate">Goals: <strong>{data.profile.studyGoals?.join(", ") || "N/A"}</strong></div>
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

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
