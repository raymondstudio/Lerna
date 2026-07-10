import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserSubscription(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return {
      plan: "free",
      status: "active",
      billingCycle: "monthly",
    };
  }

  return {
    plan: data.plan,
    status: data.status,
    trialStart: data.trial_start,
    trialEnd: data.trial_end,
    renewalDate: data.renewal_date,
    billingCycle: data.billing_cycle,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    paymentProvider: data.payment_provider,
    providerCustomerId: data.provider_customer_id,
    providerSubscriptionId: data.provider_subscription_id,
  };
}

export async function getUserQuotaUsage(userId: string) {
  const supabase = await createSupabaseServerClient();
  
  // 1. Get plan
  const sub = await getUserSubscription(userId);
  const plan = sub.plan || "free";

  // 2. Fetch storage usage & document counts
  const { data: uploads } = await supabase
    .from("uploaded_materials")
    .select("file_size")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const totalUploadsCount = uploads?.length || 0;
  const totalStorageBytes = uploads?.reduce((sum, item) => sum + (item.file_size || 0), 0) || 0;

  // 3. Fetch monthly AI requests
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: aiCount } = await supabase
    .from("ai_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  // 4. Fetch monthly quiz generations
  const { count: quizCount } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  // 5. Fetch monthly flashcard generations from events telemetry
  const { count: flashcardCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "Generated flashcards")
    .gte("created_at", startOfMonth.toISOString());

  // 6. Fetch daily AI requests limits
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { count: dailyAiCount } = await supabase
    .from("ai_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday.toISOString());

  // Configure plan limits dynamically
  let limits = {
    aiRequests: 100,
    quizzes: 20,
    uploads: 10,
    storage: 50 * 1024 * 1024, // 50MB
    flashcards: 50,
    dailyRequests: 20,
  };

  const normPlan = plan.toLowerCase().trim();
  if (normPlan === "student") {
    limits = {
      aiRequests: 500,
      quizzes: 50,
      uploads: 50,
      storage: 500 * 1024 * 1024, // 500MB
      flashcards: 150,
      dailyRequests: 50,
    };
  } else if (normPlan === "pro" || normPlan === "premium") {
    limits = {
      aiRequests: 2000,
      quizzes: 200,
      uploads: 200,
      storage: 2 * 1024 * 1024 * 1024, // 2GB
      flashcards: 500,
      dailyRequests: 200,
    };
  } else if (normPlan === "team" || normPlan === "enterprise") {
    limits = {
      aiRequests: 10000,
      quizzes: 1000,
      uploads: 1000,
      storage: 10 * 1024 * 1024 * 1024, // 10GB
      flashcards: 5000,
      dailyRequests: 1000,
    };
  } else {
    // Free plan limits
    limits = {
      aiRequests: 100,
      quizzes: 20,
      uploads: 10,
      storage: 50 * 1024 * 1024, // 50MB
      flashcards: 50,
      dailyRequests: 20,
    };
  }

  return {
    plan,
    usage: {
      storageBytes: totalStorageBytes,
      uploadsCount: totalUploadsCount,
      aiRequests: aiCount || 0,
      quizzes: quizCount || 0,
      flashcards: flashcardCount || 0,
      dailyAiRequests: dailyAiCount || 0,
    },
    limits,
    remaining: {
      storageBytes: Math.max(0, limits.storage - totalStorageBytes),
      uploadsCount: Math.max(0, limits.uploads - totalUploadsCount),
      aiRequests: Math.max(0, limits.aiRequests - (aiCount || 0)),
      quizzes: Math.max(0, limits.quizzes - (quizCount || 0)),
      flashcards: Math.max(0, limits.flashcards - (flashcardCount || 0)),
      dailyRequests: Math.max(0, limits.dailyRequests - (dailyAiCount || 0)),
    }
  };
}
