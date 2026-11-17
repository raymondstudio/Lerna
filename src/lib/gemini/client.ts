import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { reserveProviderOperation, OperationError } from "@/lib/repositories/operations";
import { generateText, providerArtifactScope } from "../ai/client";
import type { GenerateResult } from "../ai/types";

export { generateText, providerArtifactScope };
export type { GenerateResult };

export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";

const GENERATIVE_MODEL = "gemini-2.5-flash";
const EMBEDDING_MODEL = "gemini-embedding-001";

export const EMBEDDING_DIMENSIONS = 768;

let aiClient: GoogleGenAI | null = null;

function getApiKey(): string {
  return env.GEMINI_API_KEY ?? "";
}

function isKeyValid(): boolean {
  const key = getApiKey();
  return typeof key === "string" && key.trim().length > 0;
}

function getClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: getApiKey(),
    });
  }

  return aiClient;
}

function getMockEmbedding(text: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const charCode = text.charCodeAt(i % text.length) || 0;
    vector[i] = Math.sin(charCode + i) * 0.1;
  }
  return vector;
}

type ProviderOptions = { userId?: string; signal?: AbortSignal; requestType?: string; operationId?: string };

function providerMode(): "mock" | "live" {
  if (process.env.LERNA_TEST_MODE === "local" && process.env.NODE_ENV !== "production") {
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "ELASTICSEARCH_URL"]) {
      const value = process.env[key];
      if (value && !["localhost","127.0.0.1","[::1]"].includes(new URL(value).hostname)) throw new OperationError("Test providers require local backend targets.");
    }
    return "mock";
  }
  if (!isKeyValid()) throw new OperationError("The tutoring provider is not configured. Please try again later.");
  return "live";
}

function boundedSignal(signal?: AbortSignal) {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
}

async function executeProvider<T>(
  model: string,
  requestType: string,
  options: ProviderOptions | undefined,
  run: (mode: "live"|"mock", signal: AbortSignal) => Promise<{
    value: T;
    promptTokens?: number;
    completionTokens?: number;
    tokenSource?: "provider"|"estimated"|"unavailable"
  }>
): Promise<T> {
  const mode = providerMode();
  if (options?.signal?.aborted) throw new OperationError("The tutoring request was cancelled.", 400);
  const reservation = await reserveProviderOperation(model, requestType, mode, options?.userId, options?.operationId);
  if (options?.signal?.aborted) {
    await reservation.release();
    throw new OperationError("The tutoring request was cancelled.", 400);
  }
  const started = Date.now();
  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run(mode, boundedSignal(options?.signal));
  } catch {
    await reservation.finalize("unknown", { durationMs: Date.now() - started });
    throw new OperationError("The tutoring request could not be confirmed. Please retry later.");
  }

  let outcome: "succeeded" | "simulated" | "pending" = mode === "mock" ? "simulated" : "succeeded";
  try {
    await reservation.finalize(outcome, {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      durationMs: Date.now() - started,
      tokenSource: result.tokenSource ?? "unavailable"
    });
  } catch {
    outcome = "pending";
    console.warn("[provider] settlement_pending", { operationId: reservation.id });
  }
  if (result.value && typeof result.value === "object" && !Array.isArray(result.value) && "text" in result.value) {
    Object.assign(result.value, { operation: { id: reservation.id, outcome } });
  }
  return result.value;
}

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
  options?: ProviderOptions
): Promise<number[]> {
  if (Buffer.byteLength(text, "utf8") > 100000) throw new OperationError("The embedding input is too large.", 413);
  return executeProvider(EMBEDDING_MODEL, "embedding", options, async (mode, signal) => {
    if (mode === "mock") return { value: getMockEmbedding(text) };
    const response = await getClient().models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS, abortSignal: signal }
    });
    const values = response.embeddings?.[0]?.values;
    if (!values || values.length !== EMBEDDING_DIMENSIONS || values.some(value => !Number.isFinite(value))) {
      throw new Error("Invalid embedding");
    }
    return { value: values, promptTokens: Math.ceil(text.length / 4), completionTokens: 0, tokenSource: "estimated" };
  });
}

export async function extractImageText(
  buffer: Buffer,
  mimeType: string,
  _fileName?: string,
  options?: ProviderOptions
): Promise<string> {
  if (buffer.length > 20 * 1024 * 1024) throw new OperationError("The image is too large.", 413);
  return executeProvider(GENERATIVE_MODEL, "ocr", options, async (mode, signal) => {
    if (mode === "mock") return { value: "Synthetic local fixture image text." };
    const response = await getClient().models.generateContent({
      model: GENERATIVE_MODEL,
      contents: [
        { inlineData: { mimeType, data: buffer.toString("base64") } },
        { text: "Extract and transcribe all readable text from this image exactly as it appears. Do not add any extra commentary or explanations, just the extracted text." }
      ],
      config: { maxOutputTokens: 4096, abortSignal: signal }
    });
    const usage = response.usageMetadata;
    return {
      value: response.text ?? "",
      promptTokens: usage?.promptTokenCount,
      completionTokens: usage?.candidatesTokenCount === undefined ? undefined : usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0),
      tokenSource: usage?.promptTokenCount === undefined || usage?.candidatesTokenCount === undefined ? "unavailable" : "provider"
    };
  });
}
