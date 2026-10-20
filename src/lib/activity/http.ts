import { NextResponse } from "next/server";
import { ActivityError } from "./contracts";
export function activityFailure(error: unknown) {
  const typed = error as { status?: number; message?: string; code?: string };
  if (error instanceof ActivityError || (typed?.status && [401, 403, 429, 503].includes(typed.status))) {
    return NextResponse.json({ success: false, error: typed.message ?? "Activity request denied.", code: typed.code, ...(typed.code === "MFA_REQUIRED" ? { stepUpPath: "/auth/mfa" } : {}) }, { status: typed.status ?? 400, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ success: false, error: "Activity is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}
