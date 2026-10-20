"use client";
import { ActivityPanel } from "./ActivityPanel";
export function AnalyticsTab() {
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold text-white">Activity investigation</h2><p className="mt-1 text-xs text-slate-400">Persisted operational outcomes and clearly identified browser reports.</p></div><ActivityPanel /></div>;
}
