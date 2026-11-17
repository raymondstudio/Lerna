"use client";

import { useState } from "react";
import { Bot, Coins, Headphones, Megaphone, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AgentTab() {
  const [agents] = useState([
    {
      id: "marketing",
      name: "Marketing Agent",
      description: "Monitors acquisition channels, drafts campaign copies, and auto-adjusts referral thresholds based on conversion data.",
      icon: Megaphone,
      status: "ready_to_plug",
      capabilities: ["Auto-campaign creation", "UTM conversion audit", "Attribution forecasting"],
    },
    {
      id: "finance",
      name: "Finance Agent",
      description: "Analyzes token usage margins, handles invoice queries, processes future premium subscriptions, and flags billing anomalies.",
      icon: Coins,
      status: "ready_to_plug",
      capabilities: ["Token margin auditor", "Revenue forecasting", "Churn cost calculation"],
    },
    {
      id: "support",
      name: "Support Agent",
      description: "Directly resolves student tickets, analyzes application performance metrics, and summarizes feedback rating statistics.",
      icon: Headphones,
      status: "ready_to_plug",
      capabilities: ["Ticket auto-resolution", "Sentiment auditing", "Feedback summaries"],
    },
    {
      id: "product",
      name: "Product Agent",
      description: "Audits quiz pass rates and learning content engagement to recommend changes in UI copy or question frequencies.",
      icon: Bot,
      status: "ready_to_plug",
      capabilities: ["Quiz accuracy audits", "Feature leakage detector", "A/B copy optimizer"],
    },
    {
      id: "analytics",
      name: "Analytics Agent",
      description: "Synthesizes performance metrics and usage logs, compiling weekly dashboard summaries without writing SQL.",
      icon: TrendingUp,
      status: "ready_to_plug",
      capabilities: ["Auto-SQL aggregations", "Outlier alerting", "Weekly KPI reports"],
    },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">AI Business Agents Workspace</h2>
        <p className="text-slate-400 text-xs mt-1">
          Reserve workspace slots for future AI agents to autonomously manage platform analytics, operations, and support.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.id}
              className="group p-6 rounded-2xl border border-white/5 bg-[#141414]/50 backdrop-blur-md hover:border-cyan-500/30 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Agent Slot</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Ready
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{agent.description}</p>

                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Capabilities:</div>
                  <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                    {agent.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-cyan-500" />
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-white/5">
                <Button className="w-full h-9 bg-white hover:bg-slate-200 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2">
                  Deploy Agent
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
