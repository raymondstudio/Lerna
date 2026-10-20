import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), read: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/require-admin-api", () => ({ requireAdminApi: mocks.admin }));
vi.mock("@/lib/activity/sources", () => ({ readActivity: mocks.read }));
vi.mock("@/lib/repositories/activity", () => ({ appendActivityEvent: mocks.audit }));
import { createActivityExport } from "@/lib/activity/export";

const request = () => new Request("http://127.0.0.1:3100/api/admin/exports?dataset=user_activity&format=json&range=1d");

describe("sensitive activity export", () => {
  beforeEach(() => { mocks.admin.mockReset(); mocks.read.mockReset(); mocks.audit.mockReset(); });

  it("does not read or release rows before MFA step-up", async () => {
    mocks.admin.mockRejectedValueOnce({ status: 403, code: "MFA_REQUIRED", message: "Verify your authenticator." });
    const response = await createActivityExport(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "MFA_REQUIRED", stepUpPath: "/auth/mfa" });
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("audits an allowed export before returning data and withholds it if audit persistence fails", async () => {
    mocks.admin.mockResolvedValue({ user: { id: "admin-a" } });
    mocks.read.mockResolvedValue({ events: [{ id: "event-a", event_type: "note.saved" }], nextCursor: null });
    mocks.audit.mockRejectedValueOnce(new Error("audit store unavailable"));
    const denied = await createActivityExport(request());
    expect(denied.status).toBe(503);
    expect(await denied.text()).not.toContain("event-a");
    expect(mocks.admin).toHaveBeenCalledTimes(2);

    mocks.admin.mockClear();
    mocks.audit.mockResolvedValueOnce({ id: "audit-a" });
    const allowed = await createActivityExport(request());
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).rows[0].id).toBe("event-a");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ event_type: "admin.activity.export", user_id: "admin-a" }));
    expect(mocks.admin).toHaveBeenCalledTimes(2);
  });
});
