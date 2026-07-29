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

  /*
   * Capped at 2 locally, against a default of (cores / 2).
   *
   * The bottleneck is the Astro DEV server, not the browser. The home page pulls nine stock
   * photographs at up to ~300 KB each, and every worker requests the full set on nearly every
   * test. Four workers saturate it badly enough that `client:visible` hydration — which has to
   * wait behind those requests for its module transform — stops completing inside any sane
   * timeout. The symptom was assertions failing in a different spec on every run, which reads
   * like a product defect and isn't one.
   *
   * Two workers keeps the suite honest and roughly as fast, because the previous four spent
   * most of their time queued behind each other anyway.
   */
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'github' : [['list']],

  /*
   * 10s, up from Playwright's 5s default.
   *
   * These specs run against `astro dev`, which transforms modules on demand, and the home
   * page pulls nine stock photographs at up to ~300 KB each. Four parallel workers hitting
   * one dev server is enough to push first paint past 5s on a cold cache, which surfaced as
   * assertions failing in different specs on every run — the signature of contention, not of
   * a defect. Raising the ceiling is the honest fix: nothing here is asserting that the site
   * is FAST (that's Lighthouse's job, on a built bundle), only that it is CORRECT.
   */
  expect: { timeout: 10_000 },

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
