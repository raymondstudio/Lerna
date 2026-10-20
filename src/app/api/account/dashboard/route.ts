import { NextResponse } from "next/server";
import { requireActiveUserApi, AuthApiError } from "@/lib/auth/require-active-user-api";
import { getAccountDashboard } from "@/lib/repositories/account";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { supabase, user } = await requireActiveUserApi();
    return NextResponse.json({ success: true, data: await getAccountDashboard(supabase, user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof AuthApiError ? error.message : "Account details could not be loaded. Retry shortly." },
      { status: error instanceof AuthApiError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
