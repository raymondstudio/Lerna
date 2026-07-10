import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserSubscription, getPlanLimits } from "@/lib/services/business";
import { PLAN_FEATURES } from "@/lib/services/features";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);
    const limits = getPlanLimits(subscription.plan);
    const features = PLAN_FEATURES[subscription.plan.toLowerCase()] || PLAN_FEATURES.free;

    return NextResponse.json({
      success: true,
      subscription,
      limits,
      features,
    });
  } catch (err) {
    console.error("[api:account:subscription] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
