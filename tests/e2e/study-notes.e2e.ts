import { expect, test } from "@playwright/test";
import { freshAuthenticatedContext } from "./auth-fixture";

test("notes survive refresh, concurrent tabs, completion and a fresh login", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "390px", "This persistence journey is checked at the mobile viewport.");
  test.setTimeout(150_000);
  const fixture = await freshAuthenticatedContext(browser, "a");
  let courseId: string | undefined;
  let sessionId: string | undefined;
  try {
    const { page } = fixture;
    const course = await page.request.post("/api/courses", { data: { code: `FIX${Date.now()}`, title: "Local notes fixture" } });
    expect(course.ok()).toBe(true);
    courseId = (await course.json() as { course?: { id?: string } }).course?.id;
    expect(courseId).toMatch(/^[0-9a-f-]{36}$/i);

    await page.goto(`/study?courseId=${courseId}`);
    await page.getByRole("button", { name: "Start Session" }).click();
    await page.waitForURL(/\/study\?session=[0-9a-f-]{36}/i);
    sessionId = new URL(page.url()).searchParams.get("session") ?? undefined;
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    const notes = page.getByLabel("Quick Notes");
    const status = page.locator('label:has-text("Quick Notes") + span[role="status"]');
    await notes.fill("First durable local note");
    await expect(status).toHaveText(/Unsaved|Saving/);
    await expect(status).toHaveText("Saved", { timeout: 12_000 });
    await page.reload();
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(page.getByLabel("Quick Notes")).toHaveValue("First durable local note");

    const second = await fixture.context.newPage();
    await second.goto(`/study?session=${sessionId}`);
    await second.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(second.getByLabel("Quick Notes")).toHaveValue("First durable local note");
    await notes.fill("Newer note from the first tab");
    await expect(status).toHaveText(/Unsaved|Saving/);
    await expect(status).toHaveText("Saved", { timeout: 12_000 });
    await second.getByLabel("Quick Notes").fill("A separate draft from the second tab");
    await expect(second.getByText("Conflicting changes", { exact: true })).toBeVisible({ timeout: 12_000 });
    await expect(second.getByLabel("Quick Notes")).toHaveValue("A separate draft from the second tab");
    await second.getByRole("button", { name: "Use saved version" }).click();
    await expect(second.getByLabel("Quick Notes")).toHaveValue("Newer note from the first tab");
    await second.close();

    await notes.fill("");
    await expect(status).toHaveText(/Unsaved|Saving/);
    await expect(status).toHaveText("Saved", { timeout: 12_000 });
    await notes.fill("Final note after deliberate clearing");
    await expect(status).toHaveText(/Unsaved|Saving/);
    await expect(status).toHaveText("Saved", { timeout: 12_000 });
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByRole("heading", { name: "Session Complete!" })).toBeVisible();
    await expect(page.getByLabel("Quick Notes")).toHaveValue("Final note after deliberate clearing");
    await page.reload();
    await expect(page.getByLabel("Quick Notes")).toHaveValue("Final note after deliberate clearing");
  } finally {
    await fixture.context.close();
  }

  const fresh = await freshAuthenticatedContext(browser, "a");
  try {
    // A new browser context has no inherited cookies or local draft storage.
    const { page } = fresh;
    await page.goto(`/study?session=${sessionId}`);
    await expect(page.getByLabel("Quick Notes")).toHaveValue("Final note after deliberate clearing");
  } finally {
    await fresh.context.close();
  }
});
