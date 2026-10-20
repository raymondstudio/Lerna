import { expect, test } from "@playwright/test";
import { freshAuthenticatedContext } from "./auth-fixture";

test("a committed note appears in a filtered admin feed across fresh browser contexts", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "390px", "Ledger durability is independent of viewport width.");
  const learner = await freshAuthenticatedContext(browser, "a");
  let sessionId: string | undefined;
  const operationId = crypto.randomUUID();
  try {
    const created = await learner.page.request.post("/api/study-sessions", { data: { title: "Local activity fixture", operationId: crypto.randomUUID() } });
    expect(created.ok()).toBe(true);
    const session = (await created.json() as { data?: { session?: { id?: string; notesRevision?: number } } }).data?.session;
    sessionId = session?.id;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    const saved = await learner.page.request.patch(`/api/study-sessions/${sessionId}`, {
      data: { notes: "Synthetic local activity note", expectedNotesRevision: session?.notesRevision ?? 0, operationId },
    });
    expect(saved.ok()).toBe(true);
    expect((await saved.json() as { data?: { noteWrite?: { operationId?: string } } }).data?.noteWrite?.operationId).toBe(operationId);

    for (let attempt = 0; attempt < 2; attempt++) {
      const admin = await freshAuthenticatedContext(browser, "admin");
      try {
        const query = new URLSearchParams({ environment: "local", range: "1d", user_id: learner.id, event_type: "note.saved", outcome: "succeeded" });
        const response = await admin.page.request.get(`/api/admin/events?${query}`);
        expect(response.ok()).toBe(true);
        const events = (await response.json() as { data?: { events?: Array<{ activity_id?: string; resource_id?: string; environment?: string }> } }).data?.events ?? [];
        expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ activity_id: operationId, resource_id: sessionId, environment: "local" })]));
        const exportAttempt = await admin.page.request.get(`/api/admin/exports?dataset=user_activity&format=json&${query}`);
        expect(exportAttempt.status()).toBe(403);
        expect((await exportAttempt.json() as { code?: string }).code).toBe("MFA_REQUIRED");
      } finally {
        await admin.context.close();
      }
    }
  } finally {
    if (sessionId) await learner.page.request.delete(`/api/study-sessions/${sessionId}`).catch(() => undefined);
    await learner.context.close();
  }
});
