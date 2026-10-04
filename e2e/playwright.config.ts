import { defineConfig, devices } from "@playwright/test";

/**
 * The judge walkthrough against a running system (PRD v3 section 16, section 17 "End to end").
 *
 *   docker compose up --build            (the app on http://localhost:8080)
 *   cd e2e && npm ci && npx playwright install chromium && npm test
 *
 * Against a local build instead: E2E_BASE_URL=http://localhost:4173 E2E_API_URL=http://localhost:8000 npm test
 *
 * The steps share one database and one scenario clock, so they run in order, one at a time. Run the API with CLOCK_RATE=0 so
 * the clock moves only when a step moves it (the default of 1 would let real time pass between steps).
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    // The walkthrough reads wall-clock times off the screen ("Received 15:40"), and each must read the same wherever
    // the judge's laptop is. So the browser is deliberately not Asia/Colombo: a timestamp that forgot to say which
    // zone it meant shows up here instead of in front of a judge. The frontend unit tests do the same by running
    // twice (ci.yml, "wherever the judge's laptop is"). E2E_TZ overrides it.
    timezoneId: process.env.E2E_TZ ?? "America/New_York",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The driver's proof-of-delivery photo opens the camera: give the browser a fake one and allow it.
        permissions: ["camera"],
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
      },
    },
  ],
});
