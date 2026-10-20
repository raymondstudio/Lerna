import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), audit: vi.fn(), adminClient: vi.fn() }));
vi.mock("@/lib/auth/require-admin-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/require-admin-api")>(),
  requireAdminApi: mocks.admin,
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.adminClient }));
vi.mock("@/lib/repositories/activity", () => ({ appendActivityEvent: mocks.audit }));

import { GET } from "@/app/api/admin/exports/route";
import { AuthApiError } from "@/lib/auth/require-active-user-api";

describe("non-activity administrative export", () => {
  beforeEach(() => { mocks.admin.mockReset(); mocks.audit.mockReset(); mocks.adminClient.mockReset(); });

  it("withholds paged data if the admin is demoted before release", async () => {
    const query = {
      select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [{ id: "private-user" }], error: null }),
    };
    mocks.adminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    mocks.admin.mockResolvedValueOnce({ user: { id: "admin-a" }, supabase: {} })
      .mockRejectedValueOnce(new AuthApiError("You do not have access to this operation.", 403, "FORBIDDEN"));
    const response = await GET(new Request("http://127.0.0.1:3100/api/admin/exports?dataset=users&format=json&preset=7d"));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("private-user");
    expect(query.range).toHaveBeenCalledTimes(1);
    expect(mocks.admin).toHaveBeenCalledTimes(2);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
