import { defineConfig, devices } from '@playwright/test';

/**
 * Real-browser coverage, complementary to the Vitest/RTL suite rather than a
 * replacement for it. jsdom has no layout engine, so it can prove a responsive branch
 * exists and carries the right data, but never that it renders correctly — that gap is
 * what these tests close. Unit/component/repository-scoping tests stay in Vitest, which
 * is far faster for that kind of assertion.
 */
const PORT = 4400;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      // `*.mobile.spec.ts` asserts a phone viewport specifically; running it under the
      // desktop project too would fail every one of those assertions by design.
      testIgnore: /.*\.mobile\.spec\.ts/,
    },
    {
      // `Pixel 7` uses Chromium, unlike the iOS device presets (which default to
      // WebKit) — only the Chromium binary is installed, matching desktop-chromium.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],
  webServer: {
    // Runs against the production build, not the dev server: the dev server tolerates
    // things (unminified, unbundled, no base-path assumptions) that production does not.
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
