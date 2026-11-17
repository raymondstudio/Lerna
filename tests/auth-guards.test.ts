import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
import { requireActiveUserApi, authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import { requireAdminApi, authorizeAdminApi } from "@/lib/auth/require-admin-api";

const user = { id: "fixture-user", email: "staff@fixture.invalid", app_metadata: { role: "owner" } };
function client({ active = true, admin = false, roleError = false, activeError = false, aal = "aal1", mfaError = false, signedIn = true } = {}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: signedIn ? user : null }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: aal }, error: mfaError ? {} : null }) } },
    rpc: vi.fn().mockImplementation((name: string) => Promise.resolve({
      data: name === "is_active_user" ? active : admin,
      error: (name === "is_active_user" ? activeError : roleError) ? { message: "synthetic outage" } : null,
    })),
  };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());
describe("canonical account and admin boundary (mocked services)", () => {
  it("accepts a validated active learner without claiming admin privileges", async () => {
    const fixture = client(); createClient.mockResolvedValue(fixture);
    await expect(requireActiveUserApi()).resolves.toMatchObject({ user });
    expect(fixture.rpc).toHaveBeenCalledWith("is_active_user", { user_id: user.id });
    expect(fixture.rpc).not.toHaveBeenCalledWith("is_admin", expect.anything());
  });
  it("denies anonymous access before role or account queries", async () => {
    const fixture = client({ signedIn: false }); createClient.mockResolvedValue(fixture);
    expect((await authorizeActiveUserApi()).ok).toBe(false);
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("denies suspended/deleted/missing-profile identities", async () => {
    createClient.mockResolvedValue(client({ active: false }));
    await expect(requireActiveUserApi()).rejects.toMatchObject({ status: 403, code: "ACCOUNT_INACTIVE" });
  });
  it("fails closed when account status cannot be verified", async () => {
    createClient.mockResolvedValue(client({ activeError: true }));
    await expect(requireActiveUserApi()).rejects.toMatchObject({ status: 503 });
  });
  it("database demotion overrides synthetic configured email and stale owner metadata", async () => {
    vi.stubEnv("ADMIN_EMAILS", user.email);
    createClient.mockResolvedValue(client({ admin: false }));
    await expect(requireAdminApi()).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
  it("role-service failure cannot fall back to metadata or an email allowlist", async () => {
    vi.stubEnv("ADMIN_EMAILS", user.email);
    createClient.mockResolvedValue(client({ admin: true, roleError: true }));
    await expect(requireAdminApi()).rejects.toMatchObject({ status: 503 });
  });
  it("permits a canonical active admin for ordinary admin reads", async () => {
    createClient.mockResolvedValue(client({ admin: true }));
    await expect(requireAdminApi()).resolves.toMatchObject({ user });
  });
  it("requires real AAL2 for sensitive actions and returns a usable step-up path", async () => {
    createClient.mockResolvedValue(client({ admin: true, aal: "aal1" }));
    const result = await authorizeAdminApi({ requireMfa: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await result.response.json()).toMatchObject({ code: "MFA_REQUIRED", stepUpPath: "/auth/mfa" });
    }
  });
  it("permits sensitive operations after a verified AAL2 session", async () => {
    createClient.mockResolvedValue(client({ admin: true, aal: "aal2" }));
    await expect(requireAdminApi({ requireMfa: true })).resolves.toMatchObject({ user });
  });
  it("MFA provider errors fail closed", async () => {
    createClient.mockResolvedValue(client({ admin: true, aal: "aal2", mfaError: true }));
    await expect(requireAdminApi({ requireMfa: true })).rejects.toMatchObject({ status: 503 });
  });
});
