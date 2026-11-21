import { expect, test } from "@playwright/test";
import { localTargets } from "../support/local-targets.mjs";

test.beforeEach(async ({ context }) => {
  const targets = localTargets();
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return [targets.app,targets.backend,targets.search,targets.mailbox].includes(url.origin) || ["data:","about:"].includes(url.protocol) ? route.continue() : route.abort("blockedbyclient");
  });
});
test("landing retains functional static content and reduced-motion navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Understand your materials. Keep what you learn.");
  await expect(page.getByRole("link", { name: /^Get started/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByText("How do saved notes work?", { exact: true }).click();
  await expect(page.locator("details[open]")).toContainText("Saved status");
  await page.getByRole("link", { name: /^Get started/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
