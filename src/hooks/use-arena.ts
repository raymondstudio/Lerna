"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { ArenaRoom } from "@/types/arena";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const ARENA_ROOM_QUERY_KEY = (code: string) => ["arena", "room", code.toUpperCase()] as const;
export const ARENA_LIST_QUERY_KEY = ["arena", "list"] as const;

export function useArenaRoom(code?: string) {
  const queryClient = useQueryClient();
  const cleanCode = (code || "").toUpperCase().trim();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const query = useQuery<ArenaRoom>({
    queryKey: ARENA_ROOM_QUERY_KEY(cleanCode),
    queryFn: async () => {
      const res = await fetch(`/api/arena/${cleanCode}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Room not found.");
      }
      return json.data;
    },
    enabled: Boolean(cleanCode && cleanCode.length >= 4),
    // Fallback polling every 3 seconds only if needed
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "lobby" || status === "in_progress") {
        return 3000;
      }
      return false;
    },
    staleTime: 1000,
  });

  // Supabase Realtime WebSocket Channel
  useEffect(() => {
    if (!cleanCode || !supabase) return;

    // Join room's dedicated WebSocket channel
    const channel = supabase.channel(`arena_ws_${cleanCode}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "room_event" }, () => {
        // Instant WebSocket notification: invalidate and refetch data
        void queryClient.invalidateQueries({ queryKey: ARENA_ROOM_QUERY_KEY(cleanCode) });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
        }
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [cleanCode, supabase, queryClient]);

  // Helper to send instant WebSocket broadcast
  const broadcastUpdate = () => {
    if (channelRef.current) {
      void channelRef.current.send({
        type: "broadcast",
        event: "room_event",
        payload: { timestamp: Date.now() },
      });
    }
  };

  return { ...query, broadcastUpdate };
}

export function useArenaList() {
  return useQuery<ArenaRoom[]>({
    queryKey: ARENA_LIST_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/arena");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load battles.");
      return json.data;
    },
    staleTime: 10000,
  });
}

export function useArenaActions(code?: string, onBroadcast?: () => void) {
  const queryClient = useQueryClient();
  const cleanCode = (code || "").toUpperCase().trim();

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/arena/${cleanCode}/start`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to start battle.");
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ARENA_ROOM_QUERY_KEY(cleanCode), data);
      onBroadcast?.();
    },
  });

  const progressMutation = useMutation({
    mutationFn: async (payload: { totalAnswered: number; answers: Record<string, string> }) => {
      await fetch(`/api/arena/${cleanCode}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      onBroadcast?.();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { answers: Record<string, string>; timeTakenSeconds?: number }) => {
      const res = await fetch(`/api/arena/${cleanCode}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to submit battle.");
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ARENA_ROOM_QUERY_KEY(cleanCode), data);
      onBroadcast?.();
    },
  });

  return {
    startBattle: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    updateProgress: progressMutation.mutateAsync,
    submitAnswers: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}
