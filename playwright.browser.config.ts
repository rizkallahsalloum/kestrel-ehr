import { defineConfig, devices } from "@playwright/test";

// Real-browser checks of shared components on the development-only specimen pages.
// Runs `next dev` without Supabase configuration; nothing here touches a database.
const PORT = 3200;

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/dev/components`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
