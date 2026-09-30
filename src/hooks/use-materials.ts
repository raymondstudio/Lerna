"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export const MATERIALS_QUERY_KEY = ["materials"] as const;

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Failed to fetch materials");
  const data = await res.json();
  return (Array.isArray(data) ? data : data.materials ?? []) as any[];
}

export function useMaterials() {
  return useQuery({
    queryKey: MATERIALS_QUERY_KEY,
    queryFn: fetchMaterials,
    staleTime: 60 * 1000,
  });
}

export function useInvalidateMaterials() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: MATERIALS_QUERY_KEY });
}
