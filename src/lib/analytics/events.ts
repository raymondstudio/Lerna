import { logAnalyticsEvent, logAiRequest } from "./tracker";

/**
 * Emits a system event. The events are saved to the `public.events` table,
 * which streams in real-time to the admin dashboard activity feed and prepares
 * integrations for future AI business agents.
 */
export async function emitAnalyticsEvent(
  userId: string | null | undefined,
  eventName: string,
  properties: Record<string, any> = {}
) {
  console.info(`[analytics:event] Emitting event "${eventName}" for user "${userId || "anonymous"}"`, properties);
  
  try {
    // 1. Log to the centralized events stream table
    await logAnalyticsEvent(userId, eventName, properties);

    // 2. Route specific events to their structured tables for fast aggregation
    if (eventName === "ai_request_completed") {
      await logAiRequest(
        userId,
        properties.promptTokens || 0,
        properties.completionTokens || 0,
        properties.modelUsed || "gemini",
        properties.requestType || "chat",
        "success"
      );
    } else if (eventName === "ai_request_failed") {
      await logAiRequest(
        userId,
        properties.promptTokens || 0,
        0,
        properties.modelUsed || "gemini",
        properties.requestType || "chat",
        "failed",
        properties.errorMessage || "Unknown error"
      );
    }
  } catch (err) {
    console.error(`[analytics:event] Failed to save event "${eventName}":`, err);
  }
}
