import { NextResponse } from "next/server";
import { requireActiveUserApi, AuthApiError } from "@/lib/auth/require-active-user-api";
import { AccountRepositoryError, updateAccountProfile } from "@/lib/repositories/account";
import { readSessionBody } from "@/lib/study-sessions/api";
import { SessionApiError } from "@/lib/repositories/study-sessions";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireActiveUserApi();
    const input = await readSessionBody(request);
    return NextResponse.json({ success: true, data: await updateAccountProfile(supabase, user.id, input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof AuthApiError || error instanceof AccountRepositoryError || error instanceof SessionApiError;
    return NextResponse.json({ success: false, error: known ? error.message : "Your profile could not be saved. Retry shortly." },
      { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
