import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { fixtureIdentity, restrictToLocal } from "./auth-fixture";
import { currentMailIds, waitForRecoveryLink } from "./mailpit";
import { localTargets } from "../support/local-targets.mjs";

test("a fresh local recovery email replaces the password and cannot be reused", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "390px", "One real Auth recovery journey is sufficient across viewports.");
  const identity = await fixtureIdentity("recovery");
  const originalMessages = await currentMailIds(identity.email);
  const newPassword = `R${randomBytes(12).toString("base64url")}a!9 `;
  const context = await browser.newContext({ baseURL: localTargets().app, viewport: { width: 390, height: 900 } });
  await restrictToLocal(context);
  try {
    const page = await context.newPage();
    await page.goto("/?auth=login");
    await page.getByRole("button", { name: "Forgot Password?" }).click();
    await page.getByLabel("Email address").fill(identity.email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByText("If an account can receive recovery email")).toBeVisible();

    const link = await waitForRecoveryLink(identity.email, originalMessages);
    await page.goto(link);
    await page.waitForURL(/\/auth\/reset-password(?:[?#]|$)/);
    await expect(page.getByRole("heading", { name: "Create New Password" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.getByRole("status")).toContainText("Password updated. Sign in with your new password.");

    // The same browser and the same email link have already consumed their proof.
    await page.goto(link);
    await expect(page).not.toHaveURL(/\/auth\/reset-password(?:[?#]|$)/);
  } finally {
    await context.close();
  }

  const oldLogin = await browser.newContext({ baseURL: localTargets().app });
  await restrictToLocal(oldLogin);
  try {
    const page = await oldLogin.newPage();
    await page.goto("/?auth=login");
    await page.getByRole("textbox", { name: "Email address" }).fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill(identity.password);
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).not.toHaveURL(/\/chat(?:[?#]|$)/);

    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await page.waitForURL(/\/chat(?:[?#]|$)/);
    const profile = await page.request.get("/api/auth/profile");
    expect(profile.ok()).toBe(true);
    expect((await profile.json() as { data?: { id?: string } }).data?.id).toBe(identity.id);

    await page.goto("/auth/callback?code=malformed&next=%2Fauth%2Freset-password");
    await expect(page).not.toHaveURL(/\/auth\/reset-password(?:[?#]|$)/);
  } finally {
    await oldLogin.close();
  }
});
