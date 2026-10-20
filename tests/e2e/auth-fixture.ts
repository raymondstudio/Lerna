import type { Browser, BrowserContext, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { localTargets } from "../support/local-targets.mjs";

type IdentityName = "a" | "b" | "admin" | "owner" | "recovery" | "onboarding";
type Identity = { id: string; email: string; password: string };
type FixtureFile = { backend: string; createdAt: string; identities: Record<IdentityName, Identity> };

export async function fixtureIdentity(name: IdentityName): Promise<Identity> {
  const targets = localTargets();
  const file = JSON.parse(await readFile(".stabilization-local/fixtures.json", "utf8")) as FixtureFile;
  if (file.backend !== targets.backend || !Number.isFinite(Date.parse(file.createdAt)) || Date.now() - Date.parse(file.createdAt) > 24 * 3600000) {
    throw new Error("BLOCKED: provision fresh identities against the current local Auth service.");
  }
  const identity = file.identities[name];
  if (!identity?.id || !identity.email.endsWith("@fixture.invalid") || !identity.password) throw new Error(`BLOCKED: local ${name} identity is missing.`);
  return identity;
}

export async function restrictToLocal(context: BrowserContext) {
  const targets = localTargets();
  const origins = new Set([targets.app, targets.backend, targets.search, targets.mailbox]);
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return origins.has(url.origin) || ["data:", "about:"].includes(url.protocol)
      ? route.continue() : route.abort("blockedbyclient");
  });
}

/** A new browser context and a real local password login for each identity. */
export async function freshAuthenticatedContext(browser: Browser, name: IdentityName, viewport = { width: 390, height: 900 }) {
  const identity = await fixtureIdentity(name);
  const context = await browser.newContext({ baseURL: localTargets().app, viewport });
  try {
    await restrictToLocal(context);
    const page = await context.newPage();
    await page.goto("/?auth=login");
    await page.getByRole("textbox", { name: "Email address" }).fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill(identity.password);
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await page.waitForURL(/\/chat(?:[?#]|$)/);
    const response = await page.request.get("/api/auth/profile");
    if (!response.ok()) throw new Error(`Fresh ${name} login did not pass active profile verification.`);
    const body = await response.json() as { data?: { id?: string } };
    if (body.data?.id !== identity.id) throw new Error(`Fresh ${name} login resolved to another identity.`);
    await mkdir(".stabilization-local/auth", { recursive: true });
    await context.storageState({ path: `.stabilization-local/auth/${name}.json` });
    return { context, page, id: identity.id };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function expectCurrentIdentity(page: Page, id: string) {
  const response = await page.request.get("/api/auth/profile");
  if (!response.ok() || (await response.json() as { data?: { id?: string } }).data?.id !== id) {
    throw new Error("Browser context changed identity unexpectedly.");
  }
}
