import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  active: vi.fn(), admin: vi.fn(), ticket: vi.fn(), list: vi.fn(), insert: vi.fn(),
}));
vi.mock("@/lib/auth/require-active-user-api", async (original) => ({
  ...await original<typeof import("@/lib/auth/require-active-user-api")>(), requireActiveUserApi: mocks.active,
}));
vi.mock("@/lib/auth/require-admin-api", () => ({ requireAdminApi: mocks.admin }));
vi.mock("@/lib/repositories/auth", () => ({
  selectAccessibleTicket: mocks.ticket, selectTicketReplies: mocks.list, insertTicketReply: mocks.insert,
}));
import { AuthApiError } from "@/lib/auth/require-active-user-api";
import { GET, POST } from "@/app/api/admin/tickets/replies/route";

const ticketId = "11111111-1111-4111-8111-111111111111";
const user = { id: "fixture-a" };
const supabase = { fixture: true };
const request = () => new Request("http://localhost:3000/api/admin/tickets/replies", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ticketId, message: "Synthetic fixture reply", user_id: "fixture-b" }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.active.mockResolvedValue({ user, supabase });
  mocks.ticket.mockResolvedValue({ id: ticketId, user_id: user.id });
  mocks.list.mockResolvedValue([]);
  mocks.insert.mockResolvedValue({ id: "fixture-reply" });
  mocks.admin.mockRejectedValue(new AuthApiError("Forbidden", 403));
});
describe("support replies retain learner access with parent authorization", () => {
  it("an ordinary learner can read and reply to their own ticket", async () => {
    const getResponse = await GET(new Request(`http://localhost:3000/api/admin/tickets/replies?ticketId=${ticketId}`));
    expect(getResponse.status).toBe(200);
    const postResponse = await POST(request());
    expect(postResponse.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(supabase, ticketId, user.id, "Synthetic fixture reply");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("a foreign parent is denied before reading replies or inserting", async () => {
    mocks.ticket.mockResolvedValue({ id: ticketId, user_id: "fixture-b" });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("canonical staff can reply to a customer as the verified staff actor", async () => {
    mocks.ticket.mockResolvedValue({ id: ticketId, user_id: "fixture-b" });
    mocks.admin.mockResolvedValue({ supabase, user });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(supabase, ticketId, user.id, "Synthetic fixture reply");
  });
  it("an invisible/missing parent causes no side effects", async () => {
    mocks.ticket.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("role verification outages deny foreign access", async () => {
    mocks.ticket.mockResolvedValue({ id: ticketId, user_id: "fixture-b" });
    mocks.admin.mockRejectedValue(new AuthApiError("Temporarily unavailable", 503));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
