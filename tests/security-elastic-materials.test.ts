import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), remove: vi.fn(), create: vi.fn(), index: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/elastic/client", () => ({ searchIndex: mocks.search, deleteByQuery: mocks.remove, createIndexIfMissing: mocks.create, indexDocument: mocks.index, refreshIndex: mocks.refresh }));
vi.mock("@/lib/gemini/client", () => ({ EMBEDDING_DIMENSIONS: 768 }));
import { deleteMaterialFromElastic, searchMaterialEmbeddings } from "@/lib/materials/elastic";
beforeEach(() => vi.resetAllMocks());
describe("search and cleanup boundary (mocked Elastic)", () => {
  it("empty authorized IDs stay empty before any index operation", async () => {
    expect(await searchMaterialEmbeddings({ userId: "fixture-a", queryEmbedding: [1], documentIds: [] })).toEqual([]);
    expect(mocks.search).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rechecks hit owner and explicit document scope", async () => {
    mocks.search.mockResolvedValue({ hits: { hits: [
      { _source: { user_id: "fixture-a", document_id: "owned", chunk_id: "ok", chunk_text: "fixture" } },
      { _source: { user_id: "fixture-b", document_id: "owned", chunk_id: "foreign-user", chunk_text: "fixture" } },
      { _source: { user_id: "fixture-a", document_id: "other", chunk_id: "foreign-scope", chunk_text: "fixture" } },
    ] } });
    expect((await searchMaterialEmbeddings({ userId: "fixture-a", queryEmbedding: [1], documentIds: ["owned"] })).map((item) => item.id)).toEqual(["ok"]);
  });
  it("cleanup failures propagate instead of claiming successful deletion", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("Synthetic search outage")).mockResolvedValue(null);
    await expect(deleteMaterialFromElastic("material", "fixture-a")).rejects.toThrow(/Synthetic/);
    expect(mocks.remove).toHaveBeenCalledTimes(3);
  });
});
