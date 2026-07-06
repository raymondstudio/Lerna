"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, Cpu, Server, AlertTriangle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AnalyticsTab() {
  const [latencyData, setLatencyData] = useState({
    apiGateway: 35,
    geminiResponse: 720,
    searchRetrieval: 95,
    pdfProcessing: 1280,
  });

  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const loadData = async () => {
      try {
        const res = await fetch("/api/admin/events?limit=20");
        const json = await res.json();
        if (json.success && json.data) {
          const { events, avgLatency } = json.data;
          if (events) {
            setRecentEvents(events.map((e: any) => ({
              id: e.id,
              event: e.event_type,
              properties: e.properties,
              timestamp: new Date(e.created_at).toLocaleTimeString()
            })));
          }
          if (avgLatency) {
            setLatencyData(prev => ({
              ...prev,
              geminiResponse: avgLatency
            }));
          }
          setError(null);
        } else {
          setError(json.error || "Failed to load system events");
        }
      } catch (e: any) {
        console.warn("[analytics-tab] failed to fetch real data:", e);
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const channel = supabase
      .channel("live_analytics_tab")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          const newEvent = {
            id: payload.new.id,
            event: payload.new.event_type,
            properties: payload.new.properties,
            timestamp: new Date(payload.new.created_at).toLocaleTimeString()
          };
          setRecentEvents(prev => [newEvent, ...prev.slice(0, 19)]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><strong>API Query Failed:</strong> {error}</span>
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Platform System Performance</h2>
        <p className="text-slate-400 text-xs mt-1">
          Monitor API endpoint response latencies and audit live application event telemetry streams.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* KPI latency cards */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">API Gateway</span>
            <div className="text-xl font-bold text-white mt-1">{latencyData.apiGateway}ms</div>
          </div>
          <Server className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Gemini API</span>
            <div className="text-xl font-bold text-white mt-1">{loading ? "..." : `${latencyData.geminiResponse}ms`}</div>
          </div>
          <Cpu className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">RAG Retrieval</span>
            <div className="text-xl font-bold text-white mt-1">{latencyData.searchRetrieval}ms</div>
          </div>
          <Clock className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">PDF Parse</span>
            <div className="text-xl font-bold text-white mt-1">{latencyData.pdfProcessing}ms</div>
          </div>
          <Activity className="h-5 w-5 text-cyan-400" />
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/5">
          <Activity className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Live Event Stream</h3>
        </div>

        <div className="space-y-3">
          {recentEvents.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-10 text-center">Awaiting platform activities...</p>
          ) : (
            recentEvents.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a0a0a]/50 border border-white/5 hover:bg-[#0a0a0a]/80 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-cyan-400 font-semibold">{evt.event}</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-md">
                    {JSON.stringify(evt.properties)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 shrink-0 font-medium">{evt.timestamp}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
