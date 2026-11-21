import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAIConfig, DEFAULT_GROQ_MODEL, DEFAULT_XAI_MODEL, DEFAULT_GEMINI_MODEL } from "@/lib/ai/config";
import { GroqProvider } from "@/lib/ai/providers/groq";
import { XAIProvider } from "@/lib/ai/providers/xai";
import { generateText } from "@/lib/ai/client";
import { generateEmbedding, EMBEDDING_DIMENSIONS } from "@/lib/gemini/client";

describe("AI Provider Architecture & Configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to expected primary and secondary models", () => {
    expect(DEFAULT_GROQ_MODEL).toBe("openai/gpt-oss-120b");
    expect(DEFAULT_XAI_MODEL).toBe("grok-2-1212");
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });

  it("selects provider based on environment variables", () => {
    vi.stubEnv("AI_PROVIDER", "xai");
    vi.stubEnv("XAI_API_KEY", "test-xai-key");
    const config = getAIConfig();
    expect(config.activeProvider).toBe("xai");
    expect(config.xai.apiKey).toBe("test-xai-key");
    expect(config.xai.model).toBe("grok-2-1212");
  });

  it("defaults to groq when GROQ_API_KEY is provided without explicit AI_PROVIDER", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    const config = getAIConfig();
    expect(config.activeProvider).toBe("groq");
    expect(config.groq.apiKey).toBe("test-groq-key");
    expect(config.groq.model).toBe("openai/gpt-oss-120b");
  });

  it("respects custom model overrides for Groq and xAI", () => {
    vi.stubEnv("GROQ_MODEL", "custom-groq-model");
    vi.stubEnv("XAI_MODEL", "custom-xai-model");
    const config = getAIConfig();
    expect(config.groq.model).toBe("custom-groq-model");
    expect(config.xai.model).toBe("custom-xai-model");
  });
});

describe("GroqProvider execution boundary", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws 503 when API key is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const provider = new GroqProvider();
    await expect(provider.generateText("Hello", "openai/gpt-oss-120b")).rejects.toThrow(
      "Groq API key is not configured"
    );
  });

  it("dispatches HTTP request with OpenAI-compatible payload and parses response", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test123");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Groq response from gpt-oss-120b" } }],
        usage: { prompt_tokens: 15, completion_tokens: 25 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GroqProvider();
    const result = await provider.generateText("Explain calculus", "openai/gpt-oss-120b", {
      systemPrompt: "You are an expert tutor.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer gsk_test123",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: "You are an expert tutor." },
            { role: "user", content: "Explain calculus" },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      })
    );

    expect(result.text).toBe("Groq response from gpt-oss-120b");
    expect(result.promptTokens).toBe(15);
    expect(result.completionTokens).toBe(25);
    expect(result.tokenSource).toBe("provider");
  });
});

describe("XAIProvider execution boundary", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws 503 when API key is missing", async () => {
    vi.stubEnv("XAI_API_KEY", "");
    const provider = new XAIProvider();
    await expect(provider.generateText("Hello", "grok-2-1212")).rejects.toThrow(
      "xAI Grok API key is not configured"
    );
  });

  it("dispatches HTTP request to xAI endpoint with grok payload", async () => {
    vi.stubEnv("XAI_API_KEY", "xai_test123");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "xAI Grok response" } }],
        usage: { prompt_tokens: 12, completion_tokens: 30 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new XAIProvider();
    const result = await provider.generateText("Explain entropy", "grok-2-1212");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer xai_test123",
        }),
      })
    );

    expect(result.text).toBe("xAI Grok response");
    expect(result.promptTokens).toBe(12);
    expect(result.completionTokens).toBe(30);
  });
});

describe("Client input size guards", () => {
  it("rejects prompt exceeding 500KB with 413", async () => {
    const hugePrompt = "a".repeat(500001);
    await expect(generateText(hugePrompt)).rejects.toThrow("too large");
  });

  it("rejects embedding text exceeding 100KB with 413", async () => {
    const hugeDoc = "a".repeat(100001);
    await expect(generateEmbedding(hugeDoc)).rejects.toThrow("too large");
  });
});
