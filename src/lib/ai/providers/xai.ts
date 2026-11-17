import type { AIProvider, ProviderExecutionResult, ProviderOptions } from "../types";
import { getAIConfig, DEFAULT_XAI_MODEL } from "../config";
import { OperationError } from "@/lib/repositories/operations";

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class XAIProvider implements AIProvider {
  readonly id = "xai" as const;
  readonly defaultModel = DEFAULT_XAI_MODEL;

  isConfigured(): boolean {
    const config = getAIConfig();
    return typeof config.xai.apiKey === "string" && config.xai.apiKey.trim().length > 0;
  }

  async generateText(
    prompt: string,
    model: string,
    options?: ProviderOptions
  ): Promise<ProviderExecutionResult> {
    const config = getAIConfig();
    const apiKey = config.xai.apiKey;
    if (!apiKey) {
      throw new OperationError("xAI Grok API key is not configured.", 503);
    }

    const effectiveModel = model?.trim() || config.xai.model || DEFAULT_XAI_MODEL;
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
        const response = await fetch(config.xai.endpoint, {
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
          console.warn("[XAIProvider] Rate limit reached (429)", { retrySeconds, model: effectiveModel });
          if (attempt < MAX_RETRIES) {
            await sleep(Math.min(retrySeconds * 1000, 4000));
            continue;
          }
          throw new OperationError("xAI service capacity reached. Please try again shortly.", 429);
        }

        if (response.status === 401 || response.status === 403) {
          console.error("[XAIProvider] Authentication failure with xAI API", { status: response.status });
          throw new OperationError("The xAI provider could not authenticate.", 503);
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          console.error("[XAIProvider] Upstream error from xAI", {
            status: response.status,
            body: errorBody.slice(0, 300),
            attempt,
          });

          if (response.status >= 500 && attempt < MAX_RETRIES) {
            lastError = new Error(`xAI server error (${response.status})`);
            continue;
          }

          throw new OperationError(`xAI service returned an error (${response.status}).`, 502);
        }

        const data = await response.json();
        const choice = data?.choices?.[0];
        const text = choice?.message?.content;

        if (typeof text !== "string" || !text.trim()) {
          throw new OperationError("Empty response returned by xAI provider.", 502);
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

    console.error("[XAIProvider] All retries exhausted", { error: lastError?.message });
    throw new OperationError(
      lastError?.message?.includes("fetch")
        ? "Unable to connect to xAI provider. Please check your network."
        : "The tutoring request could not be completed. Please retry.",
      502
    );
  }
}

export const xaiProvider = new XAIProvider();
