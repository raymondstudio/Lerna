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

    if (action === "restore-deleted") {
      const { data, error } = await supabase.rpc("admin_toggle_soft_delete", {
        target_user_id: userId,
        delete_status: false
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === "assign-plan") {
      const { plan, status, isPromo } = value || {};
      if (!plan) {
        return NextResponse.json({ success: false, error: "Plan name parameter is required." }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("admin_assign_plan", {
        target_user_id: userId,
        new_plan: plan,
        plan_status: status || "active",
        is_promo: isPromo || false
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === "reset-usage") {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("subscription_usage")
        .upsert({
          user_id: userId,
          usage_date: today,
          ai_requests: 0,
          uploads: 0,
          quizzes: 0,
          flashcards: 0,
          ocr_pages: 0,
          voice_usage_seconds: 0
        }, { onConflict: "user_id,usage_date" });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        user_id: userData.user.id,
        action: "usage_reset",
        details: { target_user_id: userId }
      });
      return NextResponse.json({ success: true });
    }

    if (action === "extend-subscription") {
      const { days = 30 } = value || {};
      const { data: sub } = await supabase.from("subscriptions").select("current_period_end").eq("user_id", userId).maybeSingle();
      let currentEnd = sub?.current_period_end ? new Date(sub.current_period_end) : new Date();
      if (currentEnd < new Date()) currentEnd = new Date();
      currentEnd.setDate(currentEnd.getDate() + Number(days));

      const { error } = await supabase
        .from("subscriptions")
        .update({
          current_period_end: currentEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        user_id: userData.user.id,
        action: "subscription_extended",
        details: { target_user_id: userId, days }
      });
      return NextResponse.json({ success: true, currentPeriodEnd: currentEnd });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err) {
    console.error("[api:admin:user-action] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
