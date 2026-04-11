import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "offline-resilience.spec.ts",
  timeout: 120000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://id-preview--c862557f-3194-4528-bc37-1c8fda5d9c5d.lovable.app",
    ...devices["iPhone 14"],
    actionTimeout: 10000,
  },
  reporter: "list",
});
