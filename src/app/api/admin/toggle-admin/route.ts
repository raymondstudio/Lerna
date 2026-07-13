import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["msuraymond@gmail.com"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { targetUserId, action } = await req.json();

    if (!targetUserId || !action) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
    }

    if (action === "add") {
      const { error: rpcError } = await supabase.rpc("add_admin", { target_user_id: targetUserId });
      
      if (rpcError) {
        console.warn("[api:admin:toggle] RPC add_admin failed, using direct query:", rpcError.message);
        const { error: queryError } = await supabase
          .from("user_roles")
          .upsert({ user_id: targetUserId, role: "admin" }, { onConflict: "user_id" });
        if (queryError) throw queryError;
      }

    } else if (action === "remove") {
      const { error: rpcError } = await supabase.rpc("remove_admin", { target_user_id: targetUserId });
      
      if (rpcError) {
        console.warn("[api:admin:toggle] RPC remove_admin failed, using direct query:", rpcError.message);
        const { error: queryError } = await supabase
          .from("user_roles")
          .upsert({ user_id: targetUserId, role: "user" }, { onConflict: "user_id" });
        if (queryError) throw queryError;
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api:admin:toggle] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
