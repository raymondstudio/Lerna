import { getBudgetSnapshot, getOwnedSubscription } from "@/lib/repositories/budget";
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
  const data = await getOwnedSubscription(userId);

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
  return getBudgetSnapshot(userId);
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
