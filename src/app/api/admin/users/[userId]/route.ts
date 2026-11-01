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
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json({ success: false, error: "Invalid account ID." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const { data, error } = await supabase.rpc("get_admin_user_details", {
      target_user_id: userId,
    });

    if (error) {
      console.error("[api:admin:user-details] RPC failed");
      return NextResponse.json({ success: false, error: "Account details could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
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
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:user-details] failed");
    return NextResponse.json({ success: false, error: "Account details could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

