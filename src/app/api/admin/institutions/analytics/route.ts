import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";
import { getInstitutionAnalytics } from "@/lib/repositories/institutions";

export async function GET() {
  try {
    const authorization = await authorizeAdminApi();
    if (!authorization.ok) return authorization.response;


    const data = await getInstitutionAnalytics();
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:institutions:analytics] failed");
    return NextResponse.json({ success: false, error: "Institution analytics could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
