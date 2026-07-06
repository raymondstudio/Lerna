"use client";

import { useEffect, useState } from "react";
import { 
  Loader2, 
  MoreVertical, 
  Search, 
  ShieldCheck, 
  UserX, 
  Users, 
  ShieldAlert, 
  Download,
  AlertOctagon,
  UserCheck,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserDetailDrawer } from "./UserDetailDrawer";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  provider: string;
  joined_date: string;
  last_login: string;
  status: string;
  total_sessions: number;
  total_messages: number;
  documents_uploaded: number;
  current_plan: string;
  institution?: string;
  department?: string;
  country?: string;
};

export function UsersTab() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [debouncedInstitution, setDebouncedInstitution] = useState("");
  
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [debouncedDepartment, setDebouncedDepartment] = useState("");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Debounce institution filter
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInstitution(institutionFilter);
      setPage(1);
    }, 450);
    return () => clearTimeout(handler);
  }, [institutionFilter]);

  // Debounce department filter
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDepartment(departmentFilter);
      setPage(1);
    }, 450);
    return () => clearTimeout(handler);
  }, [departmentFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(debouncedSearch)}&plan=${planFilter}&status=${statusFilter}&institution=${encodeURIComponent(debouncedInstitution)}&department=${encodeURIComponent(debouncedDepartment)}&page=${page}&limit=${limit}`
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsers(json.data);
        if (json.data.length > 0) {
          setTotalCount(json.data[0].total_count || json.data.length);
        } else {
          setTotalCount(0);
        }
      }
    } catch (err) {
      console.error("[users-tab] Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [debouncedSearch, planFilter, statusFilter, debouncedInstitution, debouncedDepartment, page]);

  const handleUserAction = async (userId: string, action: "suspend" | "restore" | "delete" | "change-role" | "restore-deleted", value?: string) => {
    if (action === "delete") {
      const confirmDelete = window.confirm("Are you sure you want to permanently delete this user? This action is irreversible.");
      if (!confirmDelete) return;
    }

    try {
      setTogglingUserId(userId);
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value })
      });
      const data = await res.json();
      if (data.success) {
        await fetchUsers();
      } else {
        alert(data.error || `Failed to perform ${action}`);
      }
    } catch (err) {
      console.error(`[users-tab] Error performing ${action}:`, err);
    } finally {
      setTogglingUserId(null);
      setActionMenuOpen(null);
    }
  };

  // Client-side CSV export
  const handleExportCSV = () => {
    if (users.length === 0) return;
    const headers = ["ID", "Name", "Email", "Provider", "Joined Date", "Last Login", "Status", "Sessions", "Messages", "Uploads", "Plan", "Institution", "Department"];
    const rows = users.map(u => [
      u.id,
      u.name,
      u.email,
      u.provider,
      u.joined_date,
      u.last_login || "Never",
      u.status,
      u.total_sessions,
      u.total_messages,
      u.documents_uploaded,
      u.current_plan,
      u.institution || "",
      u.department || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `eduagent_users_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" /> User Directory
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Search, filter, and audit user permissions or check their platform interaction metrics.
          </p>
        </div>
        <Button onClick={handleExportCSV} className="h-9 text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-1.5 shadow-md">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Control Bar: Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search users by name or email address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-[#141414] border-white/5 rounded-xl text-white placeholder-slate-500 focus-visible:ring-cyan-500/30 w-full"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-4 rounded-xl border border-white/5 bg-[#141414] text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/30 cursor-pointer w-full"
          >
            <option value="all">All Plans</option>
            <option value="free">Free Tier</option>
            <option value="premium">Premium Tier</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-4 rounded-xl border border-white/5 bg-[#141414] text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/30 cursor-pointer w-full"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Admin">Admin</option>
            <option value="Suspended">Suspended</option>
            <option value="Deleted">Deleted (Soft)</option>
          </select>

          <Input
            placeholder="Filter by school..."
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
            className="h-10 bg-[#141414] border-white/5 rounded-xl text-white placeholder-slate-500 text-xs w-full"
          />

          <Input
            placeholder="Filter by course..."
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-10 bg-[#141414] border-white/5 rounded-xl text-white placeholder-slate-500 text-xs w-full"
          />
        </div>
      </div>

      {/* Table grid */}
      <div className="rounded-2xl border border-white/5 bg-[#141414]/40 backdrop-blur-md overflow-x-auto shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading directory...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs italic">
            No users match the selected query.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 font-semibold bg-[#1a1a1a]/40 font-heading">
                <th className="p-4">Name & Email</th>
                <th className="p-4">Auth Provider</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4">Last Login</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Sessions</th>
                <th className="p-4 text-center">Messages</th>
                <th className="p-4 text-center">Uploads</th>
                <th className="p-4">Plan</th>
                <th className="p-4 text-center w-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {users.map((u) => (
                <tr 
                  key={u.id} 
                  onClick={() => setInspectUserId(u.id)}
                  className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                >
                  <td className="p-4">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white block text-sm">{u.name}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{u.email}</span>
                    </div>
                  </td>
                  <td className="p-4 capitalize">
                    <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-400 font-medium">
                      {u.provider}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400">
                    {new Date(u.joined_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="p-4 text-slate-400">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never"}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      u.status === "Admin" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                      u.status === "Suspended" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      u.status === "Deleted" ? "bg-slate-600/20 text-slate-400 border border-slate-600/30" :
                      "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-center font-semibold text-white">{u.total_sessions}</td>
                  <td className="p-4 text-center font-semibold text-white">{u.total_messages}</td>
                  <td className="p-4 text-center font-semibold text-white">{u.documents_uploaded}</td>
                  <td className="p-4 font-semibold text-slate-400">
                    {u.current_plan}
                  </td>
                  <td className="p-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(actionMenuOpen === u.id ? null : u.id);
                      }}
                      className="h-8 w-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                      disabled={togglingUserId === u.id}
                    >
                      {togglingUserId === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </button>
                    {actionMenuOpen === u.id && (
                      <div className="absolute right-12 top-2 z-10 w-44 rounded-xl border border-white/10 bg-[#1c1c1e] p-1 shadow-2xl text-left space-y-0.5">
                        {u.status === "Deleted" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUserAction(u.id, "restore-deleted");
                            }}
                            className="w-full px-3 py-2 text-xs rounded-lg text-slate-200 hover:bg-white/5 flex items-center gap-2 font-medium"
                          >
                            <UserCheck className="h-3.5 w-3.5 text-emerald-400" /> Restore Account
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newRole = prompt("Enter new user role (user, support, moderator, admin, owner):", u.status === "Admin" ? "admin" : "user");
                                if (newRole && ["user", "support", "moderator", "admin", "owner"].includes(newRole.toLowerCase().trim())) {
                                  handleUserAction(u.id, "change-role", newRole.toLowerCase().trim());
                                }
                              }}
                              className="w-full px-3 py-2 text-xs rounded-lg text-slate-200 hover:bg-white/5 flex items-center gap-2 font-medium"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> Change Role
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextAct = u.status === "Suspended" ? "restore" : "suspend";
                                handleUserAction(u.id, nextAct);
                              }}
                              className="w-full px-3 py-2 text-xs rounded-lg text-slate-200 hover:bg-white/5 flex items-center gap-2 font-medium"
                            >
                              {u.status === "Suspended" ? (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" /> Restore Access
                                </>
                              ) : (
                                <>
                                  <AlertOctagon className="h-3.5 w-3.5 text-red-500" /> Suspend User
                                </>
                              )}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUserAction(u.id, "delete");
                              }}
                              className="w-full px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-500/10 flex items-center gap-2 font-medium"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" /> Delete User
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center text-xs font-medium">
        <span className="text-slate-500">
          Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total users)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
            className="h-8 px-3 rounded-lg border-white/5 bg-[#141414] hover:bg-[#202020] text-slate-300"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page === totalPages || loading}
            onClick={() => setPage(page + 1)}
            className="h-8 px-3 rounded-lg border-white/5 bg-[#141414] hover:bg-[#202020] text-slate-300"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Drawer Overlay */}
      {inspectUserId && (
        <UserDetailDrawer userId={inspectUserId} onClose={() => setInspectUserId(null)} />
      )}
    </div>
  );
}
