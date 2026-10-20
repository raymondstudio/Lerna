import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";
import { parseAdminAnalyticsRange } from "@/lib/admin/analytics-range";
import { getAdminReport } from "@/lib/repositories/admin-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const url = new URL(req.url);
    let range;
    try { range = parseAdminAnalyticsRange(url.searchParams); }
    catch { return NextResponse.json({ success: false, error: "Check the report range and timezone." }, { status: 400 }); }
    return NextResponse.json({ success: true, data: await getAdminReport(supabase, range) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[api:admin:analytics] Exception:", err);
    return NextResponse.json({ success: false, error: "The historical report is unavailable. Retry shortly." }, { status: 503 });
  }
}
