"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ActivityPage, ActivitySummary } from "@/lib/activity/contracts";
type FeedData = ActivityPage & { summary?: ActivitySummary };
type Snapshot = { key: string; data: FeedData | null; error: string | null };
function availability() { return !navigator.onLine ? "offline" : document.hidden ? "hidden" : "online"; }
function subscribeAvailability(notify: () => void) {
  document.addEventListener("visibilitychange", notify); window.addEventListener("online", notify); window.addEventListener("offline", notify);
  return () => { document.removeEventListener("visibilitychange", notify); window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}
export function useActivityFeed(queryString: string, endpoint = "/api/admin/events", enabled = true) {
  const queryKey = `${endpoint}?${queryString}`;
  const [history, setHistory] = useState<{ queryKey: string; params: string } | null>(null);
  const historyParams = history?.queryKey === queryKey ? history.params : null;
  const requestKey = historyParams ? `${endpoint}?${historyParams}` : queryKey;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [retry, setRetry] = useState(0);
  const available = useSyncExternalStore(subscribeAvailability, availability, () => "connecting");
  const current = snapshot?.key === requestKey ? snapshot : null;
  useEffect(() => {
    if (!enabled || available !== "online") return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(requestKey, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error ?? "Activity query failed.");
        if (!disposed) { setSnapshot({ key: requestKey, data: body.data, error: null }); failures = 0; }
      } catch (reason) {
        if (!disposed) { setSnapshot(previous => ({ key: requestKey, data: previous?.key === requestKey ? previous.data : null, error: reason instanceof Error ? reason.message : "Activity query failed." })); failures += 1; }
      } finally {
        // Requests never overlap. Historical pages stay fixed; availability
        // changes dispose this loop and abort the current request.
        if (!disposed && !historyParams) timer = setTimeout(() => void load(), Math.min(60000, 15000 * 2 ** failures));
      }
    };
    void load();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [requestKey, historyParams, retry, enabled, available]);
  const data = enabled ? current?.data ?? null : null;
  const older = useCallback(() => {
    if (!data?.nextCursor) return;
    const params = new URLSearchParams(queryString);
    params.set("range", "custom"); params.set("start_at", data.startAt); params.set("end_at", data.endAt); params.set("cursor", data.nextCursor);
    setHistory({ queryKey, params: params.toString() });
  }, [data, queryString, queryKey]);
  const connection = !enabled ? "Invalid filters" : available === "offline" ? "Disconnected" : available === "hidden" ? "Paused while hidden" : current?.error ? "Disconnected" : current?.data ? historyParams ? "Historical page" : "Connected" : "Connecting";
  return { data, error: enabled ? current?.error ?? null : null, loading: enabled && available === "online" && current === null, connection, historical: Boolean(historyParams), older, live: () => setHistory(null), refresh: () => setRetry(value => value + 1) };
}
