// Browser tests (tests/e2e) run in the installed Chrome against tests/server.js. Audio plays muted.
import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Each worker runs its own Chrome on a heavy page; past a handful at once, timings get unreliable
  workers: process.env.CI ? 2 : 6,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node tests/server.js ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
