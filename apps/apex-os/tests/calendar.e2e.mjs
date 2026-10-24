// Synthetic-only real PostgreSQL/API/browser acceptance. Requires build and DATABASE_URL.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '../../../packages/database/node_modules/pg/lib/index.js';
import { SignJWT } from '../../gate-api/node_modules/jose/dist/webapi/index.js';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import {
  createCanonicalId,
  civilDay,
} from '../../../packages/contracts/dist/index.js';
assert(
  process.env.DATABASE_URL,
  'Supply a disposable synthetic PostgreSQL DATABASE_URL',
);
const origin = 'http://127.0.0.1:4197';
const secret = 'calendar-browser-synthetic-secret-long-enough';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const server = spawn(process.execPath, ['apps/gate-api/dist/main.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: '4197',
    HOST: '127.0.0.1',
    GATE_JWT_SECRET: secret,
    GATE_EVIDENCE_DIRECTORY: '/tmp/apex2/calendar-browser-storage',
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
    await page.goto(origin + '/app/calendar?action=schedule-event');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    if (viewport.width < 700) await page.getByRole('button', { name: 'Open quick actions' }).tap();
    else await page.getByRole('button', { name: 'Open quick actions' }).click();
    await page
      .getByRole('link', { name: 'Schedule Event', exact: true })
      .click();
    await page.getByLabel('Title', { exact: true }).waitFor();
    const dialog = () => page.getByRole('dialog');
    // Native dialog must trap focus and restore it when dismissed.
    await page.getByLabel('Title', { exact: true }).focus();
    await page.evaluate(() =>
      document.querySelector('.cw-views button').focus(),
    );
    assert(
      await page.evaluate(() => !!document.activeElement?.closest('dialog')),
      'modal blocks background focus',
    );
    const title = `Calendar persisted ${viewport.width} ${Date.now()}`;
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page
      .getByLabel('Note', { exact: true })
      .fill('Synthetic ordinary appointment');
    await page.locator('select[name=assignedUserId]').selectOption(user);
    if (viewport.width === 1440) {
      await page.route('**/api/calendar-events', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const response = await route.fetch();
        assert.equal(response.status(), 201);
        await route.abort('failed');
        await page.unroute('**/api/calendar-events');
      });
      await page
        .getByRole('button', { name: 'Save event', exact: true })
        .click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Could not reach' })
        .waitFor();
    }
    if (viewport.width < 700) await page.getByRole('button', { name: 'Save event', exact: true }).tap();
    else await page.getByRole('button', { name: 'Save event', exact: true }).click();
    const card = () =>
      page
        .locator('.cw-entry')
        .filter({ has: page.locator('strong', { hasText: title }) })
        .first();
    await card().waitFor();
    assert(!new URL(page.url()).searchParams.has('action'));
    await card().click();
    await dialog()
      .getByRole('button', { name: 'Edit event', exact: true })
      .click();
    const changed = title + ' edited';
    await page.getByLabel('Title', { exact: true }).fill(changed);
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await page
      .locator('.cw-entry strong')
      .getByText(changed, { exact: true })
      .first()
      .waitFor();
    await page.reload();
    await page
      .locator('.cw-entry strong')
      .getByText(changed, { exact: true })
      .first()
      .waitFor();
    assert.equal(
      await page
        .getByRole('button', {
          name: viewport.width === 390 ? 'Agenda' : 'Week',
          exact: true,
        })
        .getAttribute('aria-pressed'),
      'true',
    );
    for (const view of ['Agenda', 'Day', 'Week', 'Month']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.getByLabel(view + ' calendar', { exact: true }).waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${view} no page overflow`,
      );
    }
    await page.getByRole('button', { name: 'Agenda', exact: true }).click();
    await page
      .locator('.cw-entry')
      .filter({ hasText: changed })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'View history', exact: true })
      .click();
    await page.locator('.cw-history').waitFor();
    assert.match(await page.locator('.cw-history').innerText(), /revision 2/);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    const rows = await db.query(
      "select snapshot from calendar_events where snapshot->>'title'=$1",
      [changed],
    );
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].snapshot.revision, 2);
    assert.deepEqual(errors, []);
    const filters = page.getByRole('button', { name: /^Filters/ });
    if (viewport.width < 700) {
      assert.equal(await filters.getAttribute('aria-expanded'), 'false');
      await page.evaluate(() => window.scrollTo(0, 0));
      const first = await page.locator('.cw-entry').first().boundingBox();
      const quick = await page.getByRole('button', { name: 'Open quick actions' }).boundingBox();
      assert(first && quick && first.y + first.height < quick.y, 'First real appointment is visible above mobile actions');
      const target = await filters.boundingBox();
      assert(target.width >= 44 && target.height >= 44);
      await filters.tap();
    }
    await page.getByLabel('Team member', { exact: true }).selectOption(user);
    assert.equal(await filters.innerText(), 'Filters (1 active)');
    await filters.click();
    assert.equal(await filters.getAttribute('aria-expanded'), 'false');
    await page.locator('.cw-entry').filter({hasText: changed}).first().waitFor();
    // A collapsed filter remains active; reopening preserves its selection.
    if (viewport.width < 700) await filters.tap(); else await filters.click();
    assert.equal(await page.getByLabel('Team member', { exact: true }).inputValue(), user);
    await filters.click();
    checks.push(`${viewport.width}px labelled filter disclosure preserves active member filter; mobile touch and first appointment density`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/tmp/apex2/screenshots/calendar-${viewport.width}.png`,
      fullPage: false,
    });
    checks.push(
      `${viewport.width}px real create/edit/reload/history, repeated same-route quick action, all4 views, native modal focus trap, no overflow/runtime errors; ${viewport.width === 1440 ? 'lost acknowledgement retry creates one row' : 'Agenda default'}`,
    );
    await page.close();
  }
  const lead = createCanonicalId('lead'),
    job = createCanonicalId('job');
  await db.query(
    "insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,$3::jsonb)",
    [lead, job, JSON.stringify({ customerName: 'Calendar Browser Project' })],
  );
  await db.query(
    "insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')",
    [job, lead],
  );
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Los_Angeles',
  });
  await page.addInitScript(
    (t) => localStorage.setItem('apex-gate-token', t),
    token,
  );
  await page.route('**/api/**', async (route) => {
    if (
      ['/api/jobs', '/api/task-assignees'].includes(
        new URL(route.request().url()).pathname,
      )
    )
      await delay(400);
    await route.continue();
  });
  await page.goto(
    `${origin}/app/calendar?action=schedule-event&project=${job}`,
  );
  await page.getByLabel('Title', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Event project', { exact: true }).inputValue(),
    job,
  );
  const timedTitle = 'Timed browser ' + Date.now();
  await page.getByLabel('Title', { exact: true }).fill(timedTitle);
  await page.getByLabel('All day', { exact: true }).uncheck();
  const today = civilDay();
  await page.getByLabel('Starts at', { exact: true }).fill(today + 'T09:00');
  await page.getByLabel('Ends at', { exact: true }).fill(today + 'T10:00');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await page
    .locator('.cw-entry')
    .filter({ hasText: timedTitle })
    .first()
    .waitFor();
  const timed = (
    await db.query(
      "select snapshot from calendar_events where snapshot->>'title'=$1",
      [timedTitle],
    )
  ).rows[0].snapshot;
  assert.equal(timed.jobId, job);
  assert.equal(timed.timezone, 'America/Los_Angeles');
  assert.equal(new Date(timed.endsAt) - new Date(timed.startsAt), 3600000);
  await page.reload();
  await page
    .locator('.cw-entry')
    .filter({ hasText: timedTitle })
    .first()
    .click();
  assert.match(
    await page.getByRole('dialog').innerText(),
    /America\/Los_Angeles/,
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  checks.push(
    'Delayed API project defaults remain selected; timed local appointment serializes UTC + recorded zone, real PostgreSQL/reload/detail verified',
  );
  const bad = [createCanonicalId('job')];
  for (const status of ['closed', 'cancelled']) {
    const l = createCanonicalId('lead'),
      j = createCanonicalId('job');
    await db.query(
      "insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,'{}')",
      [l, j],
    );
    await db.query(
      'insert into jobs(job_id,lead_id,signed_proposal_version,status,closed_at,closed_by,reconciliation_complete) values($1,$2,1,$3,now(),$4,true)',
      [j, l, status, user],
    );
    bad.push(j);
  }
  const badTitle = 'Unavailable calendar ' + Date.now();
  let posts = 0;
  page.on('request', (r) => {
    if (
      r.method() === 'POST' &&
      new URL(r.url()).pathname === '/api/calendar-events'
    )
      posts++;
  });
  for (const id of bad) {
    await page.goto(
      `${origin}/app/calendar?action=schedule-event&project=${id}`,
    );
    await page.getByLabel('Title', { exact: true }).fill(badTitle);
    assert.equal(
      await page.getByLabel('Event project', { exact: true }).inputValue(),
      id,
    );
    assert(
      await page
        .getByRole('button', { name: 'Save event', exact: true })
        .isDisabled(),
    );
    await page
      .getByRole('alert')
      .filter({ hasText: 'selected project is unavailable' })
      .waitFor();
  }
  assert.equal(posts, 0);
  await page.getByLabel('Event project', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await page
    .locator('.cw-entry')
    .filter({ hasText: badTitle })
    .first()
    .waitFor();
  assert.equal(posts, 1);
  assert.equal(
    (
      await db.query(
        "select job_id from calendar_events where snapshot->>'title'=$1",
        [badTitle],
      )
    ).rows[0].job_id,
    null,
  );
  checks.push(
    'Missing/closed/cancelled deep-link context blocks create; explicit Personal choice alone persists personal event',
  );
  await page.close();
  const sub = createCanonicalId('sub'),
    visit = createCanonicalId('visit'),
    gunite = createCanonicalId('visit');
  await db.query(
    "insert into subcontractors(subcontractor_id,name,trade) values($1,'Browser synthetic crew','Calendar plumbing')",
    [sub],
  );
  const end = new Date(today + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 2);
  const ends = end.toISOString().slice(0, 10);
  await db.query(
    "insert into scheduled_visits(visit_id,job_id,subcontractor_id,phase_key,starts_on,ends_on,created_by) values($1,$2,$3,'rough-in',$4,$5,$6)",
    [visit, job, sub, today, ends, user],
  );
  const gsub = createCanonicalId('sub');
  await db.query(
    "insert into subcontractors(subcontractor_id,name,trade) values($1,'Browser gunite crew','Calendar gunite')",
    [gsub],
  );
  await db.query(
    "insert into scheduled_visits(visit_id,job_id,subcontractor_id,phase_key,starts_on,ends_on,created_by) values($1,$2,$3,'gunite',$4,$4,$5)",
    [gunite, job, gsub, today, user],
  );
  const operational = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await operational.addInitScript(
    (t) => localStorage.setItem('apex-gate-token', t),
    token,
  );
  await operational.goto(origin + '/app/calendar');
  await operational.getByLabel('Project', { exact: true }).selectOption(job);
  await operational
    .locator('.cw-entry')
    .filter({ hasText: 'Calendar gunite visit' })
    .first()
    .waitFor();
  assert.match(
    await operational
      .locator('.cw-entry')
      .filter({ hasText: 'Calendar gunite visit' })
      .first()
      .innerText(),
    /conflict/i,
  );
  await operational
    .locator('.cw-entry')
    .filter({ hasText: 'Calendar plumbing visit' })
    .first()
    .click();
  assert.equal(
    await operational.locator('input[name=start]').inputValue(),
    today,
  );
  assert.equal(await operational.locator('input[name=end]').inputValue(), ends);
  await operational.getByRole('button', { name: 'Close dialog' }).click();
  // A real drag carries the proposed start and inclusive duration into the reason dialog.
  const target = new Date(today + 'T12:00:00Z');
  const moveDelta = target.getUTCDay() === 0 ? 1 : -1;
  target.setUTCDate(target.getUTCDate() + moveDelta);
  const targetDay = target.toISOString().slice(0, 10);
  const dragSource = operational
    .locator('.cw-entry')
    .filter({ hasText: 'Calendar plumbing visit' })
    .first();
  await dragSource.scrollIntoViewIfNeeded();
  const sourceBox = await dragSource.boundingBox();
  const targetBox = await operational
    .locator('.cw-day')
    .filter({ has: operational.locator(`time[datetime="${targetDay}"]`) })
    .boundingBox();
  assert(sourceBox && targetBox);
  // Keep both pointer coordinates on the visible row. dragTo auto-scrolls the
  // full tall day column and can move a different stacked card under the mouse.
  const pointerY = sourceBox.y + Math.min(20, sourceBox.height / 2);
  await operational.mouse.move(sourceBox.x + 20, pointerY);
  await operational.mouse.down();
  await operational.mouse.move(sourceBox.x + 25, pointerY, { steps: 3 });
  await operational.mouse.move(targetBox.x + targetBox.width / 2, pointerY, {
    steps: 20,
  });
  await operational.mouse.up();
  assert.equal(
    await operational.locator('input[name=start]').inputValue(),
    targetDay,
  );
  const targetEnd = new Date(ends + 'T12:00:00Z');
  targetEnd.setUTCDate(targetEnd.getUTCDate() + moveDelta);
  assert.equal(
    await operational.locator('input[name=end]').inputValue(),
    targetEnd.toISOString().slice(0, 10),
    await operational.getByRole('dialog').innerText(),
  );
  await operational
    .locator('input[name=reason]')
    .fill('Synthetic multi-day move');
  await operational
    .getByRole('button', { name: 'Save move', exact: true })
    .click();
  await operational.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(
    (
      await db.query(
        'select ends_on::text from scheduled_visits where visit_id=$1',
        [visit],
      )
    ).rows[0].ends_on,
    targetEnd.toISOString().slice(0, 10),
  );
  await operational
    .locator('.cw-entry')
    .filter({ hasText: 'Calendar gunite visit' })
    .first()
    .click();
  await operational.locator('input[name=end]').fill(ends);
  await operational
    .locator('input[name=reason]')
    .fill('Invalid gunite duration');
  await operational
    .getByRole('button', { name: 'Save move', exact: true })
    .click();
  await operational
    .getByRole('alert')
    .filter({ hasText: /gunite|single.day/i })
    .waitFor();
  await operational.getByRole('button', { name: 'Close dialog' }).click();
  const field = createCanonicalId('user');
  await db.query(
    "insert into app_users(user_id,auth_user_id,role,display_name) values($1,gen_random_uuid(),'field','Calendar Field')",
    [field],
  );
  const fieldToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(field)
    .setIssuer('apex-gate')
    .setAudience('apex-gate-api')
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
  const refused = await fetch(origin + `/api/visits/${visit}/move`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${fieldToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      startsOn: today,
      endsOn: ends,
      reason: 'Field may not move crew',
    }),
  });
  assert.equal(refused.status, 403);
  assert.match(await refused.text(), /may not move/i);
  checks.push(
    'Existing operational conflict visible; real multi-day drag preserves inclusive span and reason/audit via visit API; gunite multi-day and field move refusals remain',
  );
  await operational.close();
  // Preserve the actual second repeated-hour instants during an ordinary note edit.
  const dstTitle = 'Second DST occurrence ' + Date.now();
  const dstBody = {
    title: dstTitle,
    note: null,
    jobId: null,
    eventType: 'meeting',
    assignedUserId: user,
    allDay: false,
    startsOn: null,
    endsOn: null,
    startsAt: '2026-11-01T07:30:15.125Z',
    endsAt: '2026-11-01T07:45:30.875Z',
    timezone: 'UTC',
  };
  const dstCreated = await fetch(origin + '/api/calendar-events', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(dstBody),
  });
  assert.equal(dstCreated.status, 201);
  const dstEvent = await dstCreated.json();
  const dstPage = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/Chicago',
  });
  await dstPage.addInitScript(
    (t) => localStorage.setItem('apex-gate-token', t),
    token,
  );
  await dstPage.goto(origin + '/app/calendar');
  await dstPage.getByRole('button', { name: 'Day', exact: true }).click();
  await dstPage.getByLabel('Calendar date', { exact: true }).fill('2026-11-01');
  await dstPage.locator('.cw-entry').filter({ hasText: dstTitle }).click();
  await dstPage
    .getByRole('button', { name: 'Edit event', exact: true })
    .click();
  assert.equal(
    await dstPage.getByLabel('Starts at', { exact: true }).inputValue(),
    '2026-11-01T01:30',
  );
  await dstPage
    .getByLabel('Note', { exact: true })
    .fill('Note edit preserves second occurrence and precision');
  await dstPage
    .getByRole('button', { name: 'Save event', exact: true })
    .click();
  await dstPage.getByRole('dialog').waitFor({ state: 'hidden' });
  const dstSaved = (
    await db.query(
      'select snapshot from calendar_events where calendar_event_id=$1',
      [dstEvent.eventId],
    )
  ).rows[0].snapshot;
  assert.equal(dstSaved.startsAt, dstBody.startsAt);
  assert.equal(dstSaved.endsAt, dstBody.endsAt);
  assert.equal(dstSaved.timezone, dstBody.timezone);
  assert.equal(dstSaved.revision, 2);
  await dstPage.locator('.cw-entry').filter({ hasText: dstTitle }).click();
  await dstPage
    .getByRole('button', { name: 'Edit event', exact: true })
    .click();
  await dstPage
    .getByLabel('Starts at', { exact: true })
    .fill('2026-11-01T01:35');
  let ambiguousPosts = 0;
  dstPage.on('request', (r) => {
    if (
      r.method() === 'POST' &&
      new URL(r.url()).pathname ===
        `/api/calendar-events/${dstEvent.eventId}/edit`
    )
      ambiguousPosts++;
  });
  await dstPage
    .getByRole('button', { name: 'Save event', exact: true })
    .click();
  await dstPage
    .getByRole('alert')
    .filter({ hasText: 'occurs twice' })
    .waitFor();
  assert.equal(ambiguousPosts, 0);
  assert.equal(
    (
      await db.query(
        'select snapshot from calendar_events where calendar_event_id=$1',
        [dstEvent.eventId],
      )
    ).rows[0].snapshot.revision,
    2,
  );
  checks.push(
    'Chicago second DST hour note-only edit preserves exact UTC seconds/milliseconds and recorded timezone; changed ambiguous local time rejected before any POST',
  );
  await dstPage.close();

  const tokyo = await browser.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Tokyo',
  });
  await tokyo.addInitScript(
    (t) => localStorage.setItem('apex-gate-token', t),
    token,
  );
  await tokyo.goto(origin + '/app/calendar');
  await tokyo.getByRole('button', { name: 'Day', exact: true }).click();
  await tokyo
    .getByRole('button', { name: 'Schedule event', exact: true })
    .click();
  const crossTitle = 'Tokyo local Chicago day ' + Date.now();
  await tokyo.getByLabel('Title', { exact: true }).fill(crossTitle);
  await tokyo.getByLabel('All day', { exact: true }).uncheck();
  await tokyo.getByLabel('Starts at', { exact: true }).fill('2026-10-25T12:30');
  await tokyo.getByLabel('Ends at', { exact: true }).fill('2026-10-25T13:30');
  await tokyo.getByRole('button', { name: 'Save event', exact: true }).click();
  await tokyo
    .locator('.cw-day')
    .filter({ has: tokyo.locator('time[datetime="2026-10-24"]') })
    .locator('.cw-entry')
    .filter({ hasText: crossTitle })
    .waitFor();
  assert.equal(
    await tokyo.getByLabel('Calendar date', { exact: true }).inputValue(),
    '2026-10-24',
  );
  await tokyo.getByRole('button', { name: 'Agenda', exact: true }).click();
  await tokyo.locator('.cw-entry').filter({ hasText: crossTitle }).waitFor();
  const crossSaved = (
    await db.query(
      "select snapshot from calendar_events where snapshot->>'title'=$1",
      [crossTitle],
    )
  ).rows[0].snapshot;
  assert.equal(crossSaved.startsAt, '2026-10-25T03:30:00.000Z');
  assert.equal(crossSaved.timezone, 'Asia/Tokyo');
  checks.push(
    'Tokyo local-date save navigates to Chicago business day and remains visible in Day and mobile Agenda while retaining recorded timezone',
  );
  await tokyo.close();
  const correctionPrefix = `Calendar correction ${Date.now()}`;
  const correctionJobs = {};
  for (const [label, vertical] of [
    ['pools', 'Designer Pools'],
    ['coating', 'Concrete Coating'],
  ]) {
    const leadId = createCanonicalId('lead');
    const projectId = createCanonicalId('job');
    correctionJobs[label] = projectId;
    await db.query(
      "insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,$3::jsonb)",
      [leadId, projectId, JSON.stringify({ customerName: `${correctionPrefix} ${label}`, vertical })],
    );
    await db.query(
      "insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')",
      [projectId, leadId],
    );
  }
  const createCorrectionEvent = async (label, jobId, assignedUserId = user, eventType = 'meeting', startsOn = today) => {
    const response = await fetch(origin + '/api/calendar-events', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        title: `${correctionPrefix} ${label}`,
        note: null,
        jobId,
        eventType,
        assignedUserId,
        allDay: true,
        startsOn,
        endsOn: startsOn,
        startsAt: null,
        endsAt: null,
        timezone: 'America/Chicago',
      }),
    });
    const event = await response.json();
    assert.equal(response.status, 201, JSON.stringify(event));
    return event;
  };
  await createCorrectionEvent('pool meeting', correctionJobs.pools);
  await createCorrectionEvent('pool crew', correctionJobs.pools, field, 'crew');
  await createCorrectionEvent('coating meeting', correctionJobs.coating);
  await createCorrectionEvent('unknown meeting', job);
  await createCorrectionEvent('personal meeting', null);
  const dayAfter = (offset) => {
    const date = new Date(today + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const skippedTitle = `${correctionPrefix} formerly skipped week`;
  await createCorrectionEvent('formerly skipped week', correctionJobs.pools, user, 'meeting', dayAfter(8));
  for (const width of [1440, 390]) {
    const correctionPage = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 700, isMobile: width < 700 });
    await correctionPage.addInitScript((value) => localStorage.setItem('apex-gate-token', value), token);
    await correctionPage.goto(origin + '/app/calendar');
    const disclosure = correctionPage.getByRole('button', { name: /^Filters/ });
    if (width < 700) await disclosure.click();
    await correctionPage.getByLabel('Division', { exact: true }).selectOption('Designer Pools');
    await correctionPage.getByRole('button', { name: 'Day', exact: true }).click();
    await correctionPage.getByLabel('Calendar date', { exact: true }).fill(today);
    const correctionCards = correctionPage.locator('.cw-days .cw-entry').filter({ hasText: correctionPrefix });
    assert.equal(await correctionCards.count(), 2);
    await correctionPage.getByLabel('Project', { exact: true }).selectOption(correctionJobs.pools);
    await correctionPage.getByLabel('Team member', { exact: true }).selectOption(user);
    await correctionPage.getByLabel('Event type', { exact: true }).selectOption('meeting');
    assert.equal(await disclosure.innerText(), 'Filters (4 active)');
    assert.equal(await correctionCards.count(), 1);
    assert.match(await correctionCards.first().innerText(), /pool meeting/);
    await correctionPage.getByLabel('Division', { exact: true }).selectOption('Concrete Coating');
    assert.equal(await correctionCards.count(), 0);
    await correctionPage.getByLabel('Project', { exact: true }).selectOption('');
    assert.equal(await correctionCards.count(), 1);
    assert.match(await correctionCards.first().innerText(), /coating meeting/);
    await correctionPage.getByLabel('Division', { exact: true }).selectOption('personal');
    assert.match(await correctionCards.first().innerText(), /personal meeting/);
    await correctionPage.getByLabel('Division', { exact: true }).selectOption('unknown');
    assert.match(await correctionCards.first().innerText(), /unknown meeting/);
    if (width === 1440) {
      await correctionPage.getByLabel('Division', { exact: true }).selectOption('Designer Pools');
      await correctionPage.route('**/api/workspace-projects', (route) =>
        route.fulfill({ status: 503, json: { error: 'Synthetic metadata outage' } }),
      );
      await correctionPage.evaluate(() => window.dispatchEvent(new Event('apex:data-changed')));
      await correctionPage.getByRole('alert').filter({ hasText: 'Divisions unavailable.' }).waitFor();
      assert(await correctionPage.getByLabel('Division', { exact: true }).isDisabled());
      await correctionPage.getByText('Division filtering is unavailable until divisions can be loaded.').waitFor();
      await correctionPage.unroute('**/api/workspace-projects');
      await correctionPage.getByRole('alert').filter({ hasText: 'Divisions unavailable.' }).getByRole('button', { name: 'Retry' }).click();
      await correctionPage.getByLabel('Division', { exact: true }).waitFor({ state: 'visible' });
      await correctionPage.locator('.cw-filters select[aria-label="Division"]:enabled').waitFor();
      assert.equal(await correctionCards.count(), 1);
      checks.push('Division metadata outage is explicit; filter disables and retry restores known divisions');
    }
    checks.push(`${width}px canonical division, personal/unknown and combined project/member/type filters`);
    await correctionPage.goto(origin + `/app/projects/${correctionJobs.pools}`);
    await correctionPage.getByRole('button', { name: 'Calendar', exact: true }).click();
    const compactDate = correctionPage.getByLabel('Calendar date', { exact: true });
    await compactDate.fill(today);
    await correctionPage.getByRole('button', { name: 'Next period' }).click();
    assert.equal(await compactDate.inputValue(), dayAfter(7));
    await correctionPage.locator('.cw-entry').filter({ hasText: skippedTitle }).waitFor();
    await correctionPage.getByRole('button', { name: 'Next period' }).click();
    assert.equal(await compactDate.inputValue(), dayAfter(14));
    assert.equal(await correctionPage.locator('.cw-entry').filter({ hasText: skippedTitle }).count(), 0);
    await correctionPage.getByRole('button', { name: 'Previous period' }).click();
    assert.equal(await compactDate.inputValue(), dayAfter(7));
    await correctionPage.locator('.cw-entry').filter({ hasText: skippedTitle }).waitFor();
    await correctionPage.getByRole('button', { name: 'Previous period' }).click();
    assert.equal(await compactDate.inputValue(), today);
    checks.push(`${width}px compact Agenda visits adjacent seven-day windows in both directions`);
    await correctionPage.close();
  }
  const fullAgenda = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await fullAgenda.addInitScript((value) => localStorage.setItem('apex-gate-token', value), token);
  await fullAgenda.goto(origin + '/app/calendar');
  await fullAgenda.getByRole('button', { name: 'Agenda', exact: true }).click();
  await fullAgenda.getByLabel('Calendar date', { exact: true }).fill(today);
  await fullAgenda.getByRole('button', { name: 'Next period' }).click();
  assert.equal(await fullAgenda.getByLabel('Calendar date', { exact: true }).inputValue(), dayAfter(31));
  checks.push('Full Agenda retains 31-day navigation');
  await fullAgenda.close();
  const timedEvents = [];
  for (const [label, hour] of [['09', 15], ['12', 18], ['15', 21]]) {
    const response = await fetch(origin + '/api/calendar-events', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        title: `${correctionPrefix} timed ${label}`,
        note: null,
        jobId: correctionJobs.pools,
        eventType: 'meeting',
        assignedUserId: user,
        allDay: false,
        startsOn: null,
        endsOn: null,
        startsAt: `${today}T${hour}:00:00.000Z`,
        endsAt: `${today}T${hour + 1}:00:00.000Z`,
        timezone: 'America/Chicago',
      }),
    });
    const event = await response.json();
    assert.equal(response.status, 201, JSON.stringify(event));
    timedEvents.push(event.eventId);
  }
  const allDayEvent = await createCorrectionEvent('all day order', correctionJobs.pools);
  const ordered = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ordered.addInitScript((value) => localStorage.setItem('apex-gate-token', value), token);
  let includeAllDay = false;
  await ordered.route('**/api/workspace-calendar', async (route) => {
    const response = await route.fetch();
    const entries = await response.json();
    const allowed = new Set([...timedEvents, ...(includeAllDay ? [allDayEvent.eventId] : [])]);
    await route.fulfill({ response, json: entries.filter((entry) => entry.source === 'appointment' && allowed.has(entry.event.eventId)) });
  });
  await ordered.goto(origin + '/app');
  await ordered.getByText(`${correctionPrefix} timed 09`, { exact: true }).waitFor();
  assert.deepEqual(
    await ordered.locator('.cw-summary > .cw-entry strong').allTextContents(),
    [`${correctionPrefix} timed 09`, `${correctionPrefix} timed 12`],
  );
  includeAllDay = true;
  await ordered.goto(origin + '/app/calendar');
  await ordered.getByRole('button', { name: 'Day', exact: true }).click();
  await ordered.getByLabel('Calendar date', { exact: true }).fill(today);
  await ordered.getByText(`${correctionPrefix} all day order`, { exact: true }).waitFor();
  assert.deepEqual(
    await ordered.locator('.cw-days .cw-entry strong').allTextContents(),
    ['all day order', 'timed 09', 'timed 12', 'timed 15'].map((name) => `${correctionPrefix} ${name}`),
  );
  checks.push('Three out-of-order persisted timed events show earliest two in mobile Today; Day places all-day first then timed chronology');
  await ordered.close();
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await db.end();
  writeFileSync('/tmp/apex2/calendar-browser-server.log', serverLog);
}
