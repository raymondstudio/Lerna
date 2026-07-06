import { NextResponse } from "next/server";
import { getInstitutionAnalytics } from "@/lib/repositories/institutions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    // Server-side admin verification
    const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
      : ["admin@eduagent.ai"];
    const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
    const isRoleAdmin = userData.user.app_metadata?.role === "admin";

    if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const data = await getInstitutionAnalytics();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[api:admin:institutions:analytics] Error:", err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
