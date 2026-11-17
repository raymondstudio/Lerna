import { getAIConfig, isProviderKeyConfigured } from "./config";
import type {
  AIProvider,
  AIProviderId,
  GenerateResult,
  ProviderExecutionResult,
  ProviderOptions,
} from "./types";
import { groqProvider } from "./providers/groq";
import { xaiProvider } from "./providers/xai";
import { geminiProvider } from "./providers/gemini";
import { getMockAnswer } from "./mock";
import { reserveProviderOperation, OperationError } from "@/lib/repositories/operations";
import { activityEnvironment } from "@/lib/activity/environment";

const providers: Record<AIProviderId, AIProvider> = {
  groq: groqProvider,
  xai: xaiProvider,
  gemini: geminiProvider,
};

let mockModeNotified = false;

function notifyMockMode() {
  if (!mockModeNotified) {
    console.info(
      "[AI Client] Local simulated mode enabled. Set server-only AI provider keys (GROQ_API_KEY, XAI_API_KEY, or GEMINI_API_KEY) for live AI responses."
    );
    mockModeNotified = true;
  }
}

function isTestMockMode(): boolean {
  if (process.env.LERNA_TEST_MODE === "local" && process.env.NODE_ENV !== "production") {
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "ELASTICSEARCH_URL"]) {
      const value = process.env[key];
      if (value && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)) {
        throw new OperationError("Test providers require local backend targets.");
      }
    }
    return true;
  }
  return false;
}

export function providerArtifactScope(): string {
  const mode = isTestMockMode() ? "mock" : "live";
  return `${activityEnvironment()}:${mode}`;
}

function boundedSignal(signal?: AbortSignal): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
}

function getProviderModel(providerId: AIProviderId): string {
  const config = getAIConfig();
  switch (providerId) {
    case "groq":
      return config.groq.model;
    case "xai":
      return config.xai.model;
    case "gemini":
      return config.gemini.model;
  }
}

function getFallbackChain(primary: AIProviderId, fallbackEnabled: boolean): AIProviderId[] {
  if (!fallbackEnabled) {
    return [primary];
  }
  const allProviders: AIProviderId[] = ["groq", "xai", "gemini"];
  const chain: AIProviderId[] = [primary];
  for (const p of allProviders) {
    if (p !== primary && isProviderKeyConfigured(p)) {
      chain.push(p);
    }
  }
  return chain;
}

export async function generateText(
  prompt: string,
  options?: ProviderOptions
): Promise<GenerateResult> {
  if (Buffer.byteLength(prompt, "utf8") > 500000) {
    throw new OperationError("The tutoring input is too large.", 413);
  }

  if (options?.signal?.aborted) {
    throw new OperationError("The tutoring request was cancelled.", 400);
  }

  const isMock = isTestMockMode();
  const config = getAIConfig();
  const primaryProviderId = config.activeProvider;
  const primaryModel = getProviderModel(primaryProviderId);

  // If in mock mode, run simulated generation
  if (isMock) {
    notifyMockMode();
    const reservation = await reserveProviderOperation(
      primaryModel,
      options?.requestType ?? "chat",
      "mock",
      options?.userId,
      options?.operationId
    );
    const mockAnswer = getMockAnswer(prompt, primaryProviderId);
    let outcome: "succeeded" | "simulated" | "pending" = "simulated";
    try {
      await reservation.finalize("simulated", {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(mockAnswer.length / 4),
        durationMs: 5,
        tokenSource: "estimated",
      });
    } catch {
      outcome = "pending";
    }

    return {
      text: mockAnswer,
      raw: { mock: true },
      provider: primaryProviderId,
      model: primaryModel,
      operation: { id: reservation.id, outcome },
    };
  }

  // Live mode: check provider configuration
  const fallbackChain = getFallbackChain(primaryProviderId, config.fallbackEnabled);
  const configuredProviders = fallbackChain.filter((p) => isProviderKeyConfigured(p));

  if (configuredProviders.length === 0) {
    throw new OperationError(
      "The tutoring provider is not configured. Please try again later.",
      503
    );
  }

  const reservation = await reserveProviderOperation(
    primaryModel,
    options?.requestType ?? "chat",
    "live",
    options?.userId,
    options?.operationId
  );

  if (options?.signal?.aborted) {
    await reservation.release();
    throw new OperationError("The tutoring request was cancelled.", 400);
  }

  const started = Date.now();
  let executionResult: ProviderExecutionResult | null = null;
  let executedProviderId: AIProviderId = configuredProviders[0];
  let executedModel: string = getProviderModel(executedProviderId);
  let lastError: unknown = null;

  for (const providerId of configuredProviders) {
    const provider = providers[providerId];
    const model = getProviderModel(providerId);
    try {
      executionResult = await provider.generateText(prompt, model, {
        ...options,
        signal: boundedSignal(options?.signal),
      });
      executedProviderId = providerId;
      executedModel = model;
      break;
    } catch (err) {
      lastError = err;
      console.warn(
        `[AI Client] Provider ${providerId} (${model}) failed: ${
          err instanceof Error ? err.message : String(err)
        }. Evaluating fallbacks...`
      );
    }
  }

  if (!executionResult) {
    // Durable audit requirement: The provider may have accepted the call even if its
    // acknowledgement was lost. Unknown work remains charged until an operator reconciles it;
    // it is never silently retried.
    await reservation.finalize("unknown", { durationMs: Date.now() - started });
    if (lastError instanceof OperationError) {
      throw lastError;
    }
    throw new OperationError("The tutoring request could not be confirmed. Please retry later.");
  }

  let outcome: "succeeded" | "simulated" | "pending" = "succeeded";
  try {
    await reservation.finalize(outcome, {
      promptTokens: executionResult.promptTokens,
      completionTokens: executionResult.completionTokens,
      durationMs: Date.now() - started,
      tokenSource: executionResult.tokenSource ?? "unavailable",
    });
  } catch {
    outcome = "pending";
    console.warn("[AI Client] settlement_pending", { operationId: reservation.id });
  }

  return {
    text: executionResult.text,
    raw: executionResult.raw,
    provider: executedProviderId,
    model: executedModel,
    usage: {
      promptTokens: executionResult.promptTokens,
      completionTokens: executionResult.completionTokens,
      tokenSource: executionResult.tokenSource ?? "unavailable",
    },
    operation: { id: reservation.id, outcome },
  };
}
