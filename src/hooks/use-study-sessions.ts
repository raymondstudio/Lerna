"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StudySessionRecord } from "@/lib/study-sessions/types";

export const SESSIONS_QUERY_KEY = ["study-sessions"] as const;

export function sessionQueryKey(sessionId: string | null) {
  return ["study-session", sessionId] as const;
}

async function fetchSessions(): Promise<StudySessionRecord[]> {
  const res = await fetch("/api/study-sessions?summary=true&limit=50", {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to fetch sessions");
  const payload = await res.json();
  return payload.data?.sessions ?? [];
}

async function fetchSessionDetails(sessionId: string): Promise<StudySessionRecord | null> {
  const res = await fetch(`/api/study-sessions/${encodeURIComponent(sessionId)}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to fetch session details");
  const payload = await res.json();
  return payload.data?.session ?? null;
}

export function useStudySessions() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: fetchSessions,
    staleTime: 60 * 1000,
  });
}

export function useSessionDetails(sessionId: string | null) {
  return useQuery({
    queryKey: sessionQueryKey(sessionId),
    queryFn: () => (sessionId && !sessionId.startsWith("temp-") ? fetchSessionDetails(sessionId) : Promise.resolve(null)),
    enabled: Boolean(sessionId && !sessionId.startsWith("temp-")),
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
  });
}

export function usePrefetchSession() {
  const qc = useQueryClient();
  return (sessionId: string) => {
    qc.prefetchQuery({
      queryKey: sessionQueryKey(sessionId),
      queryFn: () => fetchSessionDetails(sessionId),
      staleTime: 5000,
    });
  };
}

export function useInvalidateSessions() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
  };
}
