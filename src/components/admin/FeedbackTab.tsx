"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeedbackTab() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/feedback");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setFeedbacks(json.data);
      }
    } catch (err) {
      console.error("[feedback-tab] Error fetching feedback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFeedback();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-cyan-400" /> User Feedback
          </h2>
          <p className="text-slate-400 text-xs mt-1">Review student ratings, bug reports, and suggestions.</p>
        </div>
        <Button onClick={fetchFeedback} variant="outline" className="h-8 border-white/5 bg-[#141414] hover:bg-[#202020] text-xs flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#141414]/40 backdrop-blur-md overflow-x-auto shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading student feedback...</span>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs italic">
            No feedback entries have been submitted yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 font-semibold bg-[#1a1a1a]/40 font-heading">
                <th className="p-4">User</th>
                <th className="p-4 text-center">Type</th>
                <th className="p-4 text-center">Rating</th>
                <th className="p-4">Message</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {feedbacks.map((f) => (
                <tr key={f.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-4">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white block text-sm">{f.user_name}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{f.user_email}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      f.type === "bug" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      f.type === "feature" ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" :
                      "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="p-4 text-center font-bold text-yellow-400">
                    {"⭐".repeat(f.rating || 5)} <span className="text-slate-500 text-[10px]">({f.rating || 5}/5)</span>
                  </td>
                  <td className="p-4 text-slate-300 max-w-sm truncate">{f.message}</td>
                  <td className="p-4 text-slate-500">
                    {new Date(f.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
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
