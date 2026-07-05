"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, Volume2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AnnouncementsTab() {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      });
      const json = await res.json();
      if (json.success) {
        setTitle("");
        setContent("");
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
          <p className="text-slate-400 text-xs mt-1">Publish dashboard system alerts or schedule security notice broadcasts.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="h-9 px-4 text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-1">
          <Plus className="h-4 w-4" /> Create Broadcast
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-white/5 bg-[#141414]/80 backdrop-blur-md space-y-4 max-w-xl animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-white">New Broadcast Announcement</h3>
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Announcement Title</label>
            <Input
              placeholder="e.g. Scheduled Database Maintenance"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-[#0a0a0c] border-white/5 h-10 text-xs"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Content Message</label>
            <textarea
              rows={4}
              placeholder="Detail your announcement text..."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/5 bg-[#0a0a0c] text-xs text-slate-200 focus:outline-none"
              required
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" onClick={() => setShowForm(false)} variant="ghost" className="h-9 text-xs text-slate-400 hover:text-white border border-white/5">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-9 bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-bold px-4">
              {submitting ? "Publishing..." : "Publish Broadcast"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading system announcements...</span>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs italic">
            No broadcast announcements have been published.
          </div>
        ) : (
          broadcasts.map((ann) => (
            <div key={ann.id} className="p-5 rounded-2xl border border-white/5 bg-[#141414]/60 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">{ann.title}</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                  Published
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{ann.content}</p>
              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-white/5">
                <span>Audience: <strong>All Active Users</strong></span>
                <span>{new Date(ann.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
