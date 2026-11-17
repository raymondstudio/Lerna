import { env } from "@/lib/env";
import type { AIProviderId } from "./types";

export interface AIProviderConfig {
  activeProvider: AIProviderId;
  fallbackEnabled: boolean;
  groq: {
    apiKey: string;
    model: string;
    endpoint: string;
  };
  xai: {
    apiKey: string;
    model: string;
    endpoint: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
}

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_XAI_MODEL = "grok-2-1212";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function getAIConfig(): AIProviderConfig {
  const rawProvider = (env.AI_PROVIDER || process.env.AI_PROVIDER || "").toLowerCase().trim();
  const groqKey = (env.GROQ_API_KEY || process.env.GROQ_API_KEY || "").trim();
  const xaiKey = (env.XAI_API_KEY || process.env.XAI_API_KEY || "").trim();
  const geminiKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();

  let activeProvider: AIProviderId = "groq";

  if (rawProvider === "xai" || rawProvider === "gemini" || rawProvider === "groq") {
    activeProvider = rawProvider;
  } else if (groqKey) {
    activeProvider = "groq";
  } else if (xaiKey) {
    activeProvider = "xai";
  } else if (geminiKey) {
    activeProvider = "gemini";
  } else {
    activeProvider = "groq";
  }

  const fallbackVal = env.AI_ENABLE_FALLBACK || process.env.AI_ENABLE_FALLBACK;
  const fallbackEnabled = fallbackVal === "true" || fallbackVal === "1";

  return {
    activeProvider,
    fallbackEnabled,
    groq: {
      apiKey: groqKey,
      model: (env.GROQ_MODEL || process.env.GROQ_MODEL)?.trim() || DEFAULT_GROQ_MODEL,
      endpoint: (env.GROQ_API_URL || process.env.GROQ_API_URL)?.trim() || "https://api.groq.com/openai/v1/chat/completions",
    },
    xai: {
      apiKey: xaiKey,
      model: (env.XAI_MODEL || process.env.XAI_MODEL)?.trim() || DEFAULT_XAI_MODEL,
      endpoint: (env.XAI_API_URL || process.env.XAI_API_URL)?.trim() || "https://api.x.ai/v1/chat/completions",
    },
    gemini: {
      apiKey: geminiKey,
      model: DEFAULT_GEMINI_MODEL,
    },
  };
}

export function isProviderKeyConfigured(provider: AIProviderId): boolean {
  const config = getAIConfig();
  switch (provider) {
    case "groq":
      return typeof config.groq.apiKey === "string" && config.groq.apiKey.trim().length > 0;
    case "xai":
      return typeof config.xai.apiKey === "string" && config.xai.apiKey.trim().length > 0;
    case "gemini":
      return typeof config.gemini.apiKey === "string" && config.gemini.apiKey.trim().length > 0;
    default:
      return false;
  }
}
