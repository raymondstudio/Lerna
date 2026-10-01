"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AdminRangePreset } from "@/lib/admin/analytics-range";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

function localDateTime(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function AdminAnalyticsProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<AdminRangePreset>("30d");
  const [timezone, setTimezone] = useState("UTC");
  const [customStart, setCustomStart] = useState(() => localDateTime(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const [customEnd, setCustomEnd] = useState(() => localDateTime(new Date()));
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (stored?.preset) setPreset(stored.preset);
      setTimezone(stored?.timezone || browserTimezone);
      if (stored?.customStart) setCustomStart(stored.customStart);
      if (stored?.customEnd) setCustomEnd(stored.customEnd);
    } catch {
      setTimezone(browserTimezone);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, timezone, customStart, customEnd }));
  }, [preset, timezone, customStart, customEnd]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setRefreshToken((value) => value + 1), 350);
    };
    let channel = supabase.channel("admin-bi-live");
    for (const table of ["events", "study_messages", "study_sessions", "uploaded_materials", "quizzes", "ai_requests", "profiles", "billing_transactions"] as const) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

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
