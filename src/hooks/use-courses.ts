"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const COURSES_QUERY_KEY = ["courses"] as const;

async function fetchCourses() {
  const res = await fetch("/api/courses");
  if (!res.ok) throw new Error("Failed to fetch courses");
  const data = await res.json();
  return (Array.isArray(data) ? data : data.courses ?? []) as any[];
}

export function useCourses() {
  return useQuery({
    queryKey: COURSES_QUERY_KEY,
    queryFn: fetchCourses,
    staleTime: 60 * 1000,
  });
}

export function useInvalidateCourses() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
}
