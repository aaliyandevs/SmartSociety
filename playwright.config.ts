import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * End-to-end tests drive a real browser against a running application backed by
 * the seeded demo database — the same data an evaluator sees.
 *
 * Before running: `npm run db:up && npm run db:seed`, then `npm run test:e2e`.
 * Playwright starts the dev server itself unless one is already listening.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The gate console must work on a tablet, so exercise a tablet-ish viewport.
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    // Logs in once per role and saves the session, so the feature specs do not
    // re-authenticate on every test (which would legitimately trip the
    // application's per-identifier login rate limit).
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
