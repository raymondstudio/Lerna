"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, AlertTriangle, CheckCircle, Cpu, Loader2, Server, Webhook } from "lucide-react";

type HealthDiagnostics = {
  latencies: {
    apiGateway: number;
    geminiResponse: number;
    searchRetrieval: number;
    pdfProcessing: number;
  };
  failedAiRequests: Array<{
    id: string;
    model_used: string;
    request_type: string;
    error_message: string;
    created_at: string;
  }>;
  failedEvents: Array<{
    id: string;
    event_name: string;
    event_properties: any;
    created_at: string;
  }>;
  webhooks: Array<{
    service: string;
    status: string;
    lastEvent: string;
  }>;
  dbHealth: {
    missingProfiles: number;
    missingPreferences: number;
    missingNotifications: number;
    missingRoles: number;
    missingSubscriptions: number;
    duplicateProfiles: number;
    duplicateRoles: number;
    orphanSessions: number;
    failedQueue: number;
    databaseHealth: boolean;
  };
};

export function HealthTab() {
  const [data, setData] = useState<HealthDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/admin/health");
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to compile system health details.");
        }
      } catch (err) {
        setError("Error connecting to server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
        <span className="text-xs text-slate-500">Compiling health logs...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-red-400 text-xs italic">
        {error || "Unable to read operational metrics."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-400" /> Operational System Health
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          Monitor API Gateway, Gemini API error logs, search index processing, and webhook trigger status.
        </p>
      </div>

      {/* Latency card widgets */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">API Gateway</span>
            <div className="text-xl font-bold text-white">{data.latencies.apiGateway}ms</div>
          </div>
          <Server className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Gemini API latency</span>
            <div className="text-xl font-bold text-white">{data.latencies.geminiResponse}ms</div>
          </div>
          <Cpu className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">RAG query delay</span>
            <div className="text-xl font-bold text-white">{data.latencies.searchRetrieval}ms</div>
          </div>
          <CheckCircle className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">PDF Parsing</span>
            <div className="text-xl font-bold text-white">{data.latencies.pdfProcessing}ms</div>
          </div>
          <AlertCircle className="h-5 w-5 text-cyan-400" />
        </div>
      </div>

      {/* Database & Diagnostics Health Panel */}
      <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Database Integrity & Core Schema Diagnostics</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Status:</span>
            {(!data.dbHealth || 
              (data.dbHealth.missingProfiles === 0 &&
               data.dbHealth.missingPreferences === 0 &&
               data.dbHealth.missingNotifications === 0 &&
               data.dbHealth.missingRoles === 0 &&
               data.dbHealth.missingSubscriptions === 0 &&
               data.dbHealth.duplicateProfiles === 0 &&
               data.dbHealth.duplicateRoles === 0 &&
               data.dbHealth.orphanSessions === 0 &&
               data.dbHealth.failedQueue === 0)) ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                PASS
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                WARN
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 text-xs">
          {[
            { label: "Missing Profiles", value: data.dbHealth?.missingProfiles ?? 0 },
            { label: "Missing Preferences", value: data.dbHealth?.missingPreferences ?? 0 },
            { label: "Missing Notifications", value: data.dbHealth?.missingNotifications ?? 0 },
            { label: "Missing Roles", value: data.dbHealth?.missingRoles ?? 0 },
            { label: "Missing Subscriptions", value: data.dbHealth?.missingSubscriptions ?? 0 },
            { label: "Duplicate Profiles", value: data.dbHealth?.duplicateProfiles ?? 0 },
            { label: "Duplicate Roles", value: data.dbHealth?.duplicateRoles ?? 0 },
            { label: "Orphan Sessions", value: data.dbHealth?.orphanSessions ?? 0 },
            { label: "Failed Mail Queue", value: data.dbHealth?.failedQueue ?? 0 },
            { label: "DB Connection", value: data.dbHealth?.databaseHealth ? "Connected" : "Disconnected", raw: true }
          ].map((item, idx) => {
            const isError = item.raw ? item.value === "Disconnected" : Number(item.value) > 0;
            return (
              <div key={idx} className="p-4 rounded-xl bg-[#0a0a0a]/30 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 block font-semibold">{item.label}</span>
                <div className={`text-base font-bold ${isError ? "text-red-400" : "text-white"}`}>
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Failed AI Requests list */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <AlertTriangle className="h-4.5 w-4.5 text-yellow-500" />
            <h3 className="text-sm font-semibold text-white">Failed AI Requests</h3>
          </div>
          {data.failedAiRequests.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No failed queries logged.</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {data.failedAiRequests.map((req) => (
                <div key={req.id} className="p-3 rounded-xl bg-[#0a0a0a]/50 border border-white/5 text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-slate-300">
                    <span className="capitalize text-cyan-400 font-bold">{req.request_type}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(req.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-red-400 font-mono text-[11px] leading-relaxed pt-1">{req.error_message}</p>
                  <div className="text-[10px] text-slate-600">Model: {req.model_used}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Failed Telemetry Events list */}
        <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            <h3 className="text-sm font-semibold text-white">Application Failures & Errors</h3>
          </div>
          {data.failedEvents.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No failure event records.</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {data.failedEvents.map((evt) => (
                <div key={evt.id} className="p-3 rounded-xl bg-[#0a0a0a]/50 border border-white/5 text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-slate-300">
                    <span className="text-red-400 font-mono">{evt.event_name}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-400 font-mono text-[10px] truncate">
                    {JSON.stringify(evt.event_properties)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Webhook indicators */}
      <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/5">
          <Webhook className="h-4.5 w-4.5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Payment Webhook Integrations</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {data.webhooks.map((wh, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-[#0a0a0a]/40 border border-white/5 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-white block">{wh.service}</span>
                <span className="text-[10px] text-slate-500">Last webhook event: {wh.lastEvent}</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                {wh.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
