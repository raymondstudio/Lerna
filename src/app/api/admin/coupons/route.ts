import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { OperationError } from "@/lib/repositories/operations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { data, error } = await supabase
      .from("coupon_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      coupons: data || [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:coupons:GET] failed");
    return NextResponse.json({ success: false, error: "Coupons could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function POST(req: Request) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const body = await readBoundedJson(req, 4096);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid coupon payload." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const { code, discountType, discountValue, maxRedemptions, expiresAt } = body as Record<string, unknown>;

    if (typeof code !== "string" || !/^[A-Za-z0-9_-]{2,64}$/.test(code.trim())
      || (discountType !== "percentage" && discountType !== "fixed")
      || typeof discountValue !== "number" || !Number.isFinite(discountValue) || discountValue <= 0
      || (discountType === "percentage" && discountValue > 100)
      || (maxRedemptions !== undefined && maxRedemptions !== null && (typeof maxRedemptions !== "number" || !Number.isInteger(maxRedemptions) || maxRedemptions < 1))) {
      return NextResponse.json({ success: false, error: "Provide a valid coupon code, discount type, and value." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const { data, error } = await supabase
      .from("coupon_codes")
      .insert({
        code: code.toUpperCase().trim(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        max_redemptions: typeof maxRedemptions === "number" ? maxRedemptions : null,
        expires_at: typeof expiresAt === "string" && expiresAt.trim() ? expiresAt.trim() : null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Database trigger stabilization_coupon_audit writes the transactional v1 event.
    return NextResponse.json({
      success: true,
      coupon: data,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OperationError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("[api:admin:coupons:POST] failed");
    return NextResponse.json({ success: false, error: "Coupon could not be created." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function DELETE(req: Request) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim();

    if (!code || !/^[A-Za-z0-9_-]{2,64}$/.test(code)) {
      return NextResponse.json({ success: false, error: "Coupon code is required" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const { data, error } = await supabase
      .from("coupon_codes")
      .update({ is_active: false })
      .eq("code", code.toUpperCase())
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      coupon: data,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:coupons:DELETE] failed");
    return NextResponse.json({ success: false, error: "Coupon could not be disabled." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
