import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const audience = searchParams.get("audience") || "all";
  const institution = searchParams.get("institution");
  const department = searchParams.get("department");

  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    let query = supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Filter by audience criteria
    if (audience === "students") {
      query = query.eq("is_student", true);
    } else if (audience === "teachers") {
      query = query.eq("account_type", "Teacher");
    } else if (audience === "free" || audience === "premium" || audience === "pro" || audience === "enterprise") {
      query = query.eq("plan", audience);
    }

    if (institution && institution.trim() !== "") {
      query = query.ilike("institution", `%${institution.trim()}%`);
    }

    if (department && department.trim() !== "") {
      query = query.ilike("department", `%${department.trim()}%`);
    }

    const { count, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 });
  } catch (err) {
    console.error("[api:admin:broadcasts:audience-count] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
