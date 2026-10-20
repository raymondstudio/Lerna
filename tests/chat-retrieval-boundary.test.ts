import { describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  allowed: vi.fn(), retrieve: vi.fn(), generate: vi.fn(),
}));
vi.mock("@/lib/repositories/materials", () => ({ selectReadyOwnedMaterialIds: boundary.allowed }));
vi.mock("@/lib/materials/retrieval", () => ({ retrieveMaterialContext: boundary.retrieve, formatRagContext: vi.fn() }));
vi.mock("@/lib/gemini/client", () => ({ generateText: boundary.generate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn().mockRejectedValue(new Error("profile unavailable")) }));

import { getAIResponse } from "@/lib/chat/service";

describe("protected chat material authorization", () => {
  const message = [{ id: "fixture", role: "user" as const, content: "Explain this material", timestamp: 1 }];
  it("stops all provider calls when material authorization is unavailable", async () => {
    boundary.allowed.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(getAIResponse(message, "session-a", "user-a", ["material-a"])).rejects.toThrow();
    expect(boundary.generate).not.toHaveBeenCalled();
    expect(boundary.retrieve).not.toHaveBeenCalled();
  });

  it("does not produce an ungrounded paid answer when retrieval fails", async () => {
    boundary.allowed.mockResolvedValueOnce(["material-a"]);
    boundary.retrieve.mockRejectedValueOnce(new Error("search unavailable"));
    await expect(getAIResponse(message, "session-a", "user-a", ["material-a"])).rejects.toThrow("Authorized material retrieval is unavailable");
    expect(boundary.generate).not.toHaveBeenCalled();
  });
});
