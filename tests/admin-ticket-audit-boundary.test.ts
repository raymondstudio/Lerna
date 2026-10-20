import { describe, expect, it, vi } from "vitest";

const authorize = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-admin-api", () => ({ authorizeAdminApi: authorize }));
import { PUT } from "@/app/api/admin/tickets/route";

describe("support ticket audit boundary", () => {
  it("does not copy resolution content into a separate legacy audit write", async () => {
    const query = {
      update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "22222222-2222-4222-8222-222222222222" }, error: null }),
    };
    const from = vi.fn().mockReturnValue(query);
    authorize.mockResolvedValue({ ok: true, supabase: { from }, user: { id: "11111111-1111-4111-8111-111111111111" } });
    const response = await PUT(new Request("http://127.0.0.1:3100/api/admin/tickets", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: "22222222-2222-4222-8222-222222222222", resolution_notes: "Private learner context", status: "resolved" }),
    }));
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("support_tickets");
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ resolution_notes: "Private learner context" }));
  });
});
