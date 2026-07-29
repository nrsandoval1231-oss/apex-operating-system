import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Canonical domain (`site`) is BLOCKED on D-03 — the maintainer picks which of the
// three domains is canonical. It only affects absolute URLs (sitemap, canonical/OG
// tags) in Phase 4; every internal link in Phases 1–2 is relative so this can be set
// late without a rebuild. Read from env so it can be swapped without touching config.
// TODO(BLOCKED: D-03): confirm the canonical domain before Phase 4/5 launch.
const site = process.env.PUBLIC_SITE_URL || 'https://apexgetsitdone.com';

export default defineConfig({
  site,
  // Zero client JS by default; the only island is the Phase 3 quote form (client:visible).
  integrations: [react()],
  // The dev toolbar injects its own DOM into every dev page — including an <h1>Audit</h1> that
  // collides with "exactly one <h1>" style assertions and shows up in element scans. Harmless
  // in a browser, actively misleading in a test run, so the Playwright web server switches it
  // off via this env var. Normal `npm run dev` keeps the toolbar.
  devToolbar: { enabled: process.env.ASTRO_DEV_TOOLBAR !== 'false' },
  build: {
    inlineStylesheets: 'auto',
  },
});
