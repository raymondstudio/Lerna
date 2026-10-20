import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { getAdminHealth } from "@/lib/repositories/health";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await authorizeAdminApi();
  if (!auth.ok) return auth.response;
  try { return NextResponse.json({ success: true, data: await getAdminHealth(auth.supabase) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ success: false, error: "System diagnostics are unavailable. Retry shortly." }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
