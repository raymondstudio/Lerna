"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { UploadedMaterialRecord } from "@/lib/uploads/types";
export type StudyMaterialOption = { id: string; file_name: string; course_id: string; status: string };

export const MATERIALS_QUERY_KEY = ["materials"] as const;

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Failed to fetch materials");
  const data = await res.json();
  if (data.success !== true || !Array.isArray(data.data?.materials)) throw new Error("The material service returned an invalid response.");
  return (data.data.materials as UploadedMaterialRecord[]).map((material): StudyMaterialOption => ({ id: material.id, file_name: material.fileName, course_id: material.courseId ?? "", status: material.status }));
}

export function useMaterials() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...MATERIALS_QUERY_KEY, user?.id ?? null],
    enabled: Boolean(user) && !loading,
    queryFn: fetchMaterials,
    staleTime: 60 * 1000,
  });
}

export function useInvalidateMaterials() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: MATERIALS_QUERY_KEY });
}
