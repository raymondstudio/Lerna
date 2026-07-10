import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBillingHistory } from "@/lib/repositories/billing";
import { getUserQuotaUsage } from "@/lib/services/business";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const history = await getBillingHistory(user.id);
    const quota = await getUserQuotaUsage(user.id);

    return NextResponse.json({
      success: true,
      history,
      quota,
    });
  } catch (err) {
    console.error("[api:account:billing] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ success: false, error: "Coupon code is required" }, { status: 400 });
    }

    const { redeemCoupon } = await import("@/lib/repositories/billing");
    const coupon = await redeemCoupon(user.id, code);

    // Apply plan upgrade to Pro for Phase 2 coupon validation
    const { error: subError } = await supabase
      .from("subscriptions")
      .update({
        plan: "pro",
        payment_provider: "coupon",
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (subError) throw subError;

    return NextResponse.json({
      success: true,
      message: `Coupon '${code}' successfully redeemed! You have been upgraded to the Pro plan.`,
      coupon,
    });
  } catch (err: any) {
    console.error("[api:account:billing:POST] Error:", err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 400 });
  }
}
