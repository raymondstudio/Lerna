"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Loader2, RefreshCw, Star, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FeedbackTab() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<{ [key: string]: string }>({});

  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/feedback");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setFeedbacks(json.data);
        const inputs: { [key: string]: string } = {};
        json.data.forEach((f: any) => {
          inputs[f.id] = f.admin_notes || "";
        });
        setNotesInput(inputs);
      }
    } catch (err) {
      console.error("[feedback-tab] Error fetching feedback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFeedback();

    const { createSupabaseBrowserClient } = require("@/lib/supabase/client");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("feedback_realtime_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback" },
        () => {
          void fetchFeedback();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateFeedback = async (feedbackId: string, fields: any) => {
    try {
      setUpdatingId(feedbackId);
      const res = await fetch("/api/admin/feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId, ...fields })
      });
      const json = await res.json();
      if (json.success) {
        setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, ...fields } : f));
      } else {
        alert(json.error || "Failed to update feedback roadmap status.");
      }
    } catch (err) {
      console.error("[feedback-tab] Error updating feedback:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Client-side filtering logic
  const filteredFeedbacks = feedbacks.filter(f => {
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      !term ||
      f.message?.toLowerCase().includes(term) ||
      f.user_name?.toLowerCase().includes(term) ||
      f.user_email?.toLowerCase().includes(term);

    const matchesType = typeFilter === "all" || f.type === typeFilter;
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-cyan-400" /> User Feedback & Roadmap
          </h2>
          <p className="text-slate-400 text-xs mt-1">Review student ratings, update roadmap development statuses, and log internal notes.</p>
        </div>
        <Button onClick={fetchFeedback} variant="outline" className="h-8 border-white/5 bg-[#141414] hover:bg-[#202020] text-xs flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Filters & Search Control Panel */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            placeholder="Search feedback content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-[#141414] border-white/5 text-xs text-white rounded-xl placeholder-slate-500 focus-visible:ring-cyan-500/20"
          />
        </div>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-white/5 bg-[#141414] text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/20 cursor-pointer"
        >
          <option value="all">All Feedback Types</option>
          <option value="general">General suggestions</option>
          <option value="bug">Bug Reports</option>
          <option value="feature">Feature Requests</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-white/5 bg-[#141414] text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/20 cursor-pointer"
        >
          <option value="all">All Roadmap Statuses</option>
          <option value="new">New</option>
          <option value="under_review">Under Review</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#141414]/40 backdrop-blur-md overflow-x-auto shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading student feedback...</span>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs italic">
            No feedback entries match your query or filters.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 font-semibold bg-[#1a1a1a]/40 font-heading">
                <th className="p-4">Student Info</th>
                <th className="p-4 text-center">Type</th>
                <th className="p-4 text-center">Rating</th>
                <th className="p-4">Suggestion / Message</th>
                <th className="p-4">Roadmap Status</th>
                <th className="p-4">Admin Roadmap Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredFeedbacks.map((f) => (
                <tr key={f.id} className="hover:bg-white/[0.01] transition-colors align-top">
                  <td className="p-4 whitespace-nowrap">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white block text-sm">{f.user_name}</span>
                      <span className="text-slate-500 font-mono text-[10px] block">{f.user_email}</span>
                      <span className="text-slate-500 text-[9px] block mt-1">
                        {new Date(f.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      f.type === "bug" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      f.type === "feature" ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" :
                      "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="p-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5 text-yellow-400 font-bold">
                      <Star className="h-3 w-3 fill-current text-yellow-400" />
                      <span>{f.rating || 5}/5</span>
                    </div>
                  </td>
                  <td className="p-4 max-w-xs text-slate-300 break-words whitespace-pre-wrap leading-relaxed text-[11px]">
                    {f.message}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {updatingId === f.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                    ) : (
                      <select
                        value={f.status || "new"}
                        onChange={(e) => handleUpdateFeedback(f.id, { status: e.target.value })}
                        className="h-8 rounded-lg border border-white/10 bg-[#1a1a1c] text-xs px-2 text-slate-300 cursor-pointer focus:outline-none font-medium"
                      >
                        <option value="new">New</option>
                        <option value="under_review">Under Review</option>
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    )}
                  </td>
                  <td className="p-4 space-y-2 min-w-[200px]">
                    <textarea
                      rows={2}
                      placeholder="Add roadmap or changelog details..."
                      value={notesInput[f.id] || ""}
                      onChange={(e) => setNotesInput(prev => ({ ...prev, [f.id]: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-white/10 bg-[#0d0f12] text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500/40"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdateFeedback(f.id, { adminNotes: notesInput[f.id] || "" })}
                      disabled={updatingId === f.id}
                      className="h-7 px-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px]"
                    >
                      Save Notes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
