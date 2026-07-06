import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRecentEvents, getAverageAiLatency } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 20;

    const [events, avgLatency] = await Promise.all([
      getRecentEvents(limit),
      getAverageAiLatency()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        events,
        avgLatency
      }
    });
  } catch (err) {
    console.error("[api:admin:events] GET Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
