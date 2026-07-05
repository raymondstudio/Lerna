import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
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
    const { userId } = await params;
    const { action, value } = await req.json();

    if (!action) {
      return NextResponse.json({ success: false, error: "Action is required." }, { status: 400 });
    }

    if (action === "suspend") {
      const { data, error } = await supabase.rpc("admin_toggle_suspension", {
        target_user_id: userId,
        suspend_status: true
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === "restore") {
      const { data, error } = await supabase.rpc("admin_toggle_suspension", {
        target_user_id: userId,
        suspend_status: false
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === "change-role") {
      const { data, error } = await supabase.rpc("admin_change_role", {
        target_user_id: userId,
        new_role: value
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === "delete") {
      const { data, error } = await supabase.rpc("admin_delete_user", {
        target_user_id: userId
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err) {
    console.error("[api:admin:user-action] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
