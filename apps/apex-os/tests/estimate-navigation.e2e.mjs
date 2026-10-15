import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 4191;
const origin = `http://127.0.0.1:${port}`;
const vite = resolve(appRoot, 'node_modules/vite/bin/vite.js');
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: appRoot, stdio: 'inherit', windowsHide: true,
});
let browser;

const submission = {
  engineVersion: 'e2e', quantityModelVersion: 'e2e-v1', jobModel: {},
  quantities: [{ code: 'pool.water-volume', value: 1, unit: 'gal', calcId: 'e2e.volume' }],
  calcLedger: [{ id: 'e2e.volume', label: 'Volume', formula: 'V=1', inputs: [], value: 1, unit: 'gal' }],
  supersedeExisting: false,
};
const handoff = (leadId, fileName) => JSON.stringify({
  type: 'apex-estimate-handoff', leadId, fileName, submission,
});
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const waitForServer = async () => {
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    try { if ((await fetch(`${origin}/app/`)).ok) return; } catch { /* Vite is starting. */ }
    await delay(200);
  }
  throw new Error('Apex OS Vite server did not start within 30 seconds.');
};

const routeApi = async (page, { onFinish = async (route) => route.fulfill(json({})) } = {}) => {
  const finishRequests = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/today') return route.fulfill(json([]));
    if (url.pathname === '/api/me') return route.fulfill(json({ userId: 'test-user', displayName: 'E2E', role: 'admin' }));
    if (url.pathname.endsWith('/finish-estimate') || url.pathname.endsWith('/draft')) {
      finishRequests.push(url.pathname);
      return onFinish(route);
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"test route not found"}' });
  });
  return finishRequests;
};

const moveClientSide = async (page, leadId) => page.evaluate((id) => {
  window.history.pushState({}, '', `/app/opportunities/${id}/estimate`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, leadId);

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  // An unrecorded fee must stop at the UI boundary before any pricing request.
  {
    const page = await browser.newPage();
    page.on('pageerror', (error) => console.error('browser page error:', error.message));
    const finishes = await routeApi(page);
    await page.addInitScript((value) => { window.name = value; }, handoff('lead_A', 'A takeoff.json'));
    await page.goto(`${origin}/app/opportunities/lead_A/estimate`);
    await page.getByText('A takeoff.json').waitFor();
    await page.getByRole('button', { name: 'Finish estimate' }).click();
    await page.getByRole('alert').getByText(/enter the approved fee/i).waitFor();
    assert.deepEqual(finishes, [], 'blank fee triggered a pricing or draft request');
    await page.close();
  }

  // Route reuse clears A's state with either no B handoff or B's own handoff.
  {
    const page = await browser.newPage();
    await routeApi(page);
    await page.addInitScript((value) => { window.name = value; }, handoff('lead_A', 'A takeoff.json'));
    await page.goto(`${origin}/app/opportunities/lead_A/estimate`);
    await page.getByText('A takeoff.json').waitFor();
    await moveClientSide(page, 'lead_B');
    await page.getByText('Choose Designer export').waitFor();
    assert.equal(await page.locator('input[placeholder="Not recorded"]').inputValue(), '');
    await page.evaluate((value) => sessionStorage.setItem('apex-estimate-submission:lead_C', value), handoff('lead_C', 'C takeoff.json'));
    await moveClientSide(page, 'lead_C');
    await page.getByText('C takeoff.json').waitFor();
    await page.close();
  }

  // A delayed request from A cannot paint its error/result into B after navigation.
  {
    let release;
    const delayed = new Promise((resolveDelay) => { release = resolveDelay; });
    const page = await browser.newPage();
    const finishes = await routeApi(page, { onFinish: async (route) => {
      await delayed;
      await route.fulfill(json({ error: 'late response from A' }));
    } });
    await page.addInitScript((value) => { window.name = value; }, handoff('lead_A', 'A takeoff.json'));
    await page.goto(`${origin}/app/opportunities/lead_A/estimate`);
    await page.getByText('A takeoff.json').waitFor();
    await page.locator('input[placeholder="Not recorded"]').fill('0');
    const request = page.waitForRequest((item) => item.url().includes('/api/opportunities/lead_A/finish-estimate'));
    await page.getByRole('button', { name: 'Finish estimate' }).click();
    await request;
    await page.evaluate((value) => sessionStorage.setItem('apex-estimate-submission:lead_B', value), handoff('lead_B', 'B takeoff.json'));
    await moveClientSide(page, 'lead_B');
    await page.getByText('B takeoff.json').waitFor();
    release();
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('alert').count(), 0, 'late response from A changed B state');
    assert.deepEqual(finishes, ['/api/opportunities/lead_A/finish-estimate']);
    await page.close();
  }

  // A slow File.text() from A is also isolated from B after navigation.
  {
    const page = await browser.newPage();
    await routeApi(page);
    await page.addInitScript(() => {
      const original = File.prototype.text;
      File.prototype.text = function () {
        if (this.name !== 'slow-A.json') return original.call(this);
        return new Promise((resolveText) => { window.resolveSlowAFile = resolveText; });
      };
    });
    await page.goto(`${origin}/app/opportunities/lead_A/estimate`);
    await page.locator('input[type="file"]').setInputFiles({ name: 'slow-A.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(submission)) });
    await page.evaluate((value) => sessionStorage.setItem('apex-estimate-submission:lead_B', value), handoff('lead_B', 'B takeoff.json'));
    await moveClientSide(page, 'lead_B');
    await page.getByText('B takeoff.json').waitFor();
    await page.evaluate((value) => window.resolveSlowAFile(value), JSON.stringify(submission));
    await page.waitForTimeout(100);
    await page.getByText('B takeoff.json').waitFor();
    assert.equal(await page.getByRole('alert').count(), 0, 'late file read from A changed B state');
    await page.close();
  }

  console.log('PASS: fee omission, reused route identity, missing/present handoffs, and delayed A request/file isolation');
} finally {
  await browser?.close();
  server.kill();
  if (process.platform === 'win32') {
    // node's kill targets the Vite process directly; a short wait lets it release the port.
    await delay(250);
  }
}
