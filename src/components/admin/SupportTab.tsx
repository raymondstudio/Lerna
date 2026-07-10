"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Check, Loader2, RefreshCw, User, Shield, AlertTriangle, Search, MessageSquare, Send, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export function SupportTab() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolutionInput, setResolutionInput] = useState<{ [key: string]: string }>({});

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Thread dialog state
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tickets");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickets(json.data);
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

    const { createSupabaseBrowserClient } = require("@/lib/supabase/client");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("support_tickets_realtime_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => {
          void fetchTickets();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket((prev: any) => ({ ...prev, ...fields }));
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

  // Conversational Replies
  const fetchReplies = async (ticketId: string) => {
    try {
      setLoadingReplies(true);
      const res = await fetch(`/api/admin/tickets/replies?ticketId=${ticketId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReplies(json.data);
      }
    } catch (err) {
      console.error("[support-tab] Error fetching replies:", err);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleOpenThread = (ticket: any) => {
    setSelectedTicket(ticket);
    void fetchReplies(ticket.id);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setSendingReply(true);
      const res = await fetch("/api/admin/tickets/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selectedTicket.id, message: replyText.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setReplyText("");
        // Optimistic append
        const newReply = {
          id: json.data.id || String(Date.now()),
          message: json.data.message || replyText.trim(),
          created_at: json.data.created_at || new Date().toISOString(),
          sender_name: user?.email ? "Admin Staff" : "Tutor Support",
          sender_email: user?.email || "support@eduagent.ai"
        };
        setReplies(prev => [...prev, newReply]);
      } else {
        alert(json.error || "Failed to submit reply.");
      }
    } catch (err) {
      console.error("[support-tab] Error sending reply:", err);
    } finally {
      setSendingReply(false);
    }
  };

  // Client-side filtering logic
  const filteredTickets = tickets.filter(t => {
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      !term ||
      t.subject?.toLowerCase().includes(term) ||
      t.message?.toLowerCase().includes(term) ||
      t.user_name?.toLowerCase().includes(term) ||
      t.user_email?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || t.priority?.toLowerCase() === priorityFilter.toLowerCase();
    const matchesCategory = categoryFilter === "all" || t.category?.toLowerCase() === categoryFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-cyan-400" /> Support Helpdesk
          </h2>
          <p className="text-slate-400 text-xs mt-1">Review student issues, prioritize requests, and log conversational replies.</p>
        </div>
        <Button onClick={fetchTickets} variant="outline" className="h-8 border-white/5 bg-[#141414] hover:bg-[#202020] text-xs flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-[#141414] border-white/5 text-xs text-white rounded-xl placeholder-slate-500 focus-visible:ring-cyan-500/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-white/5 bg-[#141414] text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/20 cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-white/5 bg-[#141414] text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/20 cursor-pointer"
        >
          <option value="all">All Priorities</option>
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent Priority</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-white/5 bg-[#141414] text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/20 cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option value="Technical">Technical Help</option>
          <option value="Billing">Billing Issues</option>
          <option value="Account">Account Access</option>
          <option value="Other">General / Other</option>
        </select>
      </div>

      {/* Main Tickets Table */}
      <div className="rounded-2xl border border-white/5 bg-[#141414]/40 backdrop-blur-md overflow-x-auto shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading helpdesk tickets...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs italic">
            No support tickets are logged in the system matching filters.
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
                <th className="p-4">Status & Discussion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredTickets.map((t) => {
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
                          value={t.priority?.toLowerCase()}
                          onChange={(e) => handleUpdateTicket(t.id, { priority: e.target.value })}
                          className="h-8 rounded-lg border border-white/10 bg-[#1a1a1c] text-[11px] px-2 text-slate-300 cursor-pointer focus:outline-none font-bold"
                        >
                          <option value="low" className="text-blue-400 font-medium">Low</option>
                          <option value="medium" className="text-yellow-400 font-medium">Medium</option>
                          <option value="high" className="text-orange-400 font-medium">High</option>
                          <option value="urgent" className="text-red-400 font-bold">Urgent</option>
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
                    <td className="p-4 space-y-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
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
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleOpenThread(t)}
                        className="h-8 px-3 w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[11px] flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Discussion Thread
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Discussion Thread Dialog Overlay */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTicket(null)} />

          {/* Slide panel */}
          <div className="relative w-full max-w-md h-full bg-[#141414]/95 border-l border-white/10 backdrop-blur-xl shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#1a1a1a]/40">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-[280px]">{selectedTicket.subject}</h3>
                <p className="text-[10px] text-slate-500">Student: {selectedTicket.user_name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)} className="h-8 w-8 text-slate-400 hover:text-white rounded-lg">
                <X className="h-4.5 w-4.5" />
              </Button>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Original ticket request message */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-slate-300 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span className="font-semibold text-white">Student Ticket Body</span>
                  <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              {/* Replies listing */}
              <div className="space-y-3.5 pt-2">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1">Discussion replies</div>
                
                {loadingReplies ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    <span className="text-[10px] text-slate-500">Retrieving messages...</span>
                  </div>
                ) : replies.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic text-center py-6">No updates logged. Use input below to submit replies.</p>
                ) : (
                  replies.map((reply) => {
                    const isAdminSender = reply.sender_email !== selectedTicket.user_email;
                    return (
                      <div 
                        key={reply.id} 
                        className={`p-3 rounded-2xl border text-xs space-y-1.5 max-w-[90%] ${
                          isAdminSender 
                            ? "bg-cyan-950/20 border-cyan-500/25 ml-auto text-cyan-200" 
                            : "bg-[#1f1f23]/60 border-white/5 text-slate-300"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[9px] text-slate-500 gap-4">
                          <span className="font-semibold text-slate-400">{reply.sender_name} {isAdminSender && "⭐"}</span>
                          <span>{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="leading-relaxed break-words whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Input form */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-white/5 bg-[#1a1a1a]/40 space-y-3">
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type updates or resolution steps here..."
                  className="flex-1 p-2.5 rounded-xl border border-white/10 bg-[#0d0f12] text-xs text-slate-200 focus:outline-none focus:border-cyan-500/40 resize-none"
                  required
                />
                <Button 
                  type="submit" 
                  disabled={sendingReply || !replyText.trim()}
                  className="h-10 w-10 shrink-0 bg-cyan-500 hover:bg-cyan-600 text-black rounded-xl p-0 flex items-center justify-center"
                >
                  {sendingReply ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              {/* Quick Status Adjust tool */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-white/5">
                <span>Discussion Status:</span>
                <div className="flex gap-1">
                  {["open", "pending", "resolved"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateTicket(selectedTicket.id, { status: st })}
                      className={`px-2 py-0.5 rounded capitalize transition-colors font-bold ${
                        selectedTicket.status === st 
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                          : "hover:bg-white/5 text-slate-400"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
