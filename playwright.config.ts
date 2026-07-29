/**
 * playwright.config.ts — the harness for the acceptance criteria that need a real browser.
 *
 * Everything verified so far has been static: grep the built HTML, count <h1> tags, read
 * robots.txt. That covers AC-5 and AC-8 but NOT the criteria the project actually cares most
 * about — AC-1 ("the critical one"), AC-2, AC-3 (TCPA), and AC-4 — because all four depend on
 * the React island hydrating, submitting, and producing a payload. A headless Chromium is the
 * cheapest environment that genuinely does that; the in-editor preview pane cannot, because it
 * runs with `document.visibilityState === 'hidden'`, so the `client:visible` IntersectionObserver
 * never fires and the form never mounts.
 *
 * The tests run against `astro dev`, deliberately, not a static build: they need to intercept
 * the webhook request, and a dev server is the fastest loop for that. Hard rule 6 is respected
 * twice over — the dev build already targets the TEST webhook, and every test additionally
 * ROUTES that request to a local mock, so no test run can ever reach a real endpoint.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4329;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The maintainer and the client will both open this on a phone first (PRD, Phase 2).
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    // Explicit non-production env: these tests must never run against a build wired to the
    // live lead webhook, even though they also mock it at the network layer.
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // ASTRO_DEV_TOOLBAR=false: the toolbar injects its own markup (including an <h1>) into
    // every dev page, which pollutes element queries and breaks heading assertions.
    env: { PUBLIC_ENV: 'development', ASTRO_DEV_TOOLBAR: 'false' },
  },
});
