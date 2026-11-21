import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ material: vi.fn(), parent: vi.fn(), download: vi.fn(), claim: vi.fn(), finish: vi.fn(), queue: vi.fn(), extract: vi.fn(), embed: vi.fn(), index: vi.fn(), remove: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/repositories/processing-artifacts", () => ({ readProcessingArtifact: mocks.read, writeProcessingArtifact: mocks.write }));
vi.mock("@/lib/repositories/materials", () => ({ fetchOwnedMaterial: mocks.material, requireOwnedMaterialSession: mocks.parent, downloadOwnedUpload: mocks.download, claimMaterialProcessing: mocks.claim, finishMaterialProcessing: mocks.finish, queueMaterialIndexCleanup: mocks.queue }));
vi.mock("@/lib/materials/extract", () => ({ extractMaterialText: mocks.extract }));
vi.mock("@/lib/materials/elastic", () => ({ indexMaterialInElastic: mocks.index, deleteMaterialFromElastic: mocks.remove }));
vi.mock("@/lib/gemini/client", () => ({ generateEmbedding: mocks.embed, providerArtifactScope: () => "local:mock" }));
import { processMaterial } from "@/lib/materials/ingestion";
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const material = { id, user_id: userId, session_id: sessionId, file_name: "fixture.txt", file_type: "text/plain", storage_path: `${userId}/${sessionId}/fixture.txt`, status: "uploaded" };
const params = { supabase: {} as SupabaseClient, materialId: id, userId };
beforeEach(() => {
  vi.resetAllMocks(); mocks.material.mockResolvedValue(material); mocks.parent.mockResolvedValue({ id: sessionId });
  mocks.claim.mockResolvedValue("claimed"); mocks.download.mockResolvedValue(Buffer.from("Synthetic learning fixture"));
  mocks.read.mockResolvedValue(null); mocks.write.mockResolvedValue(undefined);
  mocks.extract.mockResolvedValue([{ text: "Synthetic learning fixture" }]); mocks.embed.mockResolvedValue(Array(768).fill(0.1));
  mocks.finish.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); mocks.queue.mockResolvedValue(undefined);
});
describe("claimed material ingestion (no provider calls)", () => {
  it("processes an owned fixture, propagates identity/deadline and finalizes its claim", async () => {
    expect((await processMaterial(params)).status).toBe("ready");
    expect(mocks.embed).toHaveBeenCalledWith("Synthetic learning fixture", "RETRIEVAL_DOCUMENT", expect.objectContaining({ userId, signal: expect.any(AbortSignal) }));
    expect(mocks.finish).toHaveBeenCalledWith(params.supabase, id, expect.any(String), "ready", expect.anything());
  });
  it("busy/ready claims never start downstream paid work", async () => {
    mocks.claim.mockResolvedValue("busy");
    await expect(processMaterial(params)).rejects.toMatchObject({ status: 409 });
    expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.embed).not.toHaveBeenCalled();
    mocks.claim.mockResolvedValue("ready");
    await processMaterial(params);
    expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("a foreign/missing parent is denied before claim/download", async () => {
    mocks.parent.mockRejectedValue(new Error("Synthetic foreign parent"));
    await expect(processMaterial(params)).rejects.toThrow();
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
  });
  it("oversized extracted content is rejected before embedding", async () => {
    mocks.extract.mockResolvedValue([{ text: "x".repeat(200_001) }]);
    await expect(processMaterial(params)).rejects.toMatchObject({ code: "ARTIFACT_INVALID" });
    expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("retrying an index failure reuses durable extraction and embeddings", async () => {
    const cache = new Map<string, unknown>();
    mocks.read.mockImplementation(async input => cache.get(input.key) ?? null);
    mocks.write.mockImplementation(async (input, value) => { cache.set(input.key, value); });
    mocks.index.mockRejectedValueOnce(new Error("Synthetic index outage"));
    await expect(processMaterial(params)).rejects.toThrow();
    await expect(processMaterial(params)).resolves.toMatchObject({ status: "ready" });
    expect(mocks.extract).toHaveBeenCalledTimes(1); expect(mocks.embed).toHaveBeenCalledTimes(1);
  });
  it("unavailable artifact storage stops processing before a provider call", async () => {
    mocks.read.mockRejectedValue(new Error("Synthetic cache outage"));
    await expect(processMaterial(params)).rejects.toThrow();
    expect(mocks.extract).not.toHaveBeenCalled(); expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("failed search cleanup is queued durably and never reported as ready", async () => {
    mocks.index.mockRejectedValue(new Error("Synthetic indexing failure")); mocks.remove.mockRejectedValue(new Error("Synthetic cleanup failure"));
    await expect(processMaterial(params)).rejects.toThrow();
    expect(mocks.queue).toHaveBeenCalledWith(params.supabase, id);
    expect(mocks.finish).toHaveBeenCalledWith(params.supabase, id, expect.any(String), "failed", expect.anything());
  });
});
