import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), audit: vi.fn(), read: vi.fn(), summary: vi.fn(), select: vi.fn(), summarize: vi.fn() }));
vi.mock("@/lib/auth/require-admin-api", () => ({ requireAdminApi: mocks.admin }));
vi.mock("@/lib/activity/sources", () => ({ readActivity: mocks.read, readActivitySummary: mocks.summary }));
vi.mock("@/lib/repositories/activity", () => ({ appendActivityEvent: mocks.audit, selectActivity: mocks.select, summarizeActivity: mocks.summarize }));
import { GET as adminFeed } from "@/app/api/admin/events/route";
import { GET as sourceFeed } from "@/app/api/internal/activity/route";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("activity read audit outcome", () => {
  it("records an attempt rather than successful investigation when the admin source fails", async () => {
    vi.stubEnv("ACTIVITY_ENVIRONMENT", "local");
    mocks.admin.mockResolvedValue({ user: { id: "admin-a" } });
    mocks.audit.mockResolvedValue("audit-a");
    mocks.read.mockRejectedValue(new Error("source unavailable"));
    const response = await adminFeed(new Request("http://127.0.0.1:3100/api/admin/events?range=1d"));
    expect(response.status).toBe(503);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ event_type: "admin.activity.read", outcome: "attempted" }));
  });
  it("keeps remote source pre-read audits attempted when source storage fails", async () => {
    vi.stubEnv("ACTIVITY_ENVIRONMENT", "local"); vi.stubEnv("ACTIVITY_READ_TOKEN", "a".repeat(40));
    mocks.audit.mockResolvedValue("audit-b"); mocks.select.mockRejectedValue(new Error("storage unavailable"));
    const response = await sourceFeed(new Request("http://127.0.0.1:3100/api/internal/activity?range=1d", { headers: { authorization: `Bearer ${"a".repeat(40)}` } }));
    expect(response.status).toBe(503);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ event_type: "admin.activity.read", outcome: "attempted" }));
  });
});
