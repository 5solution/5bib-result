import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * F-071 — minimal Vitest config for the merchant portal.
 * Pure-function unit tests only (i18n + formatters); node environment, no DOM.
 */
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
