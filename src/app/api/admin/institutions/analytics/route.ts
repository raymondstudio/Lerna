import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";
import { getInstitutionAnalytics } from "@/lib/repositories/institutions";

export async function GET() {
  try {
    const authorization = await authorizeAdminApi();
    if (!authorization.ok) return authorization.response;


    const data = await getInstitutionAnalytics();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:institutions:analytics] Error:", err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Institution analytics could not be loaded." }, { status: 500 });
  }
}
