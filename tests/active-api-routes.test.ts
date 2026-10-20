import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), invoices: vi.fn() }));
vi.mock("@/lib/auth/require-active-user-api", () => ({ authorizeActiveUserApi: mocks.authorize }));
vi.mock("@/lib/repositories/billing", () => ({ getInvoices: mocks.invoices }));

import { GET as getInvoices } from "@/app/api/account/invoices/route";
import { GET as getOnboarding, POST as saveOnboarding } from "@/app/api/account/onboarding/route";
import { GET as getSubscription } from "@/app/api/account/subscription/route";
import { GET as getUsage } from "@/app/api/account/usage/route";
import { GET as getCourses, POST as createCourse } from "@/app/api/courses/route";
import { GET as getCourse, PATCH as editCourse, DELETE as deleteCourse } from "@/app/api/courses/[id]/route";
import { GET as getFeedback, POST as createFeedback } from "@/app/api/feedback/route";
import { GET as searchInstitutions } from "@/app/api/institutions/search/route";
import { GET as getQuiz } from "@/app/api/quiz/[id]/route";
import { GET as getTickets, POST as createTicket } from "@/app/api/tickets/route";

const request = () => new NextRequest("http://127.0.0.1:3100/api/fixture", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) };

describe("older account and learner APIs use the active-account boundary", () => {
  beforeEach(() => { mocks.authorize.mockReset(); mocks.invoices.mockReset(); });

  it("returns the suspension response before any legacy read or write", async () => {
    const suspended = Response.json({ code: "ACCOUNT_INACTIVE" }, { status: 403 });
    mocks.authorize.mockResolvedValue({ ok: false, response: suspended });
    const handlers = [
      () => getInvoices(), () => getOnboarding(), () => saveOnboarding(request()),
      () => getSubscription(), () => getUsage(), () => getCourses(request()), () => createCourse(request()),
      () => getCourse(request(), context), () => editCourse(request(), context), () => deleteCourse(request(), context),
      () => getFeedback(), () => createFeedback(request()), () => searchInstitutions(request()),
      () => getQuiz(request(), context), () => getTickets(), () => createTicket(request()),
    ];
    for (const handle of handlers) expect((await handle()).status).toBe(403);
    expect(mocks.authorize).toHaveBeenCalledTimes(handlers.length);
    expect(mocks.invoices).not.toHaveBeenCalled();
  });

  it("allows a validated account to load only its invoice scope", async () => {
    mocks.authorize.mockResolvedValueOnce({ ok: true, user: { id: "user-a" }, supabase: {} });
    mocks.invoices.mockResolvedValueOnce([{ id: "invoice-a" }]);
    const response = await getInvoices();
    expect(response.status).toBe(200);
    expect(mocks.invoices).toHaveBeenCalledWith("user-a");
    expect((await response.json()).invoices).toEqual([{ id: "invoice-a" }]);
  });

  it("reports a foreign course as missing on both read and delete", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), delete: vi.fn(), maybeSingle: vi.fn() };
    for (const method of ["select", "eq", "delete"] as const) query[method].mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue(query);
    mocks.authorize.mockResolvedValue({ ok: true, user: { id: "user-a" }, supabase: { from } });
    expect((await getCourse(request(), context)).status).toBe(404);
    expect((await deleteCourse(request(), context)).status).toBe(404);
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-a");
  });
});
