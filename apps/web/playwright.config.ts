import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const previewCommand = process.env.CI
  ? "pnpm exec astro preview --host 127.0.0.1 --port 4321"
  : "pnpm build && pnpm exec astro preview --host 127.0.0.1 --port 4321";

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure",
  },
  webServer: {
    command: previewCommand,
    cwd: webRoot,
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
  ],
});
