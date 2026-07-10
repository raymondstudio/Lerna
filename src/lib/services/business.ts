import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planHasFeature, FeatureName } from "./features";

export const PLAN_LIMITS = {
  free: {
    aiRequests: 100,
    quizzes: 20,
    uploads: 10,
    storage: 50 * 1024 * 1024, // 50MB
    flashcards: 50,
    dailyRequests: 20,
    ocrPages: 5,
    voiceSeconds: 120,
  },
  student: {
    aiRequests: 500,
    quizzes: 50,
    uploads: 50,
    storage: 500 * 1024 * 1024, // 500MB
    flashcards: 150,
    dailyRequests: 50,
    ocrPages: 20,
    voiceSeconds: 600,
  },
  pro: {
    aiRequests: 2000,
    quizzes: 200,
    uploads: 200,
    storage: 2 * 1024 * 1024 * 1024, // 2GB
    flashcards: 500,
    dailyRequests: 200,
    ocrPages: 100,
    voiceSeconds: 3600,
  },
  premium: {
    aiRequests: 2000,
    quizzes: 200,
    uploads: 200,
    storage: 2 * 1024 * 1024 * 1024, // 2GB
    flashcards: 500,
    dailyRequests: 200,
    ocrPages: 100,
    voiceSeconds: 3600,
  },
  team: {
    aiRequests: 10000,
    quizzes: 1000,
    uploads: 1000,
    storage: 10 * 1024 * 1024 * 1024, // 10GB
    flashcards: 5000,
    dailyRequests: 1000,
    ocrPages: 1000,
    voiceSeconds: 36000,
  },
  enterprise: {
    aiRequests: 10000,
    quizzes: 1000,
    uploads: 1000,
    storage: 10 * 1024 * 1024 * 1024, // 10GB
    flashcards: 5000,
    dailyRequests: 1000,
    ocrPages: 1000,
    voiceSeconds: 36000,
  },
};

export function getPlanLimits(plan: string) {
  const norm = (plan || "free").toLowerCase().trim();
  return PLAN_LIMITS[norm as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
}

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
      gracePeriodUntil: null,
      subscriptionStatus: "active",
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
    gracePeriodUntil: data.grace_period_until || null,
    subscriptionStatus: data.subscription_status || data.status || "active",
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

  // 7. Fetch OCR and voice usage from daily cache subscription_usage for the month
  const { data: usageCache } = await supabase
    .from("subscription_usage")
    .select("ocr_pages, voice_usage_seconds, ai_requests, quizzes, flashcards, uploads")
    .eq("user_id", userId)
    .gte("usage_date", startOfMonth.toISOString().slice(0, 10));

  let cachedOcr = 0;
  let cachedVoice = 0;
  
  if (usageCache && usageCache.length > 0) {
    cachedOcr = usageCache.reduce((sum, item) => sum + (item.ocr_pages || 0), 0);
    cachedVoice = usageCache.reduce((sum, item) => sum + (item.voice_usage_seconds || 0), 0);
  }

  // Configure plan limits dynamically
  const limits = getPlanLimits(plan);

  return {
    plan,
    usage: {
      storageBytes: totalStorageBytes,
      uploadsCount: totalUploadsCount,
      aiRequests: aiCount || 0,
      quizzes: quizCount || 0,
      flashcards: flashcardCount || 0,
      dailyAiRequests: dailyAiCount || 0,
      ocrPages: cachedOcr,
      voiceSeconds: cachedVoice,
    },
    limits,
    remaining: {
      storageBytes: Math.max(0, limits.storage - totalStorageBytes),
      uploadsCount: Math.max(0, limits.uploads - totalUploadsCount),
      aiRequests: Math.max(0, limits.aiRequests - (aiCount || 0)),
      quizzes: Math.max(0, limits.quizzes - (quizCount || 0)),
      flashcards: Math.max(0, limits.flashcards - (flashcardCount || 0)),
      dailyRequests: Math.max(0, limits.dailyRequests - (dailyAiCount || 0)),
      ocrPages: Math.max(0, limits.ocrPages - cachedOcr),
      voiceSeconds: Math.max(0, limits.voiceSeconds - cachedVoice),
    }
  };
}

export async function getRemainingQuota(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return usage.remaining;
}

export async function canUseAI(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return usage.remaining.aiRequests > 0 && usage.remaining.dailyRequests > 0;
}

export async function canGenerateQuiz(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return usage.remaining.quizzes > 0;
}

export async function canGeneratePuzzle(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return planHasFeature(usage.plan, "puzzle_generation");
}

export async function canGenerateFlashcards(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return usage.remaining.flashcards > 0;
}

export async function canUploadDocuments(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return usage.remaining.uploadsCount > 0;
}

export async function canUseOCR(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return usage.remaining.ocrPages > 0;
}

export async function canUseVoice(userId: string) {
  const usage = await getUserQuotaUsage(userId);
  return usage.remaining.voiceSeconds > 0;
}
