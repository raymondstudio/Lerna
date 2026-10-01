"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export const QUIZ_LIST_QUERY_KEY = ["quiz", "list"] as const;
export const QUIZ_DETAIL_QUERY_KEY = (id: string) => ["quiz", id] as const;

async function fetchQuizList() {
  const res = await fetch("/api/quiz");
  if (!res.ok) throw new Error("Failed to fetch quizzes");
  const data = await res.json();
  return data.quizzes ?? data ?? [];
}

export function useQuizList() {
  return useQuery({
    queryKey: QUIZ_LIST_QUERY_KEY,
    queryFn: fetchQuizList,
    staleTime: 60 * 1000,
  });
}

export function useInvalidateQuizList() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QUIZ_LIST_QUERY_KEY });
}
