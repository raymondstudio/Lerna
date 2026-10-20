import { NextResponse } from "next/server";
import { getBillingHistory } from "@/lib/repositories/billing";
import { getUserQuotaUsage } from "@/lib/services/business";
import { authApiErrorResponse, requireActiveUserApi } from "@/lib/auth/require-active-user-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireActiveUserApi();

    const history = await getBillingHistory(user.id);
    const quota = await getUserQuotaUsage(user.id);

    return NextResponse.json({
      success: true,
      history,
      quota,
    });
  } catch (error) {
    return authApiErrorResponse(error);
  }
}

export async function POST() {
  try { await requireActiveUserApi(); }
  catch (error) { return authApiErrorResponse(error); }
  // Historical percentage/fixed-discount vouchers have no verified entitlement or
  // checkout contract. The old endpoint incremented redemption outside the plan
  // update transaction and granted Pro regardless of the voucher's value.
  return NextResponse.json({ success: false, error: "Promo redemption is temporarily unavailable. No plan or voucher was changed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
