import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ reserve: vi.fn(), generate: vi.fn(), embed: vi.fn(), finalize: vi.fn(), release: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: fake.generate, embedContent: fake.embed }; } }));
vi.mock("@/lib/env", () => ({ env: { GEMINI_API_KEY: "synthetic-fixture-only" } }));
vi.mock("@/lib/repositories/operations", () => ({
  reserveProviderOperation: fake.reserve,
  OperationError: class extends Error { constructor(message: string, public status = 503) { super(message); } },
}));
import { generateText, generateEmbedding } from "@/lib/gemini/client";
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("LERNA_TEST_MODE", "");
  fake.reserve.mockResolvedValue({ id: "fixture-operation", finalize: fake.finalize, release: fake.release });
  fake.finalize.mockResolvedValue(undefined);
  fake.generate.mockResolvedValue({ text: "Synthetic paid answer", usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 5 } });
});
describe("reserved provider boundary with synthetic SDK (zero network calls)", () => {
  it("budget refusal stops both generation and embedding before any SDK call", async () => {
    fake.reserve.mockRejectedValue(new Error("Synthetic quota refusal"));
    await expect(generateText("Fixture prompt")).rejects.toThrow("quota refusal");
    await expect(generateEmbedding("Fixture text")).rejects.toThrow("quota refusal");
    expect(fake.generate).not.toHaveBeenCalled(); expect(fake.embed).not.toHaveBeenCalled();
  });
  it("preserves the protected model and exact prompt, including thinking tokens", async () => {
    const prompt = "Exact fixture prompt\nKeep its punctuation.";
    const result = await generateText(prompt);
    expect(fake.generate).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-2.5-flash", contents: prompt }));
    expect(fake.finalize).toHaveBeenCalledWith("succeeded", expect.objectContaining({ promptTokens: 10, completionTokens: 25, tokenSource: "provider" }));
    expect(result.operation?.outcome).toBe("succeeded");
  });
  it("telemetry outage retains an already-paid response as pending without a second call", async () => {
    fake.finalize.mockRejectedValue(new Error("Synthetic audit outage"));
    await expect(generateText("Fixture prompt")).resolves.toMatchObject({ text: "Synthetic paid answer", operation: { outcome: "pending" } });
    expect(fake.generate).toHaveBeenCalledTimes(1); expect(fake.release).not.toHaveBeenCalled();
  });
  it("uncertain provider failure remains charged and never becomes a sample answer", async () => {
    fake.generate.mockRejectedValue(new Error("Synthetic lost acknowledgement"));
    await expect(generateText("Fixture prompt")).rejects.toThrow("could not be confirmed");
    expect(fake.finalize).toHaveBeenCalledWith("unknown", expect.anything());
    expect(fake.generate).toHaveBeenCalledTimes(1); expect(fake.release).not.toHaveBeenCalled();
  });
  it("cancelled work stops before reserving or invoking the provider", async () => {
    await expect(generateText("Fixture prompt", { signal: AbortSignal.abort() })).rejects.toThrow("cancelled");
    expect(fake.reserve).not.toHaveBeenCalled(); expect(fake.generate).not.toHaveBeenCalled();
  });
  it("retry operation identity reaches the reservation boundary unchanged", async () => {
    fake.embed.mockResolvedValue({ embeddings: [{ values: Array(768).fill(0.1) }] });
    await generateEmbedding("Fixture document", "RETRIEVAL_DOCUMENT", { userId: "fixture-owner", operationId: "fixture-stable-id" });
    expect(fake.reserve).toHaveBeenCalledWith("gemini-embedding-001", "embedding", "live", "fixture-owner", "fixture-stable-id");
    expect(fake.embed).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-embedding-001", config: expect.objectContaining({ outputDimensionality: 768 }) }));
  });
});
