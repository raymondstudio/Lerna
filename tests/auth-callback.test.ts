import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ create: vi.fn(), exchange: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.create }));
import { GET } from "@/app/auth/callback/route";
import { getAppUrl, getAuthRequestOrigin } from "@/lib/supabase/config";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.fixture.invalid");
  vi.stubEnv("VERCEL_URL", "");
  mocks.exchange.mockResolvedValue({ data: { user: { id: "fixture" }, session: { fixture: true } }, error: null });
  mocks.create.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const request = (query: string, origin = "https://app.fixture.invalid") => new NextRequest(`${origin}/auth/callback?${query}`);

describe("callback and origin boundary (mocked code exchange)", () => {
  it("keeps valid return paths local and finishes PKCE exchange", async () => {
    const response = await GET(request("code=synthetic-code&next=%2Fstudy%3Ffixture%3D1"));
    expect(response.headers.get("location")).toBe("https://app.fixture.invalid/study?fixture=1");
    expect(mocks.exchange).toHaveBeenCalledWith("synthetic-code");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it.each(["https://other.fixture.invalid", "//other.fixture.invalid", "/\\other.fixture.invalid"])("blocks external return %s", async (next) => {
    const response = await GET(request(`code=synthetic-code&next=${encodeURIComponent(next)}`));
    expect(response.headers.get("location")).toBe("https://app.fixture.invalid/chat");
  });
  it("requires a fresh intent-bound recovery link instead of accepting a route hint", async () => {
    const response = await GET(request("code=synthetic-code&next=%2Fchat%3Fauth%3Dreset"));
    expect(response.headers.get("location")).toContain("auth=login");
    expect(response.headers.get("set-cookie")).toContain("lerna-recovery-proof=");
  });
  it("does not forward exchanged Auth cookies when recovery browser proof fails", async () => {
    mocks.create.mockImplementation(async (cookies: { setAll: (items: unknown[]) => void }) => {
      cookies.setAll([{ name: "fixture-session", value: "synthetic-session", options: { httpOnly: true, path: "/" } }]);
      return { auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: { id: "fixture" }, session: { access_token: "synthetic-access" } }, error: null,
      }) } };
    });
    const response = await GET(request("code=synthetic-code&next=%2Fauth%2Freset-password"));
    expect(response.headers.get("location")).toContain("auth=login");
    expect(response.headers.get("set-cookie")).not.toContain("synthetic-session");
    expect(response.cookies.get("fixture-session")).toBeUndefined();
  });
  it("invalid/reused codes fail safely without losing cookie cleanup or logging the code", async () => {
    mocks.create.mockImplementation(async (cookies: { setAll: (items: unknown[]) => void }) => {
      cookies.setAll([{ name: "fixture-session", value: "", options: { maxAge: 0 } }]);
      return { auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: null, session: null }, error: { message: "synthetic-code-provider-detail" },
      }) } };
    });
    const response = await GET(request("code=synthetic-code&next=%2Fchat"));
    expect(response.headers.get("set-cookie")).toContain("fixture-session=");
    expect(response.headers.get("location")).not.toContain("synthetic-code");
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("synthetic-code");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not reflect or log provider parameters, and never exchanges a missing code", async () => {
    const response = await GET(request("error=access_denied&error_description=private-synthetic-marker"));
    expect(response.headers.get("location")).not.toContain("private-synthetic-marker");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private-synthetic-marker");
  });
  it("local callbacks remain local despite production app config", async () => {
    const response = await GET(request("code=synthetic-code", "http://localhost:3000"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/chat");
  });
  it("initiates browser auth on the browser origin holding its verifier", () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:4321" } });
    expect(getAppUrl()).toBe("http://localhost:4321");
  });
  it("permits only the configured exact preview origin", () => {
    vi.stubEnv("VERCEL_URL", "preview.fixture.invalid");
    expect(getAuthRequestOrigin("https://preview.fixture.invalid/auth/callback")).toBe("https://preview.fixture.invalid");
    expect(() => getAuthRequestOrigin("https://unknown.fixture.invalid/auth/callback")).toThrow(/not configured/);
  });
  it("rejects unsafe return syntax and preserves allowed paths and queries", () => {
    for (const value of ["https://other.fixture.invalid", "//other.fixture.invalid", "/\\other.fixture.invalid", "/\r\n/other.fixture.invalid"]) {
      expect(sanitizeAuthReturnPath(value)).toBe("/chat");
    }
    expect(sanitizeAuthReturnPath("/study?fixture=1#notes")).toBe("/study?fixture=1#notes");
  });
});
