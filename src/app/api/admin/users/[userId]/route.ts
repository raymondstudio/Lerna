import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { userId } = await params;

    const { data, error } = await supabase.rpc("get_admin_user_details", {
      target_user_id: userId,
    });

    if (error) {
      console.error("[api:admin:user-details] RPC failed:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Load additional billing info
    const { getSubscriptionHistory, getBillingHistory, getInvoices } = await import("@/lib/repositories/billing");
    const { data: subDetails } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
    const subscriptionHistory = await getSubscriptionHistory(userId).catch(() => []);
    const billingHistory = await getBillingHistory(userId).catch(() => []);
    const invoices = await getInvoices(userId).catch(() => []);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        subscription: subDetails,
        subscriptionHistory,
        billingHistory,
        invoices
      },
    });
  } catch (err) {
    console.error("[api:admin:user-details] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

