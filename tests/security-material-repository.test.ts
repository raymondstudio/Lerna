import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ active: vi.fn(), admin: vi.fn(), upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/require-active-user-api", () => ({ requireActiveUserApi: mocks.active }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseUrl: () => "https://fixture.supabase.co" }));
import { insertMaterial, storeUpload, removeStoredUpload, completeMaterialCleanup } from "@/lib/repositories/materials";
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const courseId = "33333333-3333-4333-8333-333333333333";
const path = `${userId}/${sessionId}/fixture.txt`;
const material = { id: "44444444-4444-4444-8444-444444444444", user_id: userId, session_id: sessionId, storage_path: path };
function clientWith(rows: Record<string, unknown>) {
  return { from: vi.fn((table: string) => { const q: Record<string, unknown> = {}; for (const method of ["select", "eq", "is"]) q[method] = vi.fn(() => q); q.maybeSingle = vi.fn(async () => ({ data: rows[table] ?? null, error: null })); return q; }) } as unknown as SupabaseClient;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockReturnValue({ rpc: mocks.rpc, from: () => ({ insert: mocks.insert }), storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) } });
  mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: material, error: null }) }) });
  mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null });
});
describe("server-only material mutations", () => {
  it("acknowledges only the expected cleanup revision and preserves a newer pending job", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await completeMaterialCleanup(material.id, 7);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_material_cleanup", { p_material_id: material.id, p_expected_revision: 7 });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(completeMaterialCleanup(material.id, 7)).rejects.toMatchObject({ code: "CLEANUP_PENDING" });
    mocks.admin.mockClear();
    await expect(completeMaterialCleanup(material.id, 0)).rejects.toMatchObject({ code: "CLEANUP_PENDING" });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("revalidates active identity and parents before service insertion and derives the course", async () => {
    const client = clientWith({ study_sessions: { id: sessionId, course_id: courseId }, courses: { id: courseId } });
    mocks.active.mockResolvedValue({ user: { id: userId }, supabase: client });
    await insertMaterial(userId, sessionId, "fixture.txt", "text/plain", path, 8);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId, session_id: sessionId, course_id: courseId, file_size: 8 }));
  });
  it("denies inactive, foreign identity and foreign parent before constructing a privileged client", async () => {
    mocks.active.mockRejectedValueOnce(new Error("Synthetic inactive account"));
    await expect(insertMaterial(userId, sessionId, "fixture.txt", "text/plain", path, 8)).rejects.toThrow();
    mocks.active.mockResolvedValueOnce({ user: { id: courseId }, supabase: clientWith({}) });
    await expect(insertMaterial(userId, sessionId, "fixture.txt", "text/plain", path, 8)).rejects.toMatchObject({ status: 403 });
    mocks.active.mockResolvedValueOnce({ user: { id: userId }, supabase: clientWith({}) });
    await expect(insertMaterial(userId, sessionId, "fixture.txt", "text/plain", path, 8)).rejects.toMatchObject({ status: 404 });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects duplicate paths without mutating the previous material", async () => {
    mocks.active.mockResolvedValue({ user: { id: userId }, supabase: clientWith({ study_sessions: { id: sessionId }, uploaded_materials: material }) });
    await expect(insertMaterial(userId, sessionId, "fixture.txt", "text/plain", path, 8)).rejects.toMatchObject({ code: "DUPLICATE_UPLOAD" });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("uploads through service storage only after the owned session and path checks", async () => {
    await storeUpload(clientWith({ study_sessions: { id: sessionId } }), material as never, userId, Buffer.from("fixture"), "text/plain");
    expect(mocks.upload).toHaveBeenCalledWith(path, expect.any(Buffer), { contentType: "text/plain", upsert: false });
    mocks.admin.mockClear();
    await expect(storeUpload(clientWith({}), material as never, userId, Buffer.from("fixture"), "text/plain")).rejects.toMatchObject({ status: 404 });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects a foreign physical deletion path and propagates cleanup failures", async () => {
    await expect(removeStoredUpload({ ...material, storage_path: `${courseId}/${sessionId}/fixture.txt` }, userId)).rejects.toThrow();
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.remove.mockResolvedValue({ error: new Error("Synthetic storage failure") });
    await expect(removeStoredUpload(material, userId)).rejects.toMatchObject({ code: "CLEANUP_PENDING" });
  });
});
