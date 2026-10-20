import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ ids: vi.fn(), embedding: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/repositories/materials", () => ({ selectReadyOwnedMaterialIds: mocks.ids }));
vi.mock("@/lib/gemini/client", () => ({ generateEmbedding: mocks.embedding }));
vi.mock("@/lib/materials/elastic", () => ({ searchMaterialEmbeddings: mocks.search }));
import { retrieveMaterialContext } from "@/lib/materials/retrieval";
const id = "11111111-1111-4111-8111-111111111111";
const chunk = { id: "chunk", documentId: id, documentName: "Synthetic fixture", userId: "fixture-a", sessionId: "session", text: "Synthetic learning text", score: 0.9, index: 0, tokenEstimate: 10 };
beforeEach(() => { vi.resetAllMocks(); mocks.embedding.mockResolvedValue([0, 1]); });
describe("SQL-authorized material retrieval (mocked dependencies)", () => {
  it("an explicit empty scope cannot trigger embeddings or broaden search", async () => {
    mocks.ids.mockResolvedValue([]);
    expect(await retrieveMaterialContext({ userId: "fixture-a", sessionId: "session", query: "fixture", documentIds: [] })).toEqual({ chunks: [], sources: [] });
    expect(mocks.ids).toHaveBeenCalledWith("fixture-a", []);
    expect(mocks.embedding).not.toHaveBeenCalled();
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("permits an owned ready material and passes its explicit scope", async () => {
    mocks.ids.mockResolvedValue([id]); mocks.search.mockResolvedValue([chunk]);
    expect((await retrieveMaterialContext({ userId: "fixture-a", sessionId: "session", query: "fixture", documentIds: [id] })).chunks).toEqual([chunk]);
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ documentIds: [id], userId: "fixture-a" }));
    expect(mocks.ids).toHaveBeenCalledTimes(2);
  });
  it("a concurrent SQL tombstone removes stale index hits before prompt context", async () => {
    mocks.ids.mockResolvedValueOnce([id]).mockResolvedValueOnce([]); mocks.search.mockResolvedValue([chunk]);
    expect((await retrieveMaterialContext({ userId: "fixture-a", sessionId: "session", query: "fixture", documentIds: [id] })).chunks).toEqual([]);
  });
  it("SQL authorization failure cannot fall back to search", async () => {
    mocks.ids.mockRejectedValue(new Error("Synthetic authorization outage"));
    await expect(retrieveMaterialContext({ userId: "fixture-a", sessionId: "session", query: "fixture" })).rejects.toThrow();
    expect(mocks.embedding).not.toHaveBeenCalled();
    expect(mocks.search).not.toHaveBeenCalled();
  });
});
