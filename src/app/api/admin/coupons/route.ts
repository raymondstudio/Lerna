import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Helper check
async function checkAdminAuth(supabase: any) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return false;

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e: string) => e.trim())
    : ["admin@eduagent.ai"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  return !!(isAdmin || isFallbackAdmin || isRoleAdmin);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!(await checkAdminAuth(supabase))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from("coupon_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      coupons: data || [],
    });
  } catch (err) {
    console.error("[api:admin:coupons:GET] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  if (!(await checkAdminAuth(supabase))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { code, discountType, discountValue, maxRedemptions, expiresAt } = body;

    if (!code || !discountType || discountValue === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("coupon_codes")
      .insert({
        code: code.toUpperCase().trim(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expires_at: expiresAt || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Log to audit log
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id,
      action: "coupon_created",
      details: { code: code.toUpperCase(), discountType, discountValue }
    });

    return NextResponse.json({
      success: true,
      coupon: data,
    });
  } catch (err) {
    console.error("[api:admin:coupons:POST] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  if (!(await checkAdminAuth(supabase))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ success: false, error: "Coupon code is required" }, { status: 400 });
    }

    // Soft delete by updating is_active to false
    const { data, error } = await supabase
      .from("coupon_codes")
      .update({ is_active: false })
      .eq("code", code.toUpperCase().trim())
      .select()
      .single();

    if (error) throw error;

    // Log to audit log
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id,
      action: "coupon_disabled",
      details: { code: code.toUpperCase() }
    });

    return NextResponse.json({
      success: true,
      coupon: data,
    });
  } catch (err) {
    console.error("[api:admin:coupons:DELETE] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
