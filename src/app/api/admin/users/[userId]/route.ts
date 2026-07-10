import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
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

