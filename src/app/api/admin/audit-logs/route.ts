import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

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

    const formatted = logs.map((l) => {
      const profile = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
      return {
      id: l.id,
      action: l.action,
      details: l.details,
      created_at: l.created_at,
      user_email: profile?.email || "system",
      user_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "System"
      };
    });

    return NextResponse.json({ success: true, data: formatted }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:audit-logs:GET] failed");
    return NextResponse.json({ success: false, error: "Audit logs could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
