"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettingsTab() {
  const [flags, setFlags] = useState<Array<{ key: string; enabled: boolean; description: string }>>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const fetchFlags = async () => {
    try {
      setFlagsLoading(true);
      const res = await fetch("/api/admin/feature-flags");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setFlags(json.data);
      }
    } catch (err) {
      console.warn("[settings:flags] Failed to fetch flags:", err);
    } finally {
      setFlagsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await fetch("/api/admin/audit-logs");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLogs(json.data);
      }
    } catch (err) {
      console.warn("[settings:logs] Failed to fetch audit logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    void fetchFlags();
    void fetchLogs();
  }, []);

  const handleToggleFlag = async (key: string, enabled: boolean) => {
    try {
      setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
      
      const res = await fetch("/api/admin/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to update feature flag.");
        setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !enabled } : f));
      }
    } catch (err) {
      alert("Network error updating feature flag.");
      setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !enabled } : f));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Configuration column */}
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan-400" /> Platform Settings
          </h2>
          <p className="text-slate-400 text-xs mt-1">Modify environment variables and toggle feature flags.</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/60 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/5 text-slate-300 font-semibold text-xs">
            <ShieldCheck className="h-4.5 w-4.5 text-cyan-400" /> Database Feature Flags
          </div>
          
          {flagsLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-500" /> Loading flags...
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {flags.map((flag) => (
                <div key={flag.key} className="flex justify-between items-center gap-3">
                  <div>
                    <span className="font-semibold text-slate-200 block">{flag.key}</span>
                    <span className="text-[10px] text-slate-500 block">{flag.description}</span>
                  </div>
                  <button
                    onClick={() => handleToggleFlag(flag.key, !flag.enabled)}
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${flag.enabled ? "bg-cyan-500" : "bg-white/10"}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 bg-slate-950 w-4 h-4 rounded-full transition-transform ${flag.enabled ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-400" /> Audit Logging
            </h2>
            <p className="text-slate-400 text-xs mt-1">Real-time system events list tracked at database levels.</p>
          </div>
          <Button onClick={fetchLogs} variant="outline" className="h-8 border-white/5 bg-[#141414] hover:bg-[#202020] text-xs flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#141414]/40 backdrop-blur-md overflow-hidden shadow-xl max-h-[500px] overflow-y-auto pr-1">
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
              <span className="text-xs text-slate-500">Loading audit history...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-xs italic">
              No audit logs have been recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-white/5 text-xs">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-white/[0.01] transition-colors space-y-1">
                  <div className="flex justify-between items-start gap-4">
                    <span className="font-semibold text-cyan-400 capitalize">{log.action.replace("_", " ")}</span>
                    <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300 font-mono text-[10px] bg-[#0c0c0e] p-2 rounded border border-white/5">
                    {JSON.stringify(log.details)}
                  </p>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                    <span>Performed by: <strong>{log.user_name}</strong></span>
                    <span>({log.user_email})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
