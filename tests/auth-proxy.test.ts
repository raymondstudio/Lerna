import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ create: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), cookies: null as null | { setAll: (cookies: unknown[]) => void } }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
import { proxy } from "@/proxy";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable-key");
  mocks.create.mockImplementation((_url, _key, options) => {
    mocks.cookies = options.cookies;
    return { auth: { getUser: mocks.getUser }, rpc: mocks.rpc };
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.getUser.mockImplementation(async () => {
    mocks.cookies?.setAll([{ name: "fixture-refresh", value: "new-fixture", options: { httpOnly: true } }]);
    return { data: { user: { id: "fixture" } }, error: null };
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("SSR refresh propagation (mocked Auth)", () => {
  it("passes refreshed cookies to downstream server rendering and the browser", async () => {
    const request = new NextRequest("http://localhost:3000/chat");
    const response = await proxy(request);
    expect(request.cookies.get("fixture-refresh")?.value).toBe("new-fixture");
    expect(response.headers.get("set-cookie")).toContain("fixture-refresh=new-fixture");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("fixture-refresh=new-fixture");
  });
  it("copies refresh cookies to redirects instead of dropping them", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/login"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/chat");
    expect(response.headers.get("set-cookie")).toContain("fixture-refresh=new-fixture");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("unverified identity cannot access a protected URL", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await proxy(new NextRequest("http://localhost:3000/chat?session=fixture"));
    expect(response.headers.get("location")).toContain("auth=login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("inactive identities are denied with their existing token", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const response = await proxy(new NextRequest("http://localhost:3000/chat"));
    expect(response.headers.get("location")).toContain("Account");
  });
  it("fails closed on account-service outage", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "synthetic outage" } });
    const response = await proxy(new NextRequest("http://localhost:3000/chat"));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toContain("fixture-refresh=new-fixture");
  });
});
