import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers:2, use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", timezoneId:"America/New_York" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: process.env.GW_E2E_PRODUCTION==='true'?'npm run start':'npm run dev', url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI&&process.env.GW_E2E_PRODUCTION!=='true' },
});
