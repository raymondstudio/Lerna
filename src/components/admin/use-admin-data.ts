"use client";
import { useCallback, useEffect, useState } from "react";

/** API reads are keyed by URL and reload, with cancellation on replacement. */
export function useAdminData<T>(url: string, field: "data" | null = "data") {
  const [revision, setRevision] = useState(0);
  const key = `${url}:${revision}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const current = result?.key === key ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || body.success !== true) throw new Error(body.error || "Admin data is unavailable.");
        const data: T = field === null ? body : body[field];
        if (data == null) throw new Error("The admin service returned no data.");
        if (!controller.signal.aborted) setResult({ key, data, error: null });
      })
      .catch(reason => {
        if (!controller.signal.aborted) setResult({ key, data: null, error: reason instanceof Error ? reason.message : "Admin data is unavailable." });
      });
    return () => controller.abort();
  }, [url, key, field]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const setData = useCallback((update: (previous: T | null) => T | null) => {
    setResult(previous => ({ key, data: update(previous?.key === key ? previous.data : null), error: null }));
  }, [key]);
  return { data: current?.data ?? null, loading: current === null, error: current?.error ?? null, reload, setData };
}
