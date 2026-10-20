import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authorize = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-active-user-api", () => ({
  requireActiveUserApi: authorize,
  AuthApiError: class AuthApiError extends Error {
    constructor(message: string, readonly status: number, readonly code: string) { super(message); }
  },
}));
import { AuthApiError } from "@/lib/auth/require-active-user-api";
import { GET } from "@/app/api/chat/references/route";

describe("chat reference search", () => {
  it("rejects suspended users before any material or course query", async () => {
    authorize.mockRejectedValueOnce(new AuthApiError("Account unavailable.", 403, "ACCOUNT_INACTIVE"));
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/chat/references"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "ACCOUNT_INACTIVE" } });
  });

  it("lets a validated active user search their scoped references", async () => {
    const query = {
      select: vi.fn(), eq: vi.fn(), is: vi.fn(), or: vi.fn(), ilike: vi.fn(), order: vi.fn(), limit: vi.fn(),
    };
    for (const method of ["select", "eq", "is", "or", "ilike", "order"] as const) query[method].mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });
    const from = vi.fn().mockReturnValue(query);
    authorize.mockResolvedValueOnce({ user: { id: "a" }, supabase: { from } });
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/chat/references?query=biology"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.references).toEqual([]);
    expect(from).toHaveBeenCalledWith("courses");
    expect(from).toHaveBeenCalledWith("uploaded_materials");
    expect(query.eq).toHaveBeenCalledWith("user_id", "a");
  });
});
