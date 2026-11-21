import type { AIProvider, ProviderExecutionResult, ProviderOptions } from "../types";
import { getAIConfig, DEFAULT_GROQ_MODEL } from "../config";
import { OperationError } from "@/lib/repositories/operations";

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GroqProvider implements AIProvider {
  readonly id = "groq" as const;
  readonly defaultModel = DEFAULT_GROQ_MODEL;

  isConfigured(): boolean {
    const config = getAIConfig();
    return typeof config.groq.apiKey === "string" && config.groq.apiKey.trim().length > 0;
  }

  async generateText(
    prompt: string,
    model: string,
    options?: ProviderOptions
  ): Promise<ProviderExecutionResult> {
    const config = getAIConfig();
    const apiKey = config.groq.apiKey;
    if (!apiKey) {
      throw new OperationError("Groq API key is not configured.", 503);
    }

    const effectiveModel = model?.trim() || config.groq.model || DEFAULT_GROQ_MODEL;
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const requestBody = {
      model: effectiveModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (options?.signal?.aborted) {
        throw new OperationError("The tutoring request was cancelled.", 400);
      }

      if (attempt > 0) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }

      try {
        const response = await fetch(config.groq.endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "Lerna-AI-Platform/1.0",
          },
          body: JSON.stringify(requestBody),
          signal: options?.signal,
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 5;
          console.warn("[GroqProvider] Rate limit reached (429)", { retrySeconds, model: effectiveModel });
          if (attempt < MAX_RETRIES) {
            await sleep(Math.min(retrySeconds * 1000, 4000));
            continue;
          }
          throw new OperationError("AI service capacity reached. Please try again shortly.", 429);
        }

        if (response.status === 401 || response.status === 403) {
          console.error("[GroqProvider] Authentication failure with Groq API", { status: response.status });
          throw new OperationError("The tutoring provider could not authenticate.", 503);
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          console.error("[GroqProvider] Upstream error from Groq", {
            status: response.status,
            body: errorBody.slice(0, 300),
            attempt,
          });

          // Only retry 5xx transient server errors
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            lastError = new Error(`Groq server error (${response.status})`);
            continue;
          }

          throw new OperationError(`Tutoring service returned an error (${response.status}).`, 502);
        }

        const data = await response.json();
        const choice = data?.choices?.[0];
        const text = choice?.message?.content;

        if (typeof text !== "string" || !text.trim()) {
          throw new OperationError("Empty response returned by AI provider.", 502);
        }

        const usage = data?.usage;
        const promptTokens = typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
        const completionTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : undefined;

        return {
          text: text.trim(),
          raw: data,
          promptTokens,
          completionTokens,
          tokenSource: promptTokens !== undefined && completionTokens !== undefined ? "provider" : "unavailable",
        };
      } catch (err) {
        if (err instanceof OperationError) {
          throw err;
        }
        if (options?.signal?.aborted) {
          throw new OperationError("The tutoring request was cancelled.", 400);
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt === MAX_RETRIES) {
          break;
        }
      }
    }

    console.error("[GroqProvider] All retries exhausted", { error: lastError?.message });
    throw new OperationError(
      lastError?.message?.includes("fetch")
        ? "Unable to connect to AI provider. Please check your network."
        : "The tutoring request could not be completed. Please retry.",
      502
    );
  }
}

export const groqProvider = new GroqProvider();
