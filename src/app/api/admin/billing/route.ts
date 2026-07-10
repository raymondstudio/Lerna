import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
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
    // 1. Plan Distribution counts
    const { data: subData } = await supabase
      .from("subscriptions")
      .select("plan");

    const distribution = {
      free: 0,
      student: 0,
      pro: 0,
      team: 0,
      enterprise: 0,
    };

    if (subData) {
      subData.forEach((s) => {
        const p = (s.plan || "free").toLowerCase().trim();
        if (p === "student") distribution.student++;
        else if (p === "pro" || p === "premium") distribution.pro++;
        else if (p === "team") distribution.team++;
        else if (p === "enterprise") distribution.enterprise++;
        else distribution.free++;
      });
    }

    // 2. Transaction status grouping & Revenue sums
    const { data: txData } = await supabase
      .from("billing_transactions")
      .select("status, amount, currency");

    const transactions = {
      pending: 0,
      successful: 0,
      failed: 0,
      totalAmount: 0,
    };

    if (txData) {
      txData.forEach((t) => {
        if (t.status === "successful") {
          transactions.successful++;
          transactions.totalAmount += Number(t.amount || 0);
        } else if (t.status === "failed") {
          transactions.failed++;
        } else {
          transactions.pending++;
        }
      });
    }

    // MRR/ARR/ARPU calculations
    const activeUsersCount = Object.values(distribution).reduce((a, b) => a + b, 0);
    const mrr = distribution.student * 5 + distribution.pro * 12 + distribution.team * 50 + distribution.enterprise * 200;
    const arr = mrr * 12;
    const arpu = activeUsersCount > 0 ? Number((mrr / activeUsersCount).toFixed(2)) : 0;

    // 3. Usage Totals sums
    const { data: usageData } = await supabase
      .from("subscription_usage")
      .select("ai_requests, uploads, quizzes, flashcards, ocr_pages, voice_usage_seconds");

    const usageTotals = {
      aiRequests: 0,
      uploads: 0,
      quizzes: 0,
      flashcards: 0,
      ocrPages: 0,
      voiceSeconds: 0,
    };

    if (usageData) {
      usageData.forEach((u) => {
        usageTotals.aiRequests += u.ai_requests || 0;
        usageTotals.uploads += u.uploads || 0;
        usageTotals.quizzes += u.quizzes || 0;
        usageTotals.flashcards += u.flashcards || 0;
        usageTotals.ocrPages += u.ocr_pages || 0;
        usageTotals.voiceSeconds += u.voice_usage_seconds || 0;
      });
    }

    // 4. Coupons listing
    const { data: coupons } = await supabase
      .from("coupon_codes")
      .select("*")
      .order("created_at", { ascending: false });

    // 5. Recent subscription history records
    // Since SQL relationships might not be parsed directly without custom views, we select profiles data.
    const { data: recentHistory } = await supabase
      .from("subscription_history")
      .select(`
        id,
        user_id,
        old_plan,
        new_plan,
        reason,
        created_at,
        profiles(email, first_name, last_name)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      stats: {
        distribution,
        transactions,
        mrr,
        arr,
        arpu,
        usageTotals,
      },
      coupons: coupons || [],
      recentHistory: recentHistory || [],
    });
  } catch (err) {
    console.error("[api:admin:billing] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
