import { expect, test } from "@playwright/test";
import { freshAuthenticatedContext, restrictToLocal } from "./auth-fixture";

test("anonymous and another learner cannot read a fresh learner session", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "390px", "API isolation is independent of viewport width.");
  const anonymous = await browser.newContext();
  await restrictToLocal(anonymous);
  const a = await freshAuthenticatedContext(browser, "a");
  let sessionId: string | undefined;
  try {
    const created = await a.page.request.post("/api/study-sessions", {
      data: { title: "Local isolation control", operationId: crypto.randomUUID() },
    });
    expect(created.status()).toBe(200);
    const body = await created.json() as { data?: { session?: { id?: string } } };
    sessionId = body.data?.session?.id;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const ownerRead = await a.page.request.get(`/api/study-sessions/${sessionId}`);
    expect(ownerRead.status()).toBe(200);
    const anonymousRead = await anonymous.request.get(`${process.env.LERNA_E2E_BASE_URL ?? "http://127.0.0.1:3100"}/api/study-sessions/${sessionId}`);
    expect(anonymousRead.status()).toBe(401);

    const b = await freshAuthenticatedContext(browser, "b");
    try {
      const foreignRead = await b.page.request.get(`/api/study-sessions/${sessionId}`);
      expect(foreignRead.status()).toBe(404);
    } finally {
      await b.context.close();
    }
  } finally {
    if (sessionId) await a.page.request.delete(`/api/study-sessions/${sessionId}`).catch(() => undefined);
    await a.context.close();
    await anonymous.close();
  }
});
