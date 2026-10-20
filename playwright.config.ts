import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./tests/e2e/setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: { baseURL: process.env.LERNA_E2E_BASE_URL ?? "http://127.0.0.1:3100", channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [360,390,768,1280,1440].map(width => ({ name: `${width}px`, use: { viewport: { width, height: 900 } } })),
  reporter: [["list"],["html", { open: "never" }]],
});
