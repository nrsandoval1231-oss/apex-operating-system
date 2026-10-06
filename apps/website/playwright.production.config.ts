import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// A production-mode UI with an intercepted, reserved-domain endpoint. No live intake.
// Explicit empty analytics vars override inherited shell/.env values so synthetic
// production-intake tests can never emit real tracking or conversion events.
export default defineConfig({
  ...base,
  testDir: './tests-production',
  use: { ...base.use, baseURL: 'http://localhost:4330' },
  webServer: {
    command: 'npm run dev -- --port 4330',
    url: 'http://localhost:4330',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PUBLIC_ENV: 'production',
      ASTRO_DEV_TOOLBAR: 'false',
      PUBLIC_LEAD_WEBHOOK_URL: 'https://lead-webhook.example/webhook/apex-lead-intake',
      PUBLIC_GTM_ID: '',
      PUBLIC_GA4_MEASUREMENT_ID: '',
      PUBLIC_META_PIXEL_ID: '',
    },
  },
});
