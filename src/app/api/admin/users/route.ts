import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "all";
    const status = searchParams.get("status") || "all";
    const institution = searchParams.get("institution") || "all";
    const department = searchParams.get("department") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const { data, error } = await supabase.rpc("get_admin_users", {
      search_query: search,
      filter_plan: plan,
      filter_institution: institution,
      filter_department: department,
      filter_status: status,
      page_offset: offset,
      page_limit: limit,
    });

    if (error) {
      console.error("[api:admin:users] RPC failed:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:users] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

