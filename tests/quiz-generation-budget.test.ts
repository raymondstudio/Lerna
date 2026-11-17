import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ active: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/require-active-user-api", () => ({ requireActiveUserApi: mocks.active }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
import { reserveProviderOperation } from "@/lib/repositories/operations";

describe("quiz generation budget", () => {
  beforeEach(() => {
    mocks.active.mockReset().mockResolvedValue({ user: { id: "11111111-1111-4111-8111-111111111111" } });
    mocks.rpc.mockReset().mockResolvedValue({ data: { state: "pending", replayed: false }, error: null });
  });

  it("charges generation to AI requests so the remaining quiz slot can save the result", async () => {
    await reserveProviderOperation("gemini-2.5-flash", "quiz", "mock", "11111111-1111-4111-8111-111111111111");
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_operation", expect.objectContaining({
      p_resource: "aiRequests", p_request_type: "quiz", p_model: "gemini-2.5-flash",
    }));
  });
});
