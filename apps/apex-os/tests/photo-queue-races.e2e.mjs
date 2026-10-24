// Real composer/store and native IndexedDB. Only HTTP upload responses are controlled.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(
  realpathSync(resolve(app, 'node_modules/vite/package.json')),
);
const { build } = require('esbuild');
const temporary = mkdtempSync(resolve(tmpdir(), 'apex-photo-queue-'));
const bundle = resolve(temporary, 'bundle.js');
await build({
  stdin: {
    contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {MemoryRouter} from 'react-router';
      import Composer from './src/photos/PhotoComposer.tsx';
      import * as queueStore from './src/photos/queueStore.ts';
      window.queueStore = queueStore;
      createRoot(document.getElementById('root')).render(
        <MemoryRouter initialEntries={['/?action=add-photos']}>
          <Composer ownerId="queue-owner" jobId="queue-job" readOnly={false}/>
        </MemoryRouter>);`,
    resolveDir: app,
    loader: 'tsx',
  },
  bundle: true,
  jsx: 'automatic',
  outfile: bundle,
  define: { 'process.env.NODE_ENV': '"production"' },
});
const server = createServer((request, response) => {
  response.setHeader(
    'content-type',
    request.url === '/bundle.js' ? 'text/javascript' : 'text/html',
  );
  response.end(
    request.url === '/bundle.js'
      ? readFileSync(bundle)
      : '<div id="root"></div><script>localStorage.setItem("apex-gate-token","synthetic-queue-token")</script><script src="/bundle.js"></script>',
  );
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const checks = [];
const errors = [];
const receipt = {
  evidenceId: 'evidence_11111111111111111111111111',
  gateTitle: null,
  requirementKey: null,
  capturedAt: '2026-10-24T09:00:00.000Z',
  internalCaption: null,
  customerVisible: false,
  customerCaption: null,
  visibilitySetAt: null,
  visibilitySetByName: null,
};
async function pageIn(context) {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(origin);
  await page.getByLabel('Choose from library', { exact: true }).waitFor();
  return page;
}
async function selectPhoto(page) {
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    return canvas.toDataURL().split(',')[1];
  });
  await page
    .getByLabel('Choose from library', { exact: true })
    .setInputFiles({
      name: 'queue.png',
      mimeType: 'image/png',
      buffer: Buffer.from(bytes, 'base64'),
    });
  await page
    .getByRole('heading', { name: 'Pending on this device · 1' })
    .waitFor();
}
async function edit(page, label, value) {
  if (
    !(await page
      .locator('.photo-optional-details')
      .evaluate((node) => node.open))
  ) {
    await page.getByText('Optional details', { exact: true }).click();
  }
  await page.getByLabel(label).fill(value);
  await page
    .getByText('Saving optional details…', { exact: true })
    .waitFor({ state: 'detached' });
}
async function holdNextSave(page) {
  await page.evaluate(() => {
    const original = IDBFactory.prototype.open;
    let hold = true;
    IDBFactory.prototype.open = function (...args) {
      const request = original.apply(this, args);
      if (hold) {
        hold = false;
        Object.defineProperty(request, 'onsuccess', {
          set(callback) {
            request.addEventListener('success', (event) => {
              window.releaseSave = () => callback.call(request, event);
            });
          },
        });
      }
      return request;
    };
  });
}
async function startDelayedEdit(page, value) {
  await page.getByText('Optional details', { exact: true }).click();
  await holdNextSave(page);
  await page.getByLabel('Internal caption (optional)').fill(value);
  await page.getByText('Saving optional details…', { exact: true }).waitFor();
  await page.waitForFunction(() => typeof window.releaseSave === 'function');
}
async function releaseSave(page) {
  await page.evaluate(() => window.releaseSave());
  await page
    .getByText('Saving optional details…', { exact: true })
    .waitFor({ state: 'detached' });
}
async function emptyAfterReload(page) {
  await page.reload();
  await page.getByLabel('Choose from library', { exact: true }).waitFor();
  await page
    .getByText('Recovering device queue…', { exact: true })
    .waitFor({ state: 'detached' });
  assert.equal(
    await page.getByRole('region', { name: 'Device photo queue' }).count(),
    0,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      window.queueStore.readQueue('queue-owner', 'queue-job'),
    ),
    [],
  );
}
function passed(check) {
  checks.push(check);
  console.log('PASS ' + check);
}
try {
  {
    const context = await browser.newContext(),
      page = await pageIn(context);
    await selectPhoto(page);
    await startDelayedEdit(page, 'Edited then discarded');
    assert.equal(
      await page
        .getByRole('button', { name: 'Discard', exact: true })
        .isEnabled(),
      true,
    );
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await page
      .getByRole('region', { name: 'Device photo queue' })
      .waitFor({ state: 'detached' });
    await releaseSave(page);
    await emptyAfterReload(page);
    passed(
      'delayed metadata save cannot resurrect discarded bytes or UI after reload',
    );
    await context.close();
  }
  {
    const context = await browser.newContext(),
      first = await pageIn(context);
    await selectPhoto(first);
    await edit(first, 'Internal caption (optional)', 'Original frozen caption');
    const stale = await pageIn(context);
    await stale
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await edit(first, 'Stage (optional)', 'Newest shared stage');
    const sent = [];
    await stale.route('**/api/jobs/queue-job/photos', async (route) => {
      sent.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postDataJSON(),
      });
      await route.abort('connectionfailed');
    });
    await stale.getByRole('button', { name: 'Upload', exact: true }).click();
    await stale
      .getByRole('alert')
      .filter({ hasText: 'Confirmation was not received' })
      .waitFor();
    assert.equal(
      sent[0].body.stage,
      'Newest shared stage',
      'first attempt must freeze the current durable row, not stale tab state',
    );
    await edit(
      first,
      'Internal caption (optional)',
      'Stale tab must not replace frozen caption',
    );
    await first.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await first
      .getByRole('region', { name: 'Device photo queue' })
      .getByText('Original frozen caption', { exact: true })
      .waitFor();
    await stale.reload();
    await stale.getByRole('button', { name: 'Retry', exact: true }).click();
    await stale
      .getByRole('alert')
      .filter({ hasText: 'Confirmation was not received' })
      .waitFor();
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[1], sent[0]);
    const rows = await stale.evaluate(() =>
      window.queueStore.readQueue('queue-owner', 'queue-job'),
    );
    assert.equal(rows[0].attempted, true);
    assert.deepEqual(rows[0].payload, sent[0].body);
    passed(
      'two tabs freeze authoritative metadata; stale edit and lost-response reload preserve exact key and payload',
    );
    await context.close();
  }
  {
    const context = await browser.newContext(),
      first = await pageIn(context);
    await selectPhoto(first);
    const stale = await pageIn(context);
    await stale
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await startDelayedEdit(stale, 'Delayed edit after server confirmation');
    await first.route('**/api/jobs/queue-job/photos', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(receipt),
      }),
    );
    await first.getByRole('button', { name: 'Upload', exact: true }).click();
    await first.getByText('1 photo uploaded.', { exact: true }).waitFor();
    await releaseSave(stale);
    await stale
      .getByRole('region', { name: 'Device photo queue' })
      .waitFor({ state: 'detached' });
    await emptyAfterReload(stale);
    passed(
      'delayed save in another tab cannot resurrect confirmed-and-cleared bytes',
    );
    await context.close();
  }
  {
    const context = await browser.newContext(),
      first = await pageIn(context);
    await selectPhoto(first);
    const stale = await pageIn(context);
    await stale
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await first.route('**/api/jobs/queue-job/photos', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(receipt),
      }),
    );
    await first.getByRole('button', { name: 'Upload', exact: true }).click();
    await first.getByText('1 photo uploaded.', { exact: true }).waitFor();
    let sends = 0;
    await stale.route('**/api/jobs/queue-job/photos', async (route) => {
      sends++;
      await route.abort();
    });
    await stale.getByRole('button', { name: 'Upload', exact: true }).click();
    await stale
      .getByText('This pending photo was already removed from the device.', {
        exact: true,
      })
      .waitFor();
    assert.equal(sends, 0);
    await emptyAfterReload(stale);
    passed(
      'stale upload after confirmation refuses missing durable row instead of falling back to cached bytes',
    );
    await context.close();
  }
  {
    const context = await browser.newContext(),
      first = await pageIn(context);
    await selectPhoto(first);
    const stale = await pageIn(context);
    await stale
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await stale.evaluate(() => {
      window.originalQueueOpen = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function () {
        throw Error('Device storage temporarily unavailable');
      };
    });
    let sends = 0;
    await stale.route('**/api/jobs/queue-job/photos', async (route) => {
      sends++;
      await route.abort();
    });
    await stale.getByRole('button', { name: 'Upload', exact: true }).click();
    await stale
      .getByRole('alert')
      .filter({ hasText: 'Device storage temporarily unavailable' })
      .waitFor();
    assert.equal(sends, 0);
    await first.getByRole('button', { name: 'Discard', exact: true }).click();
    await first
      .getByRole('region', { name: 'Device photo queue' })
      .waitFor({ state: 'detached' });
    await stale.evaluate(() => {
      IDBFactory.prototype.open = window.originalQueueOpen;
    });
    await stale.getByRole('button', { name: 'Upload', exact: true }).click();
    await stale
      .getByText('This pending photo was already removed from the device.', {
        exact: true,
      })
      .waitFor();
    assert.equal(sends, 0);
    await emptyAfterReload(stale);
    passed(
      'failed durable lookup refuses cached sending; recovery still honors another tab discard',
    );
    await context.close();
  }
  {
    const context = await browser.newContext(),
      page = await pageIn(context);
    await selectPhoto(page);
    const result = await page.evaluate(async () => {
      const api = window.queueStore,
        row = (await api.readQueue('queue-owner', 'queue-job'))[0];
      const wrong = { ...row, ownerId: 'another-owner' };
      const refused = await Promise.allSettled([
        api.updateQueuedPhoto(wrong, 'caption', 'not allowed'),
        api.freezeQueuedPhoto(wrong),
        api.deleteQueuedPhoto(wrong),
      ]);
      const admissions = await Promise.allSettled(
        Array.from({ length: 11 }, () =>
          api.addQueuedPhoto({
            ...row,
            id: crypto.randomUUID(),
            jobId: 'capacity-job',
          }),
        ),
      );
      await api.addQueuedPhoto({
        ...row,
        id: crypto.randomUUID(),
        jobId: 'byte-capacity-job',
        byteSize: api.MAX_QUEUE_BYTES,
      });
      const bytes = await Promise.allSettled([
        api.addQueuedPhoto({
          ...row,
          id: crypto.randomUUID(),
          jobId: 'byte-capacity-job',
          byteSize: 1,
        }),
      ]);
      return {
        refused: refused.map((r) => r.status),
        admissions: admissions.map((r) => r.status),
        bytes: bytes[0].status,
        original: await api.readQueue('queue-owner', 'queue-job'),
      };
    });
    assert.deepEqual(result.refused, ['rejected', 'rejected', 'rejected']);
    assert.equal(
      result.admissions.filter((status) => status === 'fulfilled').length,
      10,
    );
    assert.equal(
      result.admissions.filter((status) => status === 'rejected').length,
      1,
    );
    assert.equal(result.bytes, 'rejected');
    assert.equal(result.original.length, 1);
    assert.equal(result.original[0].attempted, false);
    passed(
      'native transactions preserve owner/job scope and concurrent file/byte queue caps',
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${checks.length} native IndexedDB race groups; 0 skipped; no browser page errors`,
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
  rmSync(temporary, { recursive: true, force: true });
}
