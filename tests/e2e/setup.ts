import { localTargets } from "../support/local-targets.mjs";
import { readFile } from "node:fs/promises";
export default async function setup() {
  const targets = localTargets();
  const preflight = await fetch(`${targets.app}/api/internal/test-readiness`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!preflight?.ok || (await preflight.json()).provider !== "mock") throw new Error("BLOCKED: the local app must run in development with LERNA_TEST_MODE=local and mocked AI providers.");
  const health = await fetch(`${targets.backend}/auth/v1/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!health?.ok) throw new Error("BLOCKED: real local Auth/Storage/mailbox containers are unavailable. These integration tests cannot use synthetic SQL schemas or hosted services.");
  const fixture = JSON.parse(await readFile(".stabilization-local/fixtures.json", "utf8"));
  if (fixture.backend !== targets.backend || Date.now()-Date.parse(fixture.createdAt)>24*3600000) throw new Error("BLOCKED: provision fresh local fixtures for this backend.");
}
