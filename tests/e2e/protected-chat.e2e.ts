import { expect, test } from "@playwright/test";
import { freshAuthenticatedContext } from "./auth-fixture";

test("mocked protected chat sends, reopens and scopes a local material on mobile", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "390px", "This authenticated chat path is checked on the mobile viewport.");
  test.setTimeout(120_000);
  const fixture = await freshAuthenticatedContext(browser, "a");
  try {
    const { page } = fixture;
    const composer = page.getByRole("combobox", { name: "Message Lerna" });
    const firstPrompt = "Explain photosynthesis from my local fixture";
    await composer.fill(firstPrompt);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(firstPrompt, { exact: true })).toBeVisible();
    await expect(page.getByText(/Offline Simulated Mode/).first()).toBeVisible();
    await page.waitForURL(/\/chat\?session=[0-9a-f-]{36}/i);
    const sessionUrl = page.url();
    await page.reload();
    await expect(page.getByText(firstPrompt, { exact: true })).toBeVisible();
    await expect(page.getByText(/Offline Simulated Mode/).first()).toBeVisible();

    const printable = await browser.newPage();
    let pdf: Buffer;
    try {
      await printable.setContent("<html><body><h1>Local biology fixture</h1><p>Photosynthesis converts light energy into chemical energy in chloroplasts. Chlorophyll absorbs light while carbon dioxide and water become glucose and oxygen.</p></body></html>");
      pdf = await printable.pdf({ format: "A4" });
    } finally {
      await printable.close();
    }
    const filename = "lerna-stabilization-biology.pdf";
    await page.getByLabel("Choose a PDF to upload").setInputFiles({ name: filename, mimeType: "application/pdf", buffer: pdf });
    await expect(page.getByText(/successfully analyzed/).first()).toBeVisible();

    const sessionId = new URL(sessionUrl).searchParams.get("session");
    const materials = await page.request.get(`/api/materials?sessionId=${sessionId}`);
    expect(materials.ok()).toBe(true);
    const rows = (await materials.json() as { data?: { materials?: Array<{ id: string; fileName: string }> } }).data?.materials ?? [];
    const selectedId = rows.find(row => row.fileName === filename)?.id;
    expect(selectedId).toMatch(/^[0-9a-f-]{36}$/i);

    await composer.fill(`@${filename.slice(0, 18)}`);
    const choices = page.getByRole("dialog", { name: "Choose a course or uploaded material" });
    await choices.getByRole("option", { name: new RegExp(filename) }).click();
    await expect(page.getByText("Scoped", { exact: true })).toBeVisible();
    await composer.press("End");
    await composer.type(" Explain the role of chlorophyll.");
    const scopedRequest = page.waitForRequest(request => {
      if (!request.url().endsWith("/api/chat") || request.method() !== "POST") return false;
      try { return (request.postDataJSON() as { materialId?: string }).materialId === selectedId; }
      catch { return false; }
    });
    await page.getByRole("button", { name: "Send message" }).click();
    await scopedRequest;
    await expect(page.getByText(/Offline Simulated Mode/).last()).toBeVisible();
    await page.reload();
    await expect(page.getByText(/role of chlorophyll/).first()).toBeVisible();
  } finally {
    await fixture.context.close();
  }
});
