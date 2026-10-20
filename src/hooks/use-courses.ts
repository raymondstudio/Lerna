"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
export type CourseOption = { id: string; code: string; title: string; description?: string; created_at?: string; uploaded_materials?: { id: string }[] };

export const COURSES_QUERY_KEY = ["courses"] as const;

async function fetchCourses() {
  const res = await fetch("/api/courses");
  if (!res.ok) throw new Error("Failed to fetch courses");
  const data = await res.json();
  const courses = Array.isArray(data) ? data : data.courses;
  if (!Array.isArray(courses)) throw new Error("The course service returned an invalid response.");
  return courses as CourseOption[];
}

export function useCourses() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...COURSES_QUERY_KEY, user?.id ?? null],
    enabled: Boolean(user) && !loading,
    queryFn: fetchCourses,
    staleTime: 60 * 1000,
  });
}

export function useInvalidateCourses() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
}
