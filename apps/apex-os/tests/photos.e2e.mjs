// Real API + disposable PostgreSQL + configured S3 adapter (Moto), built application.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '../../../packages/database/node_modules/pg/lib/index.js';
import { SignJWT } from '../../gate-api/node_modules/jose/dist/webapi/index.js';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import { createCanonicalId } from '../../../packages/contracts/dist/index.js';
assert(
  process.env.DATABASE_URL && process.env.S3_ENDPOINT,
  'Disposable PostgreSQL/Moto required',
);
const origin = 'http://127.0.0.1:4199',
  secret = 'photos-browser-synthetic-secret-long-enough';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const server = spawn(process.execPath, ['apps/gate-api/dist/main.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: '4199',
    HOST: '127.0.0.1',
    GATE_JWT_SECRET: secret,
    APEX_PUBLIC_ORIGIN: origin,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '',
  browser;
server.stdout.on('data', (d) => (logs += d));
server.stderr.on('data', (d) => (logs += d));
const checks = [],
  suffix = Date.now().toString();
mkdirSync('/tmp/apex2/screenshots', { recursive: true });
function note(name) {
  checks.push(name);
  console.log('PASS ' + name);
}
try {
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw Error(logs);
    try {
      if ((await fetch(origin + '/ready')).ok) break;
    } catch {}
    await delay(100);
  }
  const ids = {
    admin: createCanonicalId('user'),
    field: createCanonicalId('user'),
    other: createCanonicalId('user'),
  };
  for (const [role, id] of Object.entries(ids))
    await db.query(
      `insert into app_users(user_id,auth_user_id,role,display_name) values($1,gen_random_uuid(),$2,$3)`,
      [id, role === 'other' ? 'field' : role, `Photos ${role}`],
    );
  const tokens = {};
  for (const [role, id] of Object.entries(ids))
    tokens[role] = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(id)
      .setIssuer('apex-gate')
      .setAudience('apex-gate-api')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
  async function api(
    path,
    body,
    who = 'admin',
    key = crypto.randomUUID(),
    method,
  ) {
    const response = await fetch(origin + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        authorization: `Bearer ${tokens[who]}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    assert(
      response.ok,
      JSON.stringify({ path, status: response.status, data }),
    );
    return data;
  }
  const jobs = {},
    names = {};
  for (const label of ['mobile', 'desktop', 'other']) {
    const lead = createCanonicalId('lead'),
      job = createCanonicalId('job');
    jobs[label] = job;
    names[label] = `Photos ${label} ${suffix}`;
    await db.query(
      `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,$3::jsonb)`,
      [
        lead,
        crypto.randomUUID(),
        JSON.stringify({
          customerName: names[label],
          vertical: 'Designer Pools',
          address: 'Synthetic site',
        }),
      ],
    );
    await db.query(
      `insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`,
      [job, lead],
    );
  }
  browser = await chromium.launch({ headless: true });
  for (const mobile of [true, false]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    const press = async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      if (mobile) await locator.tap();
      else await locator.click();
    };
    const target = jobs[mobile ? 'mobile' : 'desktop'],
      name = names[mobile ? 'mobile' : 'desktop'];
    await page.goto(origin + '/app');
    await page.evaluate(
      (t) => localStorage.setItem('apex-gate-token', t),
      tokens.admin,
    );
    await page.goto(origin + '/app/projects?action=add-photos');
    await page.getByRole('region', { name: 'Choose a project' }).waitFor();
    // Main project cards must carry the action too, not only the chooser links.
    await press(page.getByRole('link', { name: `Open ${name}`, exact: true }));
    await page.getByLabel('Choose from library', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('action'), 'add-photos');
    assert.equal(
      await page.getByLabel('Stage (optional)', { exact: true }).inputValue(),
      '',
    );
    assert.equal(await page.getByLabel('Category (optional)').inputValue(), '');
    assert.equal(
      await page
        .getByLabel('Take photo', { exact: true })
        .getAttribute('capture'),
      'environment',
    );
    assert.equal(
      await page
        .getByLabel('Choose from library', { exact: true })
        .getAttribute('multiple'),
      '',
    );
    const data = await page.evaluate(() => {
      const make = (color, type, width) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, 24);
        return canvas.toDataURL(type, 0.85).split(',')[1];
      };
      return [
        make('#b88f52', 'image/png', 32),
        make('#383838', 'image/jpeg', 3000),
      ];
    });
    await page.screenshot({
      path: `/tmp/apex2/screenshots/photos-composer-${mobile ? 'mobile' : 'desktop'}.png`,
    });
    const files = [
      {
        name: 'site-before.png',
        mimeType: 'image/png',
        buffer: Buffer.from(data[0], 'base64'),
      },
      {
        name: 'site-wide.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(data[1], 'base64'),
      },
    ];
    const library = page.getByLabel('Choose from library', { exact: true });
    await library.setInputFiles(files);
    await page
      .getByRole('heading', { name: 'Pending on this device · 2' })
      .waitFor();
    const queued = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('apex-device-photo-queue', 1);
          req.onsuccess = () => {
            const db = req.result,
              tx = db.transaction('photos');
            const rows = tx.objectStore('photos').getAll();
            rows.onsuccess = () => resolve(rows.result);
            tx.oncomplete = () => db.close();
          };
          req.onerror = () => reject(req.error);
        }),
    );
    assert.equal(queued.length, 2);
    assert(
      queued.every(
        (row) =>
          row.ownerId === ids.admin &&
          row.jobId === target &&
          row.payload.caption === null &&
          row.payload.stage === null &&
          row.payload.category === null &&
          !('token' in row),
      ),
    );
    assert(!JSON.stringify(queued).includes(tokens.admin));
    await press(
      page.getByRole('button', { name: 'Upload pending photos', exact: true }),
    );
    await page.getByText('2 photos uploaded.', { exact: true }).waitFor();
    await page
      .getByText('2 confirmed photos · 2 shown', { exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole('region', { name: 'Device photo queue' }).count(),
      0,
    );
    const photos = await api(`/api/jobs/${target}/photos`);
    assert.equal(photos.length, 2);
    assert(
      photos.every(
        (p) => p.purpose === 'jobsite-photo' && p.originalCapturedAt === null,
      ),
    );
    // The 3000px input is optimized to 2048px and staff bytes carry only a header token.
    const dimensions = await page.evaluate(
      async (id) => {
        const token = localStorage.getItem('apex-gate-token'),
          res = await fetch('/api/evidence/' + id, {
            headers: { authorization: 'Bearer ' + token },
          });
        const bitmap = await createImageBitmap(await res.blob());
        return [bitmap.width, bitmap.height];
      },
      photos.find((p) => p.objectReference.endsWith('.jpg')).evidenceId,
    );
    assert.equal(dimensions[0], 2048);
    note(
      `${mobile ? 'touch mobile' : 'desktop'}: chooser intent, optional multi-upload, durable frozen payload, optimization and confirmed-only gallery`,
    );
    await press(
      page.getByRole('button', { name: 'Open photo 1', exact: true }),
    );
    await page.getByRole('dialog', { name: 'Photo viewer' }).waitFor();
    await press(page.getByRole('button', { name: 'Next photo', exact: true }));
    await page
      .getByRole('dialog')
      .getByText('2 of 2', { exact: true })
      .waitFor();
    if (mobile) {
      const cdp = await context.newCDPSession(page),
        box = await page.locator('.photo-viewer-stage').boundingBox();
      const y = Math.round(box.y + box.height / 2),
        start = Math.round(box.x + box.width * 0.8),
        end = Math.round(box.x + box.width * 0.2);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: start, y }],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: end, y }],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await page
        .getByRole('dialog')
        .getByText('1 of 2', { exact: true })
        .waitFor();
      await cdp.detach();
    } else {
      await page.keyboard.press('ArrowLeft');
      await page
        .getByRole('dialog')
        .getByText('1 of 2', { exact: true })
        .waitFor();
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(
      await page
        .getByRole('button', { name: 'Open photo 1', exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    note(
      `${mobile ? 'touch mobile' : 'desktop'}: accessible viewer next/previous, swipe or keyboard, Escape and focus return`,
    );
    await press(page.getByRole('button', { name: 'Add photos', exact: true })); // Collapse.
    await press(page.getByRole('button', { name: 'Open quick actions' }));
    await press(
      page
        .getByLabel('Quick actions', { exact: true })
        .getByRole('link', { name: 'Add Photos', exact: true }),
    );
    await page.getByLabel('Choose from library', { exact: true }).waitFor();
    await library.setInputFiles([files[0]]);
    await page
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await press(page.getByText('Optional details', { exact: true }));
    await page
      .getByLabel('Internal caption (optional)')
      .fill('Private site detail');
    await page
      .getByLabel('Stage (optional)', { exact: true })
      .fill('Excavation');
    await page.getByLabel('Category (optional)').selectOption('before');
    await page
      .getByRole('region', { name: 'Device photo queue' })
      .getByText('Excavation · before', { exact: true })
      .waitFor();
    let lostKey = '';
    await page.route(`**/api/jobs/${target}/photos`, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      lostKey = route.request().headers()['idempotency-key'];
      await route.fetch();
      await route.abort('connectionfailed');
    });
    await press(
      page.getByRole('button', { name: 'Upload pending photos', exact: true }),
    );
    await page
      .getByRole('alert')
      .filter({ hasText: 'Confirmation was not received' })
      .waitFor();
    assert.equal((await api(`/api/jobs/${target}/photos`)).length, 3);
    await page.unroute(`**/api/jobs/${target}/photos`);
    await page.reload();
    await page
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await press(page.getByText('Optional details', { exact: true }));
    await page
      .getByLabel('Internal caption (optional)')
      .fill('New form details must not change queued request');
    const retry = page.waitForRequest(
      (req) =>
        req.method() === 'POST' &&
        req.url().endsWith(`/api/jobs/${target}/photos`),
    );
    await press(page.getByRole('button', { name: 'Retry', exact: true }));
    const retryRequest = await retry;
    assert.equal(retryRequest.headers()['idempotency-key'], lostKey);
    assert.equal(retryRequest.postDataJSON().caption, 'Private site detail');
    assert.equal(retryRequest.postDataJSON().stage, 'Excavation');
    await page.getByText('1 photo uploaded.', { exact: true }).waitFor();
    assert.equal((await api(`/api/jobs/${target}/photos`)).length, 3);
    note(
      `${mobile ? 'touch mobile' : 'desktop'}: lost server acknowledgement, reload, same key/full metadata retry, exactly one row`,
    );
    await page.getByLabel('Filter stage').selectOption('Excavation');
    await page
      .getByText('3 confirmed photos · 1 shown', { exact: true })
      .waitFor();
    await page.getByLabel('Filter category').selectOption('before');
    const thumbnail = await page
      .getByRole('button', { name: 'Open photo 1', exact: true })
      .boundingBox();
    assert(
      thumbnail && thumbnail.width <= 360 && thumbnail.height <= 270,
      `Filtered thumbnail must stay bounded: ${JSON.stringify(thumbnail)}`,
    );

    await press(
      page.getByRole('button', { name: 'Share with customer', exact: true }),
    );
    assert.equal(
      await page.getByLabel('Customer caption (optional)').inputValue(),
      '',
    );
    await page
      .getByLabel('Customer caption (optional)')
      .fill('Customer progress only');
    await press(
      page.getByRole('button', { name: 'Publish photo', exact: true }),
    );
    await page
      .getByText('Published to customer · Customer progress only', {
        exact: true,
      })
      .waitFor();
    const link = await api(`/api/jobs/${target}/customer-link`, {}),
      customer = await context.newPage();
    await customer.goto(link.url);
    assert((await customer.content()).includes('Customer progress only'));
    assert(!(await customer.content()).includes('Private site detail'));
    assert.equal(
      (await customer.locator('.photo img, .photos img').count()) > 0 ||
        (await customer.locator('img').count()) > 0,
      true,
    );
    await customer.close();
    note(
      `${mobile ? 'touch mobile' : 'desktop'}: stage/category filtering and explicitly separate customer caption/publication`,
    );
    await press(page.getByRole('button', { name: 'Add photos', exact: true }));
    await page
      .locator('.photo-workspace')
      .evaluate((node) => node.scrollIntoView({ block: 'start' }));
    await page.screenshot({
      path: `/tmp/apex2/screenshots/photos-${mobile ? 'mobile' : 'desktop'}.png`,
    });
    await press(page.getByRole('button', { name: 'Add photos', exact: true }));

    await page.getByLabel('Filter stage').selectOption('');
    await page.getByLabel('Filter category').selectOption('');
    // Offline upload never claims success. A failed offline reload preserves IndexedDB.
    await library.setInputFiles([files[0]]);
    await page
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await context.setOffline(true);
    await press(
      page.getByRole('button', { name: 'Upload pending photos', exact: true }),
    );
    await page
      .getByRole('alert')
      .filter({ hasText: 'Confirmation was not received' })
      .waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await context.setOffline(false);
    await page.goto(
      origin + `/app/projects/${target}?action=add-photos&project=${target}`,
    );
    await page
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    const countBefore = (await api(`/api/jobs/${target}/photos`)).length;
    await press(page.getByRole('button', { name: 'Sign out', exact: true }));
    await page.getByLabel('Pilot access token').waitFor();
    await page.evaluate(
      (t) => localStorage.setItem('apex-gate-token', t),
      tokens.other,
    );
    await page.goto(
      origin + `/app/projects/${target}?action=add-photos&project=${target}`,
    );
    await page.getByLabel('Choose from library', { exact: true }).waitFor();
    assert.equal(
      await page.getByRole('region', { name: 'Device photo queue' }).count(),
      0,
    );
    assert.equal((await api(`/api/jobs/${target}/photos`)).length, countBefore);
    await page.evaluate(
      (t) => localStorage.setItem('apex-gate-token', t),
      tokens.admin,
    );
    await page.reload();
    await page
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await press(page.getByRole('button', { name: 'Retry', exact: true }));
    await page.getByText('1 photo uploaded.', { exact: true }).waitFor();
    note(
      `${mobile ? 'touch mobile' : 'desktop'}: offline failed reload, account isolation, same-owner recovery and retry`,
    );
    await library.setInputFiles({
      name: 'unsupported.heic',
      mimeType: 'image/heic',
      buffer: Buffer.from('heic'),
    });
    await page.getByRole('alert').filter({ hasText: 'Convert HEIC' }).waitFor();
    await library.setInputFiles({
      name: 'corrupt.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]),
    });
    await page.getByRole('alert').filter({ hasText: 'corrupt' }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    note(
      `${mobile ? 'touch mobile' : 'desktop'}: unsupported/corrupt input refusal and no horizontal overflow`,
    );
    // An uncertain saved upload remains visible after closure and resolves its original receipt.
    await library.setInputFiles([files[0]]);
    await page
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await page.route(`**/api/jobs/${target}/photos`, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fetch();
      await route.abort('connectionfailed');
    });
    await press(
      page.getByRole('button', { name: 'Upload pending photos', exact: true }),
    );
    await page
      .getByRole('alert')
      .filter({ hasText: 'Confirmation was not received' })
      .waitFor();
    await page.unroute(`**/api/jobs/${target}/photos`);
    await db.query(
      "update jobs set status='closed',closed_at=now(),closed_by=$2,reconciliation_complete=true where job_id=$1",
      [target, ids.admin],
    );
    await page.goto(
      origin + `/app/historical/${target}?action=add-photos&project=${target}`,
    );
    await page
      .getByText('Historical project · new uploads disabled.')
      .waitFor();
    assert.equal(
      await page.getByLabel('Choose from library', { exact: true }).count(),
      0,
    );
    await page
      .getByRole('heading', { name: 'Pending on this device · 1' })
      .waitFor();
    await press(
      page.getByRole('button', { name: 'Check upload receipt', exact: true }),
    );
    await page.getByText('1 photo uploaded.', { exact: true }).waitFor();
    assert.equal(await page.locator('.photo-card').count(), 5);
    assert.equal(
      await page.getByRole('region', { name: 'Device photo queue' }).count(),
      0,
    );
    await press(
      page.getByRole('button', { name: 'Open photo 1', exact: true }),
    );
    await page.getByRole('dialog').waitFor();
    await press(
      page.getByRole('button', { name: 'Close viewer', exact: true }),
    );
    note(
      `${mobile ? 'touch mobile' : 'desktop'}: retained historical gallery readable, frozen lost-ack receipt resolved after closure, new uploads/sharing disabled`,
    );
    await context.close();
  }
  // Browser inability to open IndexedDB must produce an honest non-durable fallback.
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.addInitScript(() =>
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw Error('blocked');
      },
    }),
  );
  await page.goto(origin + '/app');
  await page.evaluate(
    (t) => localStorage.setItem('apex-gate-token', t),
    tokens.admin,
  );
  await page.goto(origin + `/app/projects/${jobs.other}?action=add-photos`);
  await page
    .getByRole('alert')
    .filter({ hasText: 'Device recovery unavailable' })
    .waitFor();
  const fallbackBytes = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const fallbackFile = {
    name: 'device-only.png',
    mimeType: 'image/png',
    buffer: Buffer.from(fallbackBytes, 'base64'),
  };
  await page
    .getByLabel('Choose from library', { exact: true })
    .setInputFiles(fallbackFile);
  await page
    .getByRole('heading', { name: 'Pending on this device · 1' })
    .waitFor();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  assert.equal(
    await page.getByRole('region', { name: 'Device photo queue' }).count(),
    0,
  );
  await page
    .getByLabel('Choose from library', { exact: true })
    .setInputFiles(Array.from({ length: 11 }, () => fallbackFile));
  await page
    .getByRole('alert')
    .filter({ hasText: 'at most 10 photos' })
    .waitFor();
  assert.equal(
    await page.getByRole('region', { name: 'Device photo queue' }).count(),
    0,
  );
  await context.close();
  note(
    'IndexedDB unavailable explicitly reports recovery unavailable; device-only discard and queue count bound work',
  );
  writeFileSync(
    '/tmp/apex2/photos-browser.json',
    JSON.stringify({ result: 'pass', checks, jobs }, null, 2),
  );
} catch (error) {
  writeFileSync(
    '/tmp/apex2/photos-browser.json',
    JSON.stringify(
      {
        result: 'fail',
        error: String(error.stack ?? error),
        checks,
        logs: logs.slice(-5000),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await db.end();
  writeFileSync('/tmp/apex2/photos-browser-server.log', logs);
}
