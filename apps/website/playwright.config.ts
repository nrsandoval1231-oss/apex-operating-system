import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4329);
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'github' : [['list']],
  expect: { timeout: 10_000 },
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run dev -- --ignore-lock --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PUBLIC_ENV: 'development', ASTRO_DEV_TOOLBAR: 'false',
      PUBLIC_LEAD_WEBHOOK_URL_TEST: 'https://lead-webhook.example/api/public/v1/leads',
      CODEX_THREAD_ID: '', CLAUDECODE: '', CURSOR_TRACE_ID: '', GEMINI_CLI: '',
    },
  },
});
