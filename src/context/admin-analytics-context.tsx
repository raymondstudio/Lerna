"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { ADMIN_RANGE_PRESETS, isValidTimezone, type AdminRangePreset } from "@/lib/admin/analytics-range";


type AdminAnalyticsContextValue = {
  preset: AdminRangePreset;
  timezone: string;
  customStart: string;
  customEnd: string;
  queryString: string;
  refreshToken: number;
  setPreset: (preset: AdminRangePreset) => void;
  setTimezone: (timezone: string) => void;
  setCustomStart: (value: string) => void;
  setCustomEnd: (value: string) => void;
};

const AdminAnalyticsContext = createContext<AdminAnalyticsContextValue | null>(null);
const STORAGE_KEY = "lerna-admin-analytics-range-v1";

let memorySettings: string | null = null;
function readSettings() { try { return localStorage.getItem(STORAGE_KEY) ?? memorySettings; } catch { return memorySettings; } }
function subscribeSettings(notify: () => void) {
  window.addEventListener("storage", notify); window.addEventListener("lerna-admin-range", notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener("lerna-admin-range", notify); };
}
function writeSettings(value: unknown) {
  memorySettings = JSON.stringify(value);
  try { localStorage.setItem(STORAGE_KEY, memorySettings); } catch { /* Preferences continue in memory when storage is unavailable. */ }
  window.dispatchEvent(new Event("lerna-admin-range"));
}

function localDateTime(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function AdminAnalyticsProvider({ children }: { children: ReactNode }) {
  const [defaults] = useState(() => ({ preset: "30d" as AdminRangePreset, timezone: "Africa/Lagos", customStart: localDateTime(new Date(Date.now()-86400000)), customEnd: localDateTime(new Date()) }));
  const stored = useSyncExternalStore(subscribeSettings, readSettings, () => null);
  const preferences = useMemo(() => {
    try {
      const value = JSON.parse(stored ?? "null");
      return { preset: ADMIN_RANGE_PRESETS.some(([key]) => key === value?.preset) ? value.preset as AdminRangePreset : defaults.preset,
        timezone: typeof value?.timezone === "string" && isValidTimezone(value.timezone) ? value.timezone : defaults.timezone,
        customStart: typeof value?.customStart === "string" ? value.customStart : defaults.customStart,
        customEnd: typeof value?.customEnd === "string" ? value.customEnd : defaults.customEnd };
    } catch { return defaults; }
  }, [stored, defaults]);
  const { preset, timezone, customStart, customEnd } = preferences;
  const setPreset = (value: AdminRangePreset) => writeSettings({ ...preferences, preset: value });
  const setTimezone = (value: string) => writeSettings({ ...preferences, timezone: value });
  const setCustomStart = (value: string) => writeSettings({ ...preferences, customStart: value });
  const setCustomEnd = (value: string) => writeSettings({ ...preferences, customEnd: value });
  const [refreshToken, setRefreshToken] = useState(0);
  useEffect(() => {
    if (preset === "custom") return;
    const timer = window.setInterval(() => { if (!document.hidden && navigator.onLine) setRefreshToken(value => value+1); }, 15000);
    return () => window.clearInterval(timer);
  }, [preset]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ range: preset, timezone });
    if (preset === "custom") {
      params.set("start_at", customStart);
      params.set("end_at", customEnd);
    }
    return params.toString();
  }, [preset, timezone, customStart, customEnd]);

  const value = useMemo(() => ({
    preset,
    timezone,
    customStart,
    customEnd,
    queryString,
    refreshToken,
    setPreset,
    setTimezone,
    setCustomStart,
    setCustomEnd,
  }), [preset, timezone, customStart, customEnd, queryString, refreshToken]);

  return <AdminAnalyticsContext.Provider value={value}>{children}</AdminAnalyticsContext.Provider>;
}

export function useAdminAnalytics() {
  const context = useContext(AdminAnalyticsContext);
  if (!context) throw new Error("useAdminAnalytics must be used inside AdminAnalyticsProvider");
  return context;
}
