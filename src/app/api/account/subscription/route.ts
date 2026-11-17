import { NextResponse } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import { getUserSubscription, getPlanLimits } from "@/lib/services/business";
import { PLAN_FEATURES } from "@/lib/services/features";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  try {
    const subscription = await getUserSubscription(auth.user.id);
    const limits = getPlanLimits(subscription.plan);
    const features = PLAN_FEATURES[subscription.plan.toLowerCase()] || PLAN_FEATURES.free;

    return NextResponse.json({
      success: true,
      subscription,
      limits,
      features,
    });
  } catch {
    console.error("[api:account:subscription] fetch failed");
    return NextResponse.json({ success: false, error: "Subscription could not be loaded." }, { status: 503 });
  }
}
