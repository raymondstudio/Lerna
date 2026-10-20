import { AsyncLocalStorage } from "node:async_hooks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";

export class OperationError extends Error {
  constructor(message: string, public readonly status = 503) { super(message); }
}
type Resource = "uploads" | "aiRequests" | "quizzes" | "flashcards" | "ocrPages" | "voiceSeconds";
type Outcome = "succeeded" | "failed" | "unknown" | "simulated";
type Metrics = { promptTokens?: number; completionTokens?: number; durationMs?: number; tokenSource?: "provider" | "estimated" | "unavailable" };
const demoContext = new AsyncLocalStorage<boolean>();
export function withDemoOperation<T>(run: () => Promise<T>) { return demoContext.run(true, run); }

export async function reserveOperation(input: {
  userId: string; resource: Resource; amount?: number; bytes?: number; operationId?: string;
  model?: string; requestType?: string; providerMode?: "live" | "mock";
}) {
  const { user } = await requireActiveUserApi();
  if (input.userId !== user.id) throw new OperationError("Operation owner does not match the authenticated account.", 403);
  return reserveValidatedOperation(input);
}
async function reserveValidatedOperation(input: Parameters<typeof reserveOperation>[0]) {
  const id = input.operationId ?? crypto.randomUUID();
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc("reserve_operation", {
    p_id: id, p_user_id: input.userId, p_resource: input.resource, p_amount: input.amount ?? 1,
    p_bytes: input.bytes ?? 0, p_model: input.model ?? null, p_request_type: input.requestType ?? null,
    p_provider_mode: input.providerMode ?? "live",
  });
  if (error) throw new OperationError(error.code === "PT429" ? "Your plan limit has been reached." : "Operation budget is unavailable. Please retry.", error.code === "PT429" ? 429 : 503);
  // A lost reservation acknowledgement must never trigger another provider call with the same identity.
  if (!data || data.replayed) throw new OperationError("This operation already exists. Refresh its saved result before retrying.", 409);
  return operationHandle(id);
}
function operationHandle(id: string) {
  const finish = async (state: Outcome | "released", metrics: Metrics = {}) => {
    const { error, data } = await createSupabaseAdminClient().rpc("finish_operation", { p_id: id, p_state: state, p_metrics: metrics });
    if (error || data !== true) throw new OperationError("The operation outcome could not be confirmed. Refresh before retrying.");
  };
  return { id, finalize: (state: Outcome, metrics?: Metrics) => finish(state, metrics), release: () => finish("released") };
}
export async function reserveProviderOperation(model: string, requestType: string, providerMode: "live" | "mock", requestedUserId?: string, operationId?: string) {
  if (demoContext.getStore()) {
    const id = crypto.randomUUID();
    const { data, error } = await createSupabaseAdminClient().rpc("reserve_demo_operation", { p_id: id, p_model: model, p_request_type: requestType, p_provider_mode: providerMode });
    if (error) throw new OperationError("The demonstration budget is unavailable. Please try again later.");
    if (data !== true) throw new OperationError("The demonstration limit has been reached. Please try again later.", 429);
    return operationHandle(id);
  }
  const { user } = await requireActiveUserApi();
  if (requestedUserId && requestedUserId !== user.id) throw new OperationError("Operation owner mismatch.", 403);
  // Generating questions is a paid AI call; the completed practice result
  // consumes the quiz allowance when save_practice_quiz commits it. Charging
  // both against quizzes would make the final allowed quiz impossible to save.
  const resource = requestType === "ocr" ? "ocrPages" : /flashcard/.test(requestType) ? "flashcards" : "aiRequests";
  return reserveValidatedOperation({ userId: user.id, resource, model, requestType, providerMode, operationId });
}
