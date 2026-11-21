import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ env: { ELASTICSEARCH_URL: "https://search.fixture.invalid", ELASTICSEARCH_API_KEY: "synthetic-key", ELASTIC_SEARCH_API_KEY: "" } }));
vi.mock("@/lib/env", () => ({ env: fixture.env }));
import { createIndexIfMissing, deleteByQuery, searchIndex } from "@/lib/elastic/client";
beforeEach(() => { vi.stubEnv("LERNA_ELASTIC_MODE", ""); fixture.env.ELASTICSEARCH_URL = "https://search.fixture.invalid"; fixture.env.ELASTICSEARCH_API_KEY = "synthetic-key"; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("live Elastic never silently succeeds through mocks", () => {
  it("missing configuration fails before a network request", async () => {
    fixture.env.ELASTICSEARCH_API_KEY = "";
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(searchIndex("fixture", {})).rejects.toThrow(/configured/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("a live request failure remains a failure on every subsequent call", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Synthetic connection failure"));
    await expect(deleteByQuery("fixture", {})).rejects.toThrow(/Synthetic/);
    await expect(deleteByQuery("fixture", {})).rejects.toThrow(/Synthetic/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("index provisioning does not turn a backend outage into an index-create attempt", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    await expect(createIndexIfMissing("fixture", {})).rejects.toMatchObject({ status: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("allows only an explicit fixture mode outside production", async () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("LERNA_ELASTIC_MODE", "mock");
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(await searchIndex("fixture", { query: {} })).toHaveProperty("hits");
    expect(fetch).not.toHaveBeenCalled();
  });
});
