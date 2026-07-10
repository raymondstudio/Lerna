"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, Volume2, Plus, Users, Calendar, Clock, Eye, Trash, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AnnouncementsTab() {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [targetInstitution, setTargetInstitution] = useState("");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [status, setStatus] = useState("published");
  const [scheduledFor, setScheduledFor] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Dynamic audience sizing estimate
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/broadcasts");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBroadcasts(json.data);
      }
    } catch (err) {
      console.error("[announcements] Error fetching broadcasts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBroadcasts();

    const { createSupabaseBrowserClient } = require("@/lib/supabase/client");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("broadcasts_realtime_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broadcasts" },
        () => {
          void fetchBroadcasts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Fetch estimated reach size dynamically when targeting criteria changes
  useEffect(() => {
    if (!showForm) return;

    const fetchEstimate = async () => {
      try {
        setLoadingEstimate(true);
        const res = await fetch(
          `/api/admin/broadcasts/audience-count?audience=${targetAudience}&institution=${encodeURIComponent(targetInstitution)}&department=${encodeURIComponent(targetDepartment)}`
        );
        const json = await res.json();
        if (json.success) {
          setEstimatedSize(json.count);
        }
      } catch (err) {
        console.error("[announcements] Estimate fetch failed:", err);
      } finally {
        setLoadingEstimate(false);
      }
    };

    const handler = setTimeout(fetchEstimate, 400);
    return () => clearTimeout(handler);
  }, [targetAudience, targetInstitution, targetDepartment, showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          status,
          targetAudience,
          targetInstitution: targetInstitution.trim() || null,
          targetDepartment: targetDepartment.trim() || null,
          scheduledFor: status === "scheduled" ? scheduledFor : null,
          expiresAt: expiresAt || null
        })
      });
      const json = await res.json();
      if (json.success) {
        setTitle("");
        setContent("");
        setTargetAudience("all");
        setTargetInstitution("");
        setTargetDepartment("");
        setStatus("published");
        setScheduledFor("");
        setExpiresAt("");
        setShowForm(false);
        setBroadcasts(prev => [json.data, ...prev]);
      } else {
        alert(json.error || "Failed to publish announcement.");
      }
    } catch (err) {
      console.error("[announcements] Error creating broadcast:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-cyan-400" /> Broadcast Announcements
          </h2>
          <p className="text-slate-400 text-xs mt-1">Publish dashboard system alerts, target specific demographics, and manage drafts.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="h-9 px-4 text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-1 shadow-md">
          <Plus className="h-4 w-4" /> Create Broadcast
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-white/5 bg-[#141414]/90 backdrop-blur-md space-y-4 max-w-2xl animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-white">New Broadcast Campaign</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Announcement Title</label>
              <Input
                placeholder="e.g. System upgrade notification..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-[#0a0a0c] border-white/5 h-10 text-xs text-white"
                required
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Content Message</label>
              <textarea
                rows={4}
                placeholder="Detail your announcement text..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full p-3 rounded-lg border border-white/5 bg-[#0a0a0c] text-xs text-slate-200 focus:outline-none focus:border-cyan-500/30"
                required
              />
            </div>

            {/* Targeting controls */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Target Audience Tier</label>
              <select
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-white/5 bg-[#0a0a0c] text-xs text-slate-300 focus:outline-none focus:border-cyan-500/30 cursor-pointer"
              >
                <option value="all">All Users</option>
                <option value="students">Students Only</option>
                <option value="teachers">Teachers Only</option>
                <option value="free">Free Plan Users</option>
                <option value="premium">Premium Tier Users</option>
                <option value="pro">Pro Plan Users</option>
                <option value="enterprise">Enterprise Users</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Target School / Institution</label>
              <Input
                placeholder="e.g. Harvard (Optional)"
                value={targetInstitution}
                onChange={e => setTargetInstitution(e.target.value)}
                className="bg-[#0a0a0c] border-white/5 h-10 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Target Department / Course</label>
              <Input
                placeholder="e.g. Computer Science (Optional)"
                value={targetDepartment}
                onChange={e => setTargetDepartment(e.target.value)}
                className="bg-[#0a0a0c] border-white/5 h-10 text-xs text-white"
              />
            </div>

            {/* Sizing telemetry badge */}
            <div className="flex flex-col justify-end p-1">
              <div className="p-3 rounded-xl border border-white/5 bg-cyan-950/10 flex items-center justify-between text-xs gap-3">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-cyan-400" /> Delivery Reach Size:
                </span>
                {loadingEstimate ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                ) : (
                  <span className="font-bold text-white text-sm">
                    {estimatedSize !== null ? `${estimatedSize.toLocaleString()} users` : "estimating..."}
                  </span>
                )}
              </div>
            </div>

            {/* Campaign status/scheduling settings */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Publish Type</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-white/5 bg-[#0a0a0c] text-xs text-slate-300 focus:outline-none focus:border-cyan-500/30 cursor-pointer font-bold"
              >
                <option value="published">Publish Immediately</option>
                <option value="draft">Save as Draft</option>
                <option value="scheduled">Schedule Publication</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Expiration Date</label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="bg-[#0a0a0c] border-white/5 h-10 text-xs text-slate-400 cursor-pointer"
              />
            </div>

            {status === "scheduled" && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Date & Time to Publish (Scheduled)
                </label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={e => setScheduledFor(e.target.value)}
                  className="bg-[#0a0a0c] border-yellow-500/20 h-10 text-xs text-slate-300 cursor-pointer"
                  required
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" onClick={() => setShowForm(false)} variant="ghost" className="h-9 text-xs text-slate-400 hover:text-white border border-white/5">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-9 bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-bold px-4">
              {submitting ? "Processing..." : status === "draft" ? "Save Draft" : status === "scheduled" ? "Schedule Broadcast" : "Publish Campaign"}
            </Button>
          </div>
        </form>
      )}

      {/* Broadcast Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading system announcements...</span>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs italic">
            No broadcast announcements have been published or drafted yet.
          </div>
        ) : (
          broadcasts.map((ann) => (
            <div key={ann.id} className="p-5 rounded-2xl border border-white/5 bg-[#141414]/60 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">{ann.title}</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                  ann.status === "draft" ? "bg-slate-600/10 text-slate-400 border-slate-600/20" :
                  ann.status === "scheduled" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                }`}>
                  {ann.status || "Published"}
                </span>
              </div>
              
              <p className="text-slate-400 text-xs leading-relaxed">{ann.content}</p>
              
              <div className="grid gap-2 sm:grid-cols-2 text-[10px] text-slate-500 pt-2.5 border-t border-white/5">
                <div className="space-y-0.5">
                  <div>Audience: <strong className="text-slate-300 capitalize">{ann.target_audience}</strong></div>
                  {(ann.target_institution || ann.target_department) && (
                    <div className="text-slate-500 text-[9px] truncate">
                      Filters: {ann.target_institution && `Institution: ${ann.target_institution}`} {ann.target_department && `Dept: ${ann.target_department}`}
                    </div>
                  )}
                </div>
                <div className="text-right flex flex-col justify-center gap-0.5">
                  <span className="flex items-center justify-end gap-1"><Clock className="h-3 w-3 text-slate-600" /> Created: {new Date(ann.created_at).toLocaleString()}</span>
                  {ann.scheduled_for && (
                    <span className="text-yellow-500/80 font-semibold flex items-center justify-end gap-1">
                      <Calendar className="h-3 w-3 text-yellow-500" /> Scheduled: {new Date(ann.scheduled_for).toLocaleString()}
                    </span>
                  )}
                  {ann.expires_at && (
                    <span className="text-red-500/80 flex items-center justify-end gap-1">
                      Expires: {new Date(ann.expires_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
