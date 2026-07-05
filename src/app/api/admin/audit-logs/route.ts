import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        details,
        created_at,
        profiles (
          email,
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const formatted = logs.map((l: any) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      created_at: l.created_at,
      user_email: l.profiles?.email || "system",
      user_name: l.profiles ? `${l.profiles.first_name || ""} ${l.profiles.last_name || ""}`.trim() : "System"
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[api:admin:audit-logs:GET] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
