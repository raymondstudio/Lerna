import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().slice(0, 120);
    const plan = (searchParams.get("plan") || "all").trim().slice(0, 40);
    const status = (searchParams.get("status") || "all").trim().slice(0, 40);
    const institution = (searchParams.get("institution") || "all").trim().slice(0, 160);
    const department = (searchParams.get("department") || "all").trim().slice(0, 160);
    const rawPage = Number(searchParams.get("page") || "1");
    const rawLimit = Number(searchParams.get("limit") || "10");
    const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 10_000 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 10;
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
      console.error("[api:admin:users] RPC failed");
      return NextResponse.json({ success: false, error: "Users could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }

    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:users] failed");
    return NextResponse.json({ success: false, error: "Users could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

