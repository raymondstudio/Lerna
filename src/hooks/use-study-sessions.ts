"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const SESSIONS_QUERY_KEY = ["study-sessions"] as const;

async function fetchSessions() {
  const res = await fetch("/api/study-sessions?summary=true&limit=50", {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to fetch sessions");
  const payload = await res.json();
  return payload.data?.sessions ?? [];
}

export function useStudySessions() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: fetchSessions,
    staleTime: 30 * 1000,
  });
}

export function useInvalidateSessions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
}
