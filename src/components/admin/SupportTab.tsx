"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Check, Loader2, RefreshCw, User, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SupportTab() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolutionInput, setResolutionInput] = useState<{ [key: string]: string }>({});

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tickets");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickets(json.data);
        // Pre-fill resolution inputs state
        const inputs: { [key: string]: string } = {};
        json.data.forEach((t: any) => {
          inputs[t.id] = t.resolution_notes || "";
        });
        setResolutionInput(inputs);
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

  const handleUpdateTicket = async (ticketId: string, fields: any) => {
    try {
      setUpdatingId(ticketId);
      const res = await fetch("/api/admin/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, ...fields })
      });
      const json = await res.json();
      if (json.success) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...fields } : t));
        if (fields.assigned_to !== undefined) {
          await fetchTickets();
        }
      } else {
        alert(json.error || "Failed to update ticket.");
      }
    } catch (err) {
      console.error("[support-tab] Error updating ticket:", err);
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
          <p className="text-slate-400 text-xs mt-1">Review student issues, prioritize requests, and log resolutions.</p>
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
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 font-semibold bg-[#1a1a1a]/40 font-heading">
                <th className="p-4">Student Info</th>
                <th className="p-4">Details</th>
                <th className="p-4">Category & Priority</th>
                <th className="p-4">Assignee</th>
                <th className="p-4">Resolution Notes</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {tickets.map((t) => {
                const isAssignedToMe = user && t.assigned_to === user.id;
                return (
                  <tr key={t.id} className="hover:bg-white/[0.01] transition-colors align-top">
                    <td className="p-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-white block text-sm">{t.user_name}</span>
                        <span className="text-slate-500 font-mono text-[10px] block">{t.user_email}</span>
                        <span className="text-slate-500 text-[9px] block mt-1">
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 max-w-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-200 block text-xs">{t.subject}</span>
                        <p className="text-slate-400 text-[11px] leading-relaxed break-words whitespace-pre-wrap">{t.message}</p>
                      </div>
                    </td>
                    <td className="p-4 space-y-2 whitespace-nowrap">
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Category</label>
                        <select
                          value={t.category}
                          onChange={(e) => handleUpdateTicket(t.id, { category: e.target.value })}
                          className="h-8 rounded-lg border border-white/10 bg-[#1a1a1c] text-[11px] px-2 text-slate-300 cursor-pointer focus:outline-none"
                        >
                          <option value="Technical">Technical</option>
                          <option value="Billing">Billing</option>
                          <option value="Account">Account</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Priority</label>
                        <select
                          value={t.priority}
                          onChange={(e) => handleUpdateTicket(t.id, { priority: e.target.value })}
                          className="h-8 rounded-lg border border-white/10 bg-[#1a1a1c] text-[11px] px-2 text-slate-300 cursor-pointer focus:outline-none font-bold"
                        >
                          <option value="Low" className="text-blue-400 font-medium">Low</option>
                          <option value="Medium" className="text-yellow-400 font-medium">Medium</option>
                          <option value="High" className="text-orange-400 font-medium">High</option>
                          <option value="Urgent" className="text-red-400 font-bold">Urgent</option>
                        </select>
                      </div>
                    </td>
                    <td className="p-4 space-y-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <User className="h-3.5 w-3.5 text-cyan-500" />
                        <span className="text-[11px] font-semibold">{t.assignee_email || "Unassigned"}</span>
                      </div>
                      {user && t.assigned_to !== user.id && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateTicket(t.id, { assigned_to: user.id })}
                          className="h-7 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px]"
                        >
                          Claim Ticket
                        </Button>
                      )}
                    </td>
                    <td className="p-4 space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Log resolution steps taken..."
                        value={resolutionInput[t.id] || ""}
                        onChange={(e) => setResolutionInput(prev => ({ ...prev, [t.id]: e.target.value }))}
                        className="w-full p-2 rounded-lg border border-white/10 bg-[#0d0f12] text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500/40"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateTicket(t.id, { resolution_notes: resolutionInput[t.id] || "" })}
                        disabled={updatingId === t.id}
                        className="h-7 px-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px]"
                      >
                        Save Notes
                      </Button>
                    </td>
                    <td className="p-4">
                      {updatingId === t.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      ) : (
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateTicket(t.id, { status: e.target.value })}
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
