import { describe, expect, it, vi } from "vitest";

const authorize = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-active-user-api", () => ({ authorizeActiveUserApi: authorize }));
vi.mock("@/lib/chat/service", () => ({ getAIResponse: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { OperationError } from "@/lib/repositories/operations";
import { getAIResponse } from "@/lib/chat/service";
import { POST } from "@/app/api/chat/route";

describe("protected chat request boundary", () => {
  it("returns the budget denial without invoking a provider or account query", async () => {
    authorize.mockRejectedValueOnce(new OperationError("Your plan limit has been reached.", 429));
    const response = await POST(new Request("http://127.0.0.1:3100/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Explain the fixture concept" }] }),
    }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "PLAN_LIMIT_REACHED" } });
  });

  it("rejects an oversized or invalid message before authorization", async () => {
    authorize.mockClear();
    const response = await POST(new Request("http://127.0.0.1:3100/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "x".repeat(50_001) }] }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    expect(authorize).not.toHaveBeenCalled();
  });

  it.each([
    ["non-string session", { sessionId: 123 }],
    ["malformed course", { courseId: "not-a-uuid" }],
    ["non-string material", { materialId: { id: "x" } }],
  ])("rejects an explicit %s ID before authorization or writes", async (_name, reference) => {
    authorize.mockClear();
    vi.mocked(getAIResponse).mockClear();
    const response = await POST(new Request("http://127.0.0.1:3100/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Explain this" }], ...reference }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    expect(authorize).not.toHaveBeenCalled();
    expect(getAIResponse).not.toHaveBeenCalled();
  });

  it.each([
    ["foreign session", { sessionId: "22222222-2222-4222-8222-222222222222" }, "SESSION_NOT_FOUND"],
    ["foreign course", { courseId: "33333333-3333-4333-8333-333333333333" }, "REFERENCE_NOT_FOUND"],
    ["deleted material", { materialId: "44444444-4444-4444-8444-444444444444" }, "REFERENCE_NOT_FOUND"],
  ])("rejects a %s without session/message/provider side effects", async (_name, reference, code) => {
    const inserted = vi.fn();
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), insert: inserted,
    };
    const supabase = { from: vi.fn().mockReturnValue(query) };
    authorize.mockReset().mockResolvedValue({ ok: true, supabase, user: { id: "11111111-1111-4111-8111-111111111111" } });
    vi.mocked(getAIResponse).mockClear();
    const response = await POST(new Request("http://127.0.0.1:3100/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Explain this" }], ...reference }),
    }));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(inserted).not.toHaveBeenCalled();
    expect(getAIResponse).not.toHaveBeenCalled();
  });
});
