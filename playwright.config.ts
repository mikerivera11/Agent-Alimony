import { defineConfig, devices } from "@playwright/test";

// Point the suite at a deployed environment with E2E_BASE_URL, e.g.
//   E2E_BASE_URL=https://fsg-prod-app.azurewebsites.net npx playwright test
// which also skips starting a local dev server.
const deployedBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: deployedBaseUrl ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: deployedBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
