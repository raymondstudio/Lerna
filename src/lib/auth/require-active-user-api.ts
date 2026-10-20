import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthApiError extends Error {
  constructor(message: string, public readonly status: 401 | 403 | 503, public readonly code = "UNAUTHORIZED") {
    super(message);
    this.name = "AuthApiError";
  }
}

export async function requireAuthenticatedUserApi() {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new AuthApiError("Please sign in again.", 401, "UNAUTHENTICATED");
    return { supabase, user: data.user };
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError("Authentication is temporarily unavailable. Please retry.", 503, "AUTH_UNAVAILABLE");
  }
}

export async function requireActiveUserApi() {
  const context = await requireAuthenticatedUserApi();
  try {
    const { data, error } = await context.supabase.rpc("is_active_user", { user_id: context.user.id });
    if (error) throw new AuthApiError("Account verification is temporarily unavailable. Please retry.", 503, "AUTH_UNAVAILABLE");
    if (data !== true) throw new AuthApiError("This account is unavailable. Contact support for help.", 403, "ACCOUNT_INACTIVE");
    return context;
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError("Account verification is temporarily unavailable. Please retry.", 503, "AUTH_UNAVAILABLE");
  }
}

export function authApiErrorResponse(error: unknown) {
  const failure = error instanceof AuthApiError ? error
    : new AuthApiError("Account verification is temporarily unavailable. Please retry.", 503, "AUTH_UNAVAILABLE");
  return NextResponse.json({
    success: false, error: failure.message, code: failure.code,
    ...(failure.code === "MFA_REQUIRED" ? { stepUpPath: "/auth/mfa" } : {}),
  }, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
}

export async function authorizeActiveUserApi() {
  try {
    return { ok: true as const, ...await requireActiveUserApi() };
  } catch (error) {
    return { ok: false as const, response: authApiErrorResponse(error) };
  }
}
