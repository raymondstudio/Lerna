"use client";
import { useEffect } from "react";
/** Refresh guarded API reads; never subscribe the browser to broad table payloads. */
export function useVisibleRefresh(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => { if (!document.hidden && navigator.onLine) refresh(); }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh, enabled]);
}
