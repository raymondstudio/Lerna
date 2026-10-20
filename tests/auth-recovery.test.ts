import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { completePasswordRecovery } from "@/lib/auth/password-recovery";
import { POST as checkEmail } from "@/app/api/auth/check-email/route";

function fixture(body: object = { success: true, signedOut: true }, status = 200) {
  const auth = { getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() };
  const fetch = vi.fn().mockResolvedValue(Response.json(body, { status }));
  vi.stubGlobal("fetch", fetch);
  return { auth, fetch, client: { auth } as unknown as SupabaseClient };
}
afterEach(() => vi.unstubAllGlobals());
describe("password recovery client boundary (mocked proof-verifying server)", () => {
  it("sends the exact chosen password to the server without treating browser Auth as recovery proof", async () => {
    const { auth, client, fetch } = fixture(); const password = " PaddedFixture1! ";
    await expect(completePasswordRecovery(client, password)).resolves.toEqual({ signedOut: true });
    expect(fetch).toHaveBeenCalledWith("/api/auth/recovery/complete", expect.objectContaining({ method: "POST", body: JSON.stringify({ password }) }));
    expect(auth.updateUser).not.toHaveBeenCalled(); expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("reports absent/expired recovery proof even when browser Auth holds a normal session", async () => {
    const { auth, client } = fixture({ success: false, error: "Recovery link expired. Request a new link." }, 401);
    await expect(completePasswordRecovery(client, "FixturePass1!")).rejects.toThrow(/expired/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("an unsuccessful provider attempt requires a fresh recovery link", async () => {
    const { client } = fixture({ success: false, error: "Password could not be updated. Request a new recovery link." }, 400);
    await expect(completePasswordRecovery(client, "FixturePass1!")).rejects.toThrow(/could not be updated/);
  });
  it("distinguishes durable password change from a later sign-out failure", async () => {
    const { client } = fixture({ success: true, signedOut: false });
    await expect(completePasswordRecovery(client, "FixturePass1!")).resolves.toEqual({ signedOut: false });
  });
  it("rejects an invalid password before any recovery request", async () => {
    const { client, fetch } = fixture();
    await expect(completePasswordRecovery(client, "short")).rejects.toThrow(/8 characters/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("the compatibility email endpoint never exposes membership", async () => {
    const response = await checkEmail(); expect(response.status).toBe(200);
    const body = await response.json(); expect(body).not.toHaveProperty("exists"); expect(body.success).toBe(true);
  });
});
