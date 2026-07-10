import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const audience = searchParams.get("audience") || "all";
  const institution = searchParams.get("institution");
  const department = searchParams.get("department");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["admin@eduagent.ai"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

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
