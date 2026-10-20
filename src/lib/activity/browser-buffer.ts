"use client";
import type { BrowserActivity } from "./contracts";
type Pending = { event: BrowserActivity; attempts: number };
const pending: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let active = false;
let dropped = 0;
let failures = 0;
let identity: string | null = null;
let generation = 0;
let activityId: string | null = null;
export function resetActivityBuffer(userId: string | null) {
  if (identity === userId) return;
  generation += 1; pending.length = 0; clearTimeout(timer); timer = undefined; identity = userId; activityId = userId ? crypto.randomUUID() : null;
}
export function activityBufferDiagnostics() { return { queued: pending.length, dropped, failures }; }
export function reportRouteView(route: string) {
  if (!identity || !activityId) return;
  if (pending.length >= 100) { dropped += 1; return; }
  pending.push({ event: { event_id: crypto.randomUUID(), activity_id: activityId, event_type: "page.viewed", route }, attempts: 0 });
  schedule(1000);
}
function schedule(delay: number) { if (!timer && !active && pending.length) timer = setTimeout(() => { timer = undefined; void flush(); }, delay); }
async function flush() {
  if (active || !pending.length || !identity) return;
  const currentGeneration = generation;
  active = true;
  const batch = pending.splice(0, 20);
  try {
    const response = await fetch("/api/analytics/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: batch.map((item) => item.event) }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && response.status !== 429) { dropped += batch.length; return; }
      throw new Error("Activity ingestion unavailable.");
    }
  } catch {
    failures += 1;
    if (currentGeneration === generation) for (const item of batch.reverse()) {
      if (item.attempts >= 3 || pending.length >= 100) dropped += 1;
      else pending.unshift({ ...item, attempts: item.attempts + 1 });
    }
  } finally {
    active = false;
    schedule(Math.min(30000, 1000 * 2 ** (pending[0]?.attempts ?? 0)));
  }
}
