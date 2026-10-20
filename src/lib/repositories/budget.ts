import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import type { PLAN_LIMITS } from "@/lib/services/business";
type Limits = typeof PLAN_LIMITS.free;
type Usage = { storageBytes: number; uploadsCount: number; aiRequests: number; quizzes: number; flashcards: number; dailyAiRequests: number; ocrPages: number; voiceSeconds: number };
type Remaining = Omit<Usage,"dailyAiRequests"> & { dailyRequests: number };
export async function getBudgetSnapshot(userId: string): Promise<{ plan: string; usage: Usage; limits: Limits; remaining: Remaining; budgetSource: string; asOf: string }> {
  const { supabase, user } = await requireActiveUserApi();
  if (user.id !== userId) throw new Error("Budget owner mismatch.");
  const { data, error } = await supabase.rpc("get_operation_budget_snapshot");
  if (error || !data?.usage || !data?.limits || !data?.remaining) throw new Error("Your usage allowance could not be verified. Retry shortly.");
  for (const object of [data.usage, data.limits, data.remaining]) if (Object.values(object).some(value => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) throw new Error("Your usage allowance could not be verified. Retry shortly.");
  return data;
}
export async function getOwnedSubscription(userId: string) {
  const { supabase, user } = await requireActiveUserApi();
  if (user.id !== userId) throw new Error("Subscription owner mismatch.");
  const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  if (error || !data) throw new Error("Your subscription could not be verified. Retry shortly.");
  return data;
}
