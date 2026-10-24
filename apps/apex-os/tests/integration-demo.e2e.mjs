// Real API/PostgreSQL demo captures. All names, notes and imagery are synthetic.
// Use a dedicated empty loopback database whose name includes "visual"; never the CI database.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import { SignJWT } from '../../gate-api/node_modules/jose/dist/webapi/index.js';
import { PostgresDatabase, applyOperationalMigrations } from '../../../packages/database/dist/index.js';
import { seedDemoProject, DEMO_USER_ID, DEMO_JOB_ID, DEMO_CUSTOMER_NAME } from '../../../packages/gate-service/dist/demoSeed.js';
import { LocalEvidenceStorage, S3EvidenceStorage } from '../../../packages/storage/dist/index.js';
import { civilDay } from '../../../packages/contracts/dist/index.js';

const url = new URL(process.env.DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '55432' && url.pathname.includes('visual'), 'Use a dedicated loopback:55432 visual database');
const directory = process.env.APEX_DEMO_SCREENSHOTS ?? '/tmp/apex2/final-demo';
mkdirSync(directory, { recursive: true });
const origin = 'http://127.0.0.1:4200';
const secret = 'integration-visual-synthetic-secret-long-enough';
const db = PostgresDatabase.create({ url: url.href, applicationName: 'apex2-visual-demo' });
const storage = process.env.S3_ENDPOINT
  ? new S3EvidenceStorage({ endpoint: process.env.S3_ENDPOINT, bucket: process.env.S3_BUCKET, accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY, region: process.env.S3_REGION ?? 'us-east-1' })
  : new LocalEvidenceStorage('/tmp/apex2/visual-storage');
await db.withMigrationLock(client => applyOperationalMigrations(client));
await seedDemoProject(db, storage);
// The inherited canonical demo predates division metadata. Supply its real
// synthetic pool division before initializing the workspace; no release is fabricated.
await db.query(`update leads set accepted_payload = accepted_payload || '{"vertical":"Designer Pools"}'::jsonb where lead_id=(select lead_id from jobs where job_id=$1)`, [DEMO_JOB_ID]);
await db.close();
const server = spawn(process.execPath, ['apps/gate-api/dist/main.js'], {
  cwd: process.cwd(), env: { ...process.env, PORT: '4200', HOST: '127.0.0.1', GATE_JWT_SECRET: secret, GATE_EVIDENCE_DIRECTORY: '/tmp/apex2/visual-storage', APEX_PUBLIC_ORIGIN: origin },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '', browser;
server.stdout.on('data', data => logs += data);
server.stderr.on('data', data => logs += data);
const captures = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(logs);
    try { if ((await fetch(origin + '/app/')).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert(ready, 'Visual API failed to start');
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(DEMO_USER_ID).setIssuer('apex-gate').setAudience('apex-gate-api').setExpirationTime('30m').sign(new TextEncoder().encode(secret));
  async function api(path, body, key) {
    const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key ?? crypto.randomUUID() }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    assert(response.ok, JSON.stringify({ path, status: response.status, data }));
    return data;
  }
  const day = civilDay();
  await api(`/api/jobs/${DEMO_JOB_ID}/project`, {}, 'visual-project-init-v1');
  for (const [index, title] of ['Confirm plumbing walkthrough', 'Review equipment delivery'].entries()) {
    await api('/api/tasks', { title, detail: 'Synthetic demo task', jobId: DEMO_JOB_ID, assignedUserId: DEMO_USER_ID, dueDate: day, priority: index ? 'normal' : 'high', milestone: null, recurrence: 'none' }, `visual-task-${index}-${day}`);
  }
  await api('/api/calendar-events', { title: 'Plumbing walkthrough', note: 'Synthetic demo appointment', jobId: DEMO_JOB_ID, assignedUserId: DEMO_USER_ID, eventType: 'meeting', allDay: true, startsOn: day, endsOn: day, startsAt: null, endsAt: null, timezone: 'America/Chicago' }, `visual-event-${day}`);
  await api(`/api/jobs/${DEMO_JOB_ID}/photos`, { mimeType: 'image/jpeg', contentBase64: readFileSync('packages/gate-service/assets/demo-pool-excavation.jpg').toString('base64'), caption: 'Synthetic demo illustration · optional field documentation', stage: 'Excavation', category: 'during' }, 'visual-optional-photo-v1');
  browser = await chromium.launch({ headless: true });
  for (const mobile of [false, true]) {
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    await context.addInitScript(t => localStorage.setItem('apex-gate-token', t), token);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const press = async locator => mobile ? locator.tap() : locator.click();
    async function capture(name) {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(el => el.offsetParent !== null && /Loading/.test(el.textContent)));
      if (!name.startsWith('today-') && !name.startsWith('photos-')) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => window.scrollY === 0);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': no horizontal overflow');
      assert.equal(await page.getByText('The Apex API returned data this build does not understand.', { exact: false }).count(), 0);
      await page.screenshot({ path: `${directory}/${name}.png`, fullPage: false });
      captures.push({ name, viewport, fullPage: false, data: 'Synthetic persisted demo, real API/PostgreSQL and protected image storage', touch: mobile });
    }
    await page.goto(origin + `/app/today?project=${DEMO_JOB_ID}`);
    await page.locator('.selected-project').getByRole('heading', { name: DEMO_CUSTOMER_NAME, exact: true }).waitFor();
    await page.locator('.workspace-checklist').getByRole('heading', { name: 'Confirm plumbing walkthrough', exact: true }).waitFor();
    await page.locator('.workspace-center .cw-entry').filter({ hasText: 'Plumbing walkthrough' }).first().waitFor();
    if (mobile) {
      const greeting = await page.locator('.workspace-greeting').boundingBox();
      assert(greeting.y >= 0 && greeting.y < 150, 'Selected mobile Today starts at daily summary');
    }
    await capture(`today-${viewport.width}`);
    await press(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Checklist', exact: true }));
    await page.locator('h1').getByText('Checklist', {exact:true}).waitFor();
    await page.getByRole('heading', { name: 'Confirm plumbing walkthrough', exact: true }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(`checklist-${viewport.width}`);
    await press(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Calendar', exact: true }));
    await page.locator('.cw-entry').filter({ hasText: 'Plumbing walkthrough' }).first().waitFor();
    if (!mobile) await press(page.getByRole('button', { name: 'Agenda', exact: true }));
    if (mobile) {
      const appointment = await page.locator('.cw-entry').first().boundingBox();
      const quick = await page.getByRole('button', { name: 'Open quick actions' }).boundingBox();
      assert(appointment.y + appointment.height < quick.y, 'Real mobile appointment is visible above actions');
    }
    await capture(`calendar-${viewport.width}`);
    await press(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Jobs', exact: true }));
    await page.getByRole('link', { name: `Open ${DEMO_CUSTOMER_NAME}`, exact: true }).waitFor();
    await capture(`jobs-${viewport.width}`);
    await press(page.getByRole('link', { name: `Open ${DEMO_CUSTOMER_NAME}`, exact: true }));
    await page.locator('.selected-project').getByRole('heading', { name: DEMO_CUSTOMER_NAME, exact: true }).waitFor();
    await capture(`project-${viewport.width}`);
    await press(page.locator('.selected-project').getByRole('button', { name: 'Photos', exact: true }));
    await page.locator('.photo-card').getByText('Optional jobsite photo', { exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.photo-open img')].length > 0 && [...document.querySelectorAll('.photo-open img')].every(img => img.complete && img.naturalWidth > 0));
    await page.getByLabel('Filter stage', {exact:true}).selectOption('Excavation');
    await page.locator('.photo-gallery-controls').evaluate(el => el.scrollIntoView({block:'start'}));
    await capture(`photos-${viewport.width}`);
    await press(page.getByRole('button', { name: 'Open photo 1', exact: true }));
    await page.getByRole('dialog', { name: 'Photo viewer' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Photo viewer' }).waitFor({ state: 'hidden' });
    assert(await page.getByRole('button', { name: 'Open photo 1', exact: true }).evaluate(el => el === document.activeElement), 'Lazy viewer Escape restores focus');
    assert.deepEqual(errors, []);
    await context.close();
  }
  writeFileSync(`${directory}/captures.json`, JSON.stringify({ synthetic: true, database: url.pathname.slice(1), storage: process.env.S3_ENDPOINT ? 'Local Moto, S3 adapter' : 'Local evidence adapter', capturedAt: new Date().toISOString(), captures, skipped: 0, limits: ['Chromium touch emulation; no physical camera or Safari acceptance', 'Bundled CC0 geometric illustration, not a customer photograph'] }, null, 2) + '\n');
  console.log(`PASS ${captures.length} real persisted synthetic viewport captures; desktop + touch mobile; lazy viewer Escape/focus; 0 skipped`);
} finally {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
  writeFileSync(`${directory}/server.log`, logs);
}
