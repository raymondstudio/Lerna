import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.{ts,tsx,mts}"], environment: "node", maxWorkers: 2, testTimeout: 15000, hookTimeout: 30000 },
});
