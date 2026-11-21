import { GoogleGenAI } from "@google/genai";
import type { AIProvider, ProviderExecutionResult, ProviderOptions } from "../types";
import { getAIConfig, DEFAULT_GEMINI_MODEL } from "../config";
import { OperationError } from "@/lib/repositories/operations";

let aiClient: GoogleGenAI | null = null;

function getClient(apiKey: string): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
    });
  }
  return aiClient;
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly defaultModel = DEFAULT_GEMINI_MODEL;

  isConfigured(): boolean {
    const config = getAIConfig();
    return typeof config.gemini.apiKey === "string" && config.gemini.apiKey.trim().length > 0;
  }

  async generateText(
    prompt: string,
    model: string,
    options?: ProviderOptions
  ): Promise<ProviderExecutionResult> {
    const config = getAIConfig();
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      throw new OperationError("Gemini API key is not configured.", 503);
    }

    const effectiveModel = model?.trim() || config.gemini.model || DEFAULT_GEMINI_MODEL;
    const client = getClient(apiKey);

    const response = await client.models.generateContent({
      model: effectiveModel,
      contents: prompt,
      config: {
        maxOutputTokens: options?.maxTokens ?? 4096,
        abortSignal: options?.signal,
      },
    });

    if (!response.text?.trim()) {
      throw new OperationError("Empty response returned by AI provider.", 502);
    }

    const usage = response.usageMetadata;
    const promptTokens = usage?.promptTokenCount;
    const completionTokens =
      usage?.candidatesTokenCount === undefined
        ? undefined
        : usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0);
    const tokenSource =
      promptTokens === undefined || usage?.candidatesTokenCount === undefined
        ? "unavailable"
        : "provider";

    return {
      text: response.text,
      raw: response,
      promptTokens,
      completionTokens,
      tokenSource,
    };
  }
}

export const geminiProvider = new GeminiProvider();
