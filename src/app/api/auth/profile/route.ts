import { NextResponse } from "next/server";
import { authApiErrorResponse, requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { selectAuthProfile } from "@/lib/repositories/auth";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { supabase, user } = await requireActiveUserApi();
    const profile = await selectAuthProfile(supabase, user.id);
    return NextResponse.json({ success: true, data: profile }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
