export type AIProviderId = "groq" | "xai" | "gemini";

export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokenSource?: "provider" | "estimated" | "unavailable";
}

export interface GenerateResult {
  text: string;
  raw: unknown;
  provider?: AIProviderId;
  model?: string;
  usage?: ProviderUsage;
  operation?: { id: string; outcome: "succeeded" | "simulated" | "pending" };
}

export interface ProviderOptions {
  userId?: string;
  signal?: AbortSignal;
  requestType?: string;
  operationId?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ProviderExecutionResult {
  text: string;
  raw: unknown;
  promptTokens?: number;
  completionTokens?: number;
  tokenSource?: "provider" | "estimated" | "unavailable";
}

export interface AIProvider {
  id: AIProviderId;
  defaultModel: string;
  isConfigured: () => boolean;
  generateText: (
    prompt: string,
    model: string,
    options?: ProviderOptions
  ) => Promise<ProviderExecutionResult>;
}
