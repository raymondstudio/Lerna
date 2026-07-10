import { getUsage, recordUsageLedgerEvent } from "@/lib/repositories/billing";
import { getUserQuotaUsage } from "./business";

export type QuotaResourceType =
  | "aiRequests"
  | "quizzes"
  | "flashcards"
  | "uploads"
  | "ocrPages"
  | "voiceSeconds"
  | "dailyRequests";

/**
 * Checks if a user has remaining quota to perform an action.
 */
export async function checkQuota(
  userId: string,
  resourceType: QuotaResourceType,
  amount = 1
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
  try {
    const quotaData = await getUserQuotaUsage(userId);
    const limits = quotaData.limits;
    const usage = quotaData.usage;

    // Map resource type to business limit properties
    let limit = 0;
    let used = 0;

    switch (resourceType) {
      case "aiRequests":
        limit = limits.aiRequests || 0;
        used = usage.aiRequests || 0;
        break;
      case "dailyRequests":
        limit = limits.dailyRequests || 0;
        used = usage.dailyAiRequests || 0;
        break;
      case "quizzes":
        limit = limits.quizzes || 0;
        used = usage.quizzes || 0;
        break;
      case "flashcards":
        limit = limits.flashcards || 0;
        used = usage.flashcards || 0;
        break;
      case "uploads":
        limit = limits.uploads || 0;
        used = usage.uploadsCount || 0;
        break;
      case "ocrPages":
        limit = limits.ocrPages || 0;
        used = usage.ocrPages || 0;
        break;
      case "voiceSeconds":
        limit = limits.voiceSeconds || 0;
        used = usage.voiceSeconds || 0;
        break;
    }

    const remaining = Math.max(0, limit - used);
    return {
      allowed: remaining >= amount,
      remaining,
      limit,
      used,
    };
  } catch (err) {
    console.error("[quota-service] checkQuota error:", err);
    // Safe fallback: allow action but return empty metrics
    return { allowed: true, remaining: 999, limit: 999, used: 0 };
  }
}

/**
 * Increment the daily cached usage.
 */
export async function incrementUsage(
  userId: string,
  resourceType: QuotaResourceType,
  amount = 1
): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { updateUsage } = await import("@/lib/repositories/billing");
    await updateUsage(userId, today, { [resourceType]: amount });
    return true;
  } catch (err) {
    console.error("[quota-service] incrementUsage error:", err);
    return false;
  }
}

/**
 * Records an immutable usage ledger event and increments the daily cache.
 */
export async function recordUsage(
  userId: string,
  resourceType: string,
  amount = 1,
  metadata?: any
): Promise<boolean> {
  try {
    await recordUsageLedgerEvent(userId, resourceType, amount, metadata);
    return true;
  } catch (err) {
    console.error("[quota-service] recordUsage error:", err);
    return false;
  }
}
