import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ auth: vi.fn(), context: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/require-active-user-api", () => ({ requireActiveUserApi: fake.auth, AuthApiError: class extends Error {}, authApiErrorResponse: () => new Response(null,{ status: 403 }) }));
vi.mock("@/lib/repositories/quiz-context", () => ({ quizContext: fake.context }));
vi.mock("@/lib/gemini/client", () => ({ generateText: fake.generate }));
import { POST } from "@/app/api/quiz/generate/route";
import { OperationError } from "@/lib/repositories/operations";
const request = (body: unknown) => new NextRequest("http://localhost/api/quiz/generate", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetAllMocks(); fake.auth.mockResolvedValue({ user: { id: "fixture-owner" }, supabase: {} }); fake.context.mockResolvedValue(""); });
it("valid fixture questions retain the API envelope and explicit practice provenance", async () => {
  fake.generate.mockResolvedValue({ text: JSON.stringify({ questions: Array.from({ length: 3 }, () => ({ question: "Synthetic question?", options: ["A","B","C","D"], correct_answer: "A", explanation: "Fixture explanation." })) }) });
  const response = await POST(request({ count: 3 })); const body = await response.json();
  expect(response.status).toBe(200); expect(body.data.questions).toHaveLength(3); expect(body.data.resultSource).toBe("client_reported_practice");
  expect(fake.generate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ userId: "fixture-owner", requestType: "quiz" }));
});
it("foreign or unavailable selected context stops generation", async () => {
  fake.context.mockRejectedValue(new OperationError("Material not found.",404));
  expect((await POST(request({ count: 3 }))).status).toBe(404); expect(fake.generate).not.toHaveBeenCalled();
});
it("quota exhaustion returns 429 and never substitutes example questions", async () => {
  fake.generate.mockRejectedValue(new OperationError("Plan limit reached.",429));
  const response = await POST(request({ count: 3 }));
  expect(response.status).toBe(429); expect((await response.json()).success).toBe(false);
});
it("invalid provider questions fail truthfully instead of supplying missing answers", async () => {
  fake.generate.mockResolvedValue({ text: '{"questions":[{"question":"Broken fixture"}]}' });
  const response = await POST(request({ count: 3 })); expect(response.status).toBe(503); expect((await response.json()).success).toBe(false);
});
it("invalid counts and foreign body fields fail before any context or provider work", async () => {
  expect((await POST(request({ count: 500, userId: "forged" }))).status).toBe(400); expect(fake.context).not.toHaveBeenCalled(); expect(fake.generate).not.toHaveBeenCalled();
});
