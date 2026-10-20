import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { OperationError } from "@/lib/repositories/operations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { userId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json({ success: false, error: "Invalid account ID." }, { status: 400 });
    }
    const body = await readBoundedJson(req, 4096);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }
    const { action, value } = body as Record<string, unknown>;

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
      if (typeof value !== "string" || !["user", "support", "moderator", "admin", "owner"].includes(value)) {
        return NextResponse.json({ success: false, error: "Invalid role." }, { status: 400 });
      }
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
      const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      const { plan, status, isPromo } = input;
      if (typeof plan !== "string" || !["free", "student", "pro", "team", "premium", "enterprise"].includes(plan)) {
        return NextResponse.json({ success: false, error: "Plan name parameter is required." }, { status: 400 });
      }
      if (status !== undefined && (typeof status !== "string" || !["active", "inactive", "canceled", "past_due", "paused"].includes(status))) {
        return NextResponse.json({ success: false, error: "Invalid plan status." }, { status: 400 });
      }
      if (isPromo !== undefined && typeof isPromo !== "boolean") {
        return NextResponse.json({ success: false, error: "Invalid promotion flag." }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("admin_assign_plan", {
        target_user_id: userId,
        new_plan: plan,
        plan_status: status ?? "active",
        is_promo: isPromo ?? false
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === "reset-usage") {
      const { error } = await supabase.rpc("admin_reset_usage", { p_user_id: userId });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "extend-subscription") {
      const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      const days = input.days ?? 30;
      if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 366) {
        return NextResponse.json({ success: false, error: "Extension must be 1 to 366 days." }, { status: 400 });
      }
      const { data: currentPeriodEnd, error } = await supabase.rpc("admin_extend_subscription", { p_user_id: userId, p_days: days });
      if (error) throw error;
      return NextResponse.json({ success: true, currentPeriodEnd });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error) {
    if (error instanceof OperationError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[api:admin:user-action] failed");
    return NextResponse.json({ success: false, error: "The account action could not be completed." }, { status: 503 });
  }
}
