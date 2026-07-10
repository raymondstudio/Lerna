import { createWebhookEvent, processWebhookEvent } from "@/lib/repositories/billing";

/**
 * Persists webhook events from payment gateway provider and flags processing status.
 */
export async function handleWebhookPayload(
  provider: string,
  eventId: string,
  eventType: string,
  payload: any
) {
  // Store the raw webhook event for logging & idempotency
  await createWebhookEvent(provider, eventId, eventType, payload);
  
  // Mark event as processed (actual subscription fulfillment can be added in Phase 3)
  await processWebhookEvent(provider, eventId);
  
  return { success: true };
}
