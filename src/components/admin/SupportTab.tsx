"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tickets");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickets(json.data);
      }
    } catch (err) {
      console.error("[support-tab] Error fetching tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      setUpdatingId(ticketId);
      const res = await fetch("/api/admin/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      } else {
        alert(json.error || "Failed to update ticket status.");
      }
    } catch (err) {
      console.error("[support-tab] Error updating status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-cyan-400" /> Support Helpdesk
          </h2>
          <p className="text-slate-400 text-xs mt-1">Review student issues and resolve user help tickets.</p>
        </div>
        <Button onClick={fetchTickets} variant="outline" className="h-8 border-white/5 bg-[#141414] hover:bg-[#202020] text-xs flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#141414]/40 backdrop-blur-md overflow-x-auto shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading helpdesk tickets...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs italic">
            No support tickets are logged in the system.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 font-semibold bg-[#1a1a1a]/40 font-heading">
                <th className="p-4">User</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Message</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center w-36">Change Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-4">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white block text-sm">{t.user_name}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{t.user_email}</span>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-slate-200">{t.subject}</td>
                  <td className="p-4 text-slate-400 max-w-sm truncate">{t.message}</td>
                  <td className="p-4 text-slate-500">
                    {new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      t.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      t.status === "pending" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                      "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {updatingId === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400 mx-auto" />
                    ) : (
                      <select
                        value={t.status}
                        onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                        className="h-8 rounded-lg border border-white/10 bg-[#1a1a1c] text-xs px-2 text-slate-300 cursor-pointer focus:outline-none"
                      >
                        <option value="open">Open</option>
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    )}
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
