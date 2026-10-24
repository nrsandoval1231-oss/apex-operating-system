// Synthetic-only real PostgreSQL/API/browser acceptance. Requires build and DATABASE_URL.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '../../../packages/database/node_modules/pg/lib/index.js';
import { SignJWT } from '../../gate-api/node_modules/jose/dist/webapi/index.js';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import { createCanonicalId } from '../../../packages/contracts/dist/index.js';
assert(
  process.env.DATABASE_URL,
  'Supply a disposable synthetic PostgreSQL DATABASE_URL',
);
const origin = 'http://127.0.0.1:4196';
const secret = 'checklist-browser-synthetic-secret-long-enough';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const server = spawn(process.execPath, ['apps/gate-api/dist/main.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: '4196',
    HOST: '127.0.0.1',
    GATE_JWT_SECRET: secret,
    GATE_EVIDENCE_DIRECTORY: '/tmp/apex2/checklist-browser-storage',
    APEX_PUBLIC_ORIGIN: origin,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
let browser;
const checks = [];
mkdirSync('/tmp/apex2/screenshots', { recursive: true });
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try {
      await fetch(origin + '/api/tasks');
      break;
    } catch {
      await delay(100);
    }
  }
  const user = createCanonicalId('user');
  await db.query(
    `insert into app_users(user_id,auth_user_id,role,display_name) values($1,gen_random_uuid(),'office','Checklist Browser')`,
    [user],
  );
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user)
    .setIssuer('apex-gate')
    .setAudience('apex-gate-api')
    .setExpirationTime('30m')
    .sign(new TextEncoder().encode(secret));
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 700, isMobile: viewport.width < 700 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      (t) => localStorage.setItem('apex-gate-token', t),
      token,
    );
    await page.goto(origin + '/app/checklist?action=add-task');
    // A cancelled composer must reopen through the same-route quick action.
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    if (viewport.width < 700) await page.getByRole('button', { name: 'Open quick actions' }).tap();
    else await page.getByRole('button', { name: 'Open quick actions' }).click();
    await page.getByRole('link', { name: 'Add Task', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).waitFor();
    const title = `Browser persisted ${viewport.width} ${Date.now()}`;
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Due date', { exact: true }).fill('2026-01-31');
    await page.getByLabel('Priority', { exact: true }).selectOption('urgent');
    if (viewport.width === 1440) {
      await page.route('**/api/tasks', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const response = await route.fetch();
        assert.equal(response.status(), 201);
        await route.abort('failed');
        await page.unroute('**/api/tasks');
      });
      await page
        .getByRole('button', { name: 'Save task', exact: true })
        .click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Could not reach' })
        .waitFor();
    }
    if (viewport.width < 700) await page.getByRole('button', { name: 'Save task', exact: true }).tap();
    else await page.getByRole('button', { name: 'Save task', exact: true }).click();
    const row = () =>
      page.locator('.task-row').filter({
        has: page.getByRole('heading', { name: title, exact: true }),
      });
    await row().waitFor();
    assert.equal(
      (
        await db.query(
          `select count(*) from tasks where snapshot->>'title'=$1`,
          [title],
        )
      ).rows[0].count,
      '1',
      'lost acknowledgement retry creates one task',
    );
    await page.reload();
    await row().waitFor();
    await row().getByRole('button', { name: 'Edit', exact: true }).click();
    const changed = title + ' edited';
    await page.getByLabel('Title', { exact: true }).fill(changed);
    await page
      .getByLabel('Detail', { exact: true })
      .fill('Persisted by real API');
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    const edited = () =>
      page.locator('.task-row').filter({
        has: page.getByRole('heading', { name: changed, exact: true }),
      });
    await edited().waitFor();
    await page.reload();
    await edited().waitFor();
    assert.match(await edited().innerText(), /Persisted by real API/);
    await page.getByRole('button', { name: 'Overdue', exact: true }).click();
    await edited().waitFor();
    await page.getByRole('button', { name: 'Upcoming', exact: true }).click();
    await edited().waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Assigned', exact: true }).click();
    await edited().waitFor();
    const box = await edited().getByRole('checkbox').boundingBox();
    assert(box.width >= 44 && box.height >= 44);
    if (viewport.width === 390) {
      await page.route('**/api/tasks/*/complete', async (route) => {
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.abort('failed');
        await page.unroute('**/api/tasks/*/complete');
      });
      await edited().getByRole('checkbox').click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Could not reach' })
        .waitFor();
      assert.equal(
        await edited().getByRole('checkbox').isChecked(),
        false,
        'completion waits for a successful saved response',
      );
    }
    await edited().getByRole('checkbox').click();
    await edited().waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await edited().waitFor();
    assert(await edited().getByRole('checkbox').isChecked());
    await page.reload();
    await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await edited().waitFor();
    await edited()
      .getByRole('button', { name: 'History', exact: true })
      .click();
    const history = page.getByRole('complementary', { name: 'Task history' });
    await history.waitFor();
    assert.match(await history.innerText(), /created/);
    assert.match(await history.innerText(), /edited/);
    assert.match(await history.innerText(), /completed/);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'no horizontal overflow',
    );
    const persisted = await db.query(
      `select snapshot from tasks where snapshot->>'title'=$1`,
      [changed],
    );
    assert.equal(persisted.rows.length, 1);
    assert(persisted.rows[0].snapshot.completedAt);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `/tmp/apex2/screenshots/checklist-${viewport.width}.png`,
      fullPage: true,
    });
    checks.push(
      `${viewport.width}px create/edit/complete/reload, overdue/upcoming/assigned/completed filters, append-only history, 44px checkbox, no overflow/runtime errors, persisted PostgreSQL row`,
    );
    await page.close();
  }
  const lead = createCanonicalId('lead'),
    job = createCanonicalId('job');
  await db.query(
    `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,$3::jsonb)`,
    [lead, job, JSON.stringify({ customerName: 'Checklist Browser Project' })],
  );
  await db.query(
    `insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`,
    [job, lead],
  );
  const delayed = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await delayed.addInitScript(
    (t) => localStorage.setItem('apex-gate-token', t),
    token,
  );
  await delayed.route('**/api/**', async (route) => {
    if (
      ['/api/me', '/api/jobs', '/api/task-assignees'].includes(
        new URL(route.request().url()).pathname,
      )
    )
      await delay(350);
    await route.continue();
  });
  await delayed.goto(`${origin}/app/checklist?action=add-task&project=${job}`);
  await delayed.getByLabel('Title', { exact: true }).waitFor();
  assert.equal(await delayed.locator('select[name="job"]').inputValue(), job);
  assert.equal(
    await delayed.locator('select[name="assignee"]').inputValue(),
    user,
  );
  const projectTitle = `Deep link project ${Date.now()}`;
  await delayed.getByLabel('Title', { exact: true }).fill(projectTitle);
  await delayed.getByRole('button', { name: 'Save task', exact: true }).click();
  await delayed
    .getByRole('heading', { name: projectTitle, exact: true })
    .waitFor();
  assert.equal(
    (
      await db.query(`select job_id from tasks where snapshot->>'title'=$1`, [
        projectTitle,
      ])
    ).rows[0].job_id,
    job,
  );
  checks.push(
    'Delayed real API deep link defaults to current assignee and selected project; PostgreSQL association verified; desktop lost-create-ack retry creates exactly one row',
  );
  // Unavailable deep-link projects must remain explicit, never fall back to Personal.
  const unavailableTitle = `Unavailable project intent ${Date.now()}`;
  const unavailableIds = [createCanonicalId('job')];
  for (const status of ['closed', 'cancelled']) {
    const unavailableLead = createCanonicalId('lead'),
      unavailableJob = createCanonicalId('job');
    await db.query(
      `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,'{}')`,
      [unavailableLead, unavailableJob],
    );
    await db.query(
      `insert into jobs(job_id,lead_id,signed_proposal_version,status,closed_at,closed_by,reconciliation_complete) values($1,$2,1,$3,now(),$4,true)`,
      [unavailableJob, unavailableLead, status, user],
    );
    unavailableIds.push(unavailableJob);
  }
  let unavailablePosts = 0;
  delayed.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/tasks')
      unavailablePosts++;
  });
  for (const unavailableJob of unavailableIds) {
    await delayed.goto(
      `${origin}/app/checklist?action=add-task&project=${unavailableJob}`,
    );
    await delayed.getByLabel('Title', { exact: true }).fill(unavailableTitle);
    assert.equal(
      await delayed.locator('select[name="job"]').inputValue(),
      unavailableJob,
    );
    await delayed
      .getByRole('button', { name: 'Save task', exact: true })
      .click();
    await delayed
      .getByRole('alert')
      .filter({ hasText: 'selected project is unavailable' })
      .waitFor();
    assert.equal(
      unavailablePosts,
      0,
      'unavailable intent must not issue a create request',
    );
    assert.equal(
      (
        await db.query(
          `select count(*) from tasks where snapshot->>'title'=$1`,
          [unavailableTitle],
        )
      ).rows[0].count,
      '0',
    );
  }
  await delayed.locator('select[name="job"]').selectOption('');
  await delayed.getByRole('button', { name: 'Save task', exact: true }).click();
  await delayed
    .getByLabel('Title', { exact: true })
    .waitFor({ state: 'hidden' });
  assert.equal(unavailablePosts, 1);
  assert.equal(
    (
      await db.query(`select job_id from tasks where snapshot->>'title'=$1`, [
        unavailableTitle,
      ])
    ).rows[0].job_id,
    null,
    'only an explicit Personal choice creates personal work',
  );
  checks.push(
    'Missing/closed/cancelled project intents refuse without any POST or stored task; explicit Personal choice persists personal task',
  );
  await delayed.close();
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await db.end();
  writeFileSync('/tmp/apex2/checklist-browser-server.log', serverLog);
}
