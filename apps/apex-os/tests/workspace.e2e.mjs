// Real synthetic PostgreSQL + HTTP + built app browser acceptance; no provider mocks.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '../../../packages/database/node_modules/pg/lib/index.js';
import { SignJWT } from '../../gate-api/node_modules/jose/dist/webapi/index.js';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import { createCanonicalId } from '../../../packages/contracts/dist/index.js';
assert(process.env.DATABASE_URL, 'Disposable PostgreSQL required');
const origin = 'http://127.0.0.1:4198',
  secret = 'workspace-browser-synthetic-secret-long-enough';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const server = spawn(process.execPath, ['apps/gate-api/dist/main.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: '4198',
    HOST: '127.0.0.1',
    GATE_JWT_SECRET: secret,
    GATE_EVIDENCE_DIRECTORY: '/tmp/apex2/workspace-browser-storage',
    APEX_PUBLIC_ORIGIN: origin,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (d) => (logs += d));
server.stderr.on('data', (d) => (logs += d));
let browser;
const checks = [];
mkdirSync('/tmp/apex2/screenshots', { recursive: true });
async function assertMobileAppointment(page) {
  const appointment = await page
      .locator('.cw-summary>.cw-entry')
      .first()
      .boundingBox(),
    nav = await page.locator('.shell-nav').boundingBox(),
    quick = await page
      .getByRole('button', { name: 'Open quick actions' })
      .boundingBox();
  assert(appointment && nav && quick);
  assert(
    appointment.y + appointment.height <= Math.min(nav.y, quick.y),
    `First appointment must be above mobile overlays: ${JSON.stringify({ appointment, nav, quick })}`,
  );
}

try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(logs);
    try {
      await fetch(origin + '/api/me');
      break;
    } catch {
      await delay(100);
    }
  }
  const ids = {
    admin: createCanonicalId('user'),
    field: createCanonicalId('user'),
    other: createCanonicalId('user'),
  };
  for (const [role, id] of Object.entries(ids))
    await db.query(
      `insert into app_users(user_id,auth_user_id,role,display_name) values($1,gen_random_uuid(),$2,$3)`,
      [id, role === 'admin' ? 'office' : 'field', `Workspace Browser ${role}`],
    );
  const token = async (who) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ids[who])
      .setIssuer('apex-gate')
      .setAudience('apex-gate-api')
      .setExpirationTime('30m')
      .sign(new TextEncoder().encode(secret));
  const tokens = { admin: await token('admin'), field: await token('field') };
  async function api(path, body, who = 'admin', key = crypto.randomUUID()) {
    const response = await fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
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
  const suffix = Date.now().toString(),
    names = {
      a: `Workspace Alpha ${suffix}`,
      b: `Workspace Beta ${suffix}`,
      c: `Workspace Coating ${suffix}`,
      d: `Workspace Renovation ${suffix}`,
      e: `Workspace Service ${suffix}`,
      f: `Workspace Unknown ${suffix}`,
    };
  const jobs = {};
  for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const lead = createCanonicalId('lead'),
      job = createCanonicalId('job');
    jobs[k] = job;
    await db.query(
      `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,$3)`,
      [
        lead,
        crypto.randomUUID(),
        JSON.stringify({
          customerName: names[k],
          vertical: {
            a: 'Designer Pools',
            b: 'Designer Pools',
            c: 'Concrete Coating',
            d: 'Design & Renovation',
            e: 'Pool Service',
            f: null,
          }[k],
          address: 'Synthetic test address',
        }),
      ],
    );
    await db.query(
      `insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`,
      [job, lead],
    );
  }
  await api(`/api/jobs/${jobs.a}/project`, {});
  await api(`/api/jobs/${jobs.a}/project/phase`, {
    toPhaseKey: 'gunite',
    reason: 'Synthetic recorded skip; no gate release implied.',
  });
  const day = new Date().toISOString().slice(0, 10);
  const fields = {
    detail: null,
    assignedUserId: ids.admin,
    dueDate: day,
    priority: 'urgent',
    milestone: null,
    recurrence: 'none',
  };
  const mine = await api('/api/tasks', {
    ...fields,
    title: `Mine ${suffix}`,
    jobId: jobs.a,
  });
  const staff = await api('/api/tasks', {
    ...fields,
    title: `Staff-wide ${suffix}`,
    assignedUserId: ids.other,
    jobId: jobs.a,
  });
  await api('/api/tasks', {
    ...fields,
    title: `Beta-only ${suffix}`,
    jobId: jobs.b,
  });
  await api('/api/tasks', {
    ...fields,
    title: `Field assigned ${suffix}`,
    assignedUserId: ids.field,
    jobId: jobs.a,
  });
  await api('/api/calendar-events', {
    title: `Today appointment ${suffix}`,
    note: 'Persisted appointment',
    assignedUserId: ids.admin,
    eventType: 'meeting',
    jobId: jobs.a,
    allDay: true,
    startsOn: day,
    endsOn: day,
    startsAt: null,
    endsAt: null,
    timezone: 'America/Chicago',
  });
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [],
      requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/api/')) requests.push(new URL(r.url()).pathname);
    });
    await page.addInitScript(
      (t) => localStorage.setItem('apex-gate-token', t),
      tokens.admin,
    );
    // Embedded tabs must not shadow preserved operational deep links.
    await page.goto(origin + `/app/projects/${jobs.a}`);
    for (const [tab, anchor] of [
      ['Inspections', 'inspections'],
      ['Procurement', 'procurement'],
    ]) {
      await page
        .locator('.selected-project')
        .getByRole('button', { name: tab, exact: true })
        .click();
      await page
        .locator('.selected-project .workspace-tab')
        .getByRole('heading', { name: tab, exact: true })
        .waitFor();
      assert.equal(
        await page.locator(`[id="${anchor}"]`).count(),
        1,
        `${tab}: preserved operational ID must remain unique with embedded tab mounted`,
      );
      const duplicates = await page.locator('[id]').evaluateAll((nodes) => {
        const ids = nodes.map((n) => n.id);
        return [
          ...new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
        ];
      });
      assert.deepEqual(duplicates, [], 'all DOM IDs remain unique');
      await page.locator(`.project-jump a[href="#${anchor}"]`).click();
      await page.waitForFunction(
        (value) => location.hash === `#${value}`,
        anchor,
      );
      assert(
        await page
          .locator(`[id="${anchor}"]`)
          .evaluate((node) => !node.closest('.selected-project')),
        `${tab}: legacy jump still targets original operational section`,
      );
    }
    checks.push(
      `${viewport.width}: embedded inspection/procurement tabs preserve unique legacy anchors and jump destinations`,
    );
    for (const key of ['c', 'd', 'e', 'f']) {
      await page.goto(origin + `/app/today?project=${jobs[key]}`);
      const selected = page.locator('.selected-project');
      await selected
        .getByRole('heading', { name: names[key], exact: true })
        .waitFor();
      await selected
        .getByRole('button', { name: 'Inspections', exact: true })
        .click();
      await selected
        .getByRole('region', { name: 'Inspection configuration' })
        .getByRole('heading', {
          name: 'Inspection configuration required',
          exact: true,
        })
        .waitFor({ timeout: 4000 });
      assert.equal(
        await selected.locator('.workspace-tab ul.schedule').count(),
        0,
      );
      assert.equal(
        await selected
          .getByRole('button', { name: /^Call in$|^Result$/ })
          .count(),
        0,
      );
      assert.equal(
        requests.filter((path) => path === `/api/jobs/${jobs[key]}/inspections`)
          .length,
        0,
        'unsupported workspace must not fetch the pool inspection catalog',
      );
    }
    checks.push(
      `${viewport.width}: coating/renovation/service/unknown inspection tabs stay configuration-required with no pool fetch or controls`,
    );
    // Measure concurrent dashboard reads only for this navigation.
    requests.length = 0;
    await page.goto(origin + '/app/today');
    await page
      .getByRole('heading', { name: 'My Checklist', exact: true })
      .waitFor();
    await page
      .getByRole('heading', { name: `Mine ${suffix}`, exact: true })
      .waitFor();
    assert.equal(
      await page
        .locator('.workspace-checklist')
        .getByText(`Staff-wide ${suffix}`, { exact: true })
        .count(),
      0,
      'My Checklist excludes unrelated staff tasks',
    );
    const columns = await page
      .locator('.workspace-columns')
      .evaluate(
        (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length,
      );
    assert.equal(columns, viewport.width === 1440 ? 3 : 1);
    checks.push(
      `${viewport.width}: responsive command center and checklist ownership`,
    );
    assert(
      requests.filter((p) => p === '/api/jobs').length <= 1,
      'columns coalesce concurrent job reads',
    );
    const taskBounds = await page.locator('.workspace-checklist').boundingBox();
    const addBounds = await page
      .locator('.workspace-checklist .section-rule')
      .getByText('Add task', { exact: false })
      .boundingBox();
    assert(
      addBounds.x >= taskBounds.x &&
        addBounds.x + addBounds.width <= taskBounds.x + taskBounds.width,
      'Checklist add remains inside its column',
    );
    if (viewport.width === 390) {
      assert.equal(
        await page.locator('.workspace-checklist .task-filters').count(),
        0,
      );
      assert.equal(
        await page.locator('.workspace-checklist .task-actions').count(),
        0,
      );
      await assertMobileAppointment(page);
    }
    await page.getByLabel('Search jobs', { exact: true }).fill(suffix);
    await page
      .getByRole('button', { name: `Select ${names.a}`, exact: true })
      .click();
    await page
      .locator('.selected-project')
      .getByRole('heading', { name: names.a, exact: true })
      .waitFor();
    assert(new URL(page.url()).searchParams.get('project') === jobs.a);
    await page
      .locator('.selected-project')
      .getByText('0 / 9 required gates released', { exact: true })
      .waitFor();
    await page
      .getByRole('button', { name: `Select ${names.b}`, exact: true })
      .click();
    await page
      .locator('.selected-project')
      .getByRole('heading', { name: names.b, exact: true })
      .waitFor();
    await page.goBack();
    await page
      .locator('.selected-project')
      .getByRole('heading', { name: names.a, exact: true })
      .waitFor();
    await page.reload();
    await page
      .locator('.selected-project')
      .getByRole('heading', { name: names.a, exact: true })
      .waitFor();
    checks.push(
      `${viewport.width}: selection query, back and persisted deep link`,
    );
    await page
      .getByRole('region', { name: 'Recorded stage timeline' })
      .getByText('Synthetic recorded skip; no gate release implied.', {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page
        .getByText(
          'The Apex API returned data this build does not understand.',
          { exact: false },
        )
        .count(),
      0,
    );
    if (viewport.width === 1440) {
      const box = await page
        .getByRole('heading', { name: 'Active Projects', exact: true })
        .boundingBox();
      assert(
        box.y < 1000,
        'Active Projects remains visible within desktop viewport',
      );
    }

    const panel = page.locator('.selected-project');
    await panel.getByRole('button', { name: 'Tasks', exact: true }).click();
    await panel
      .getByRole('heading', { name: `Staff-wide ${suffix}`, exact: true })
      .waitFor();
    // Delay the next project's task read: prior project identity must vanish immediately.
    let release;
    const hold = new Promise((r) => (release = r));
    await page.route(`**/api/tasks?job=${jobs.b}`, async (route) => {
      await hold;
      await route.continue();
    });
    await page.getByLabel('Search jobs', { exact: true }).fill(suffix);
    await page
      .getByRole('button', { name: `Select ${names.b}`, exact: true })
      .click();
    await page
      .locator('.selected-project')
      .getByRole('button', { name: 'Tasks', exact: true })
      .click();
    assert.equal(
      await page
        .locator('.selected-project')
        .getByRole('heading', { name: `Staff-wide ${suffix}`, exact: true })
        .count(),
      0,
    );
    release();
    await page
      .locator('.selected-project')
      .getByRole('heading', { name: `Beta-only ${suffix}`, exact: true })
      .waitFor();
    await page.unroute(`**/api/tasks?job=${jobs.b}`);
    checks.push(
      `${viewport.width}: fast project scope switch clears prior tasks`,
    );
    await page
      .getByRole('button', { name: `Select ${names.a}`, exact: true })
      .click();
    await panel.getByRole('button', { name: 'Tasks', exact: true }).click();
    const unique = `Added project task ${viewport.width} ${suffix}`;
    await panel.getByRole('button', { name: 'Add task', exact: true }).click();
    await panel.getByLabel('Title', { exact: true }).fill(unique);
    await panel.getByLabel('Due date', { exact: true }).fill(day);
    await panel.getByLabel('Priority', { exact: true }).selectOption('urgent');
    await panel.getByRole('button', { name: 'Save task', exact: true }).click();
    await panel.getByRole('heading', { name: unique, exact: true }).waitFor();
    await page
      .locator('.workspace-checklist')
      .getByRole('heading', { name: unique, exact: true })
      .waitFor();
    await panel
      .getByRole('checkbox', { name: `Complete ${unique}`, exact: true })
      .click();
    await page
      .locator('.workspace-checklist')
      .getByRole('heading', { name: unique, exact: true })
      .waitFor({ state: 'hidden' });
    checks.push(
      `${viewport.width}: canonical project tasks update My Checklist`,
    );
    await panel.getByRole('button', { name: 'Calendar', exact: true }).click();
    await panel
      .getByRole('button')
      .filter({ hasText: `Today appointment ${suffix}` })
      .waitFor();
    await page
      .locator('.workspace-center>.calendar-workspace .cw-entry')
      .filter({ hasText: `Today appointment ${suffix}` })
      .waitFor();
    checks.push(
      `${viewport.width}: same persisted calendar event in center/project views`,
    );
    const reconnectedTitle = `Reconnect appointment ${viewport.width} ${suffix}`;
    await api('/api/calendar-events', {
      title: reconnectedTitle,
      note: null,
      assignedUserId: ids.admin,
      eventType: 'meeting',
      jobId: jobs.a,
      allDay: true,
      startsOn: day,
      endsOn: day,
      startsAt: null,
      endsAt: null,
      timezone: 'America/Chicago',
    });
    let resumeCalendar, calendarStarted;
    const calendarHold = new Promise((r) => (resumeCalendar = r)),
      calendarRequest = new Promise((r) => (calendarStarted = r));
    let coalescedReads = 0;
    await page.route('**/api/workspace-calendar', async (route) => {
      coalescedReads++;
      calendarStarted();
      await calendarHold;
      await route.continue();
    });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await calendarRequest;
    await panel.getByRole('button', { name: 'Overview', exact: true }).click();
    resumeCalendar();
    await page
      .locator('.workspace-center>.calendar-workspace .cw-entry')
      .filter({ hasText: reconnectedTitle })
      .waitFor();
    assert.equal(
      coalescedReads,
      1,
      'shared calendar read survives one subscriber unmount',
    );
    await page.unroute('**/api/workspace-calendar');
    checks.push(
      `${viewport.width}: reconnect refresh and independent subscriber cancellation`,
    );

    await panel.getByRole('button', { name: 'Overview', exact: true }).click();
    await panel.getByRole('button', { name: 'Add note', exact: true }).click();
    const note = `Browser note ${viewport.width} ${suffix}`;
    await page
      .getByRole('dialog', { name: 'Add project note' })
      .getByLabel('Note', { exact: true })
      .fill(note);
    if (viewport.width === 1440) {
      await page.route('**/api/jobs/*/notes', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const response = await route.fetch();
        assert.equal(response.status(), 201);
        await route.abort('failed');
        await page.unroute('**/api/jobs/*/notes');
      });
      await page
        .getByRole('button', { name: 'Save note', exact: true })
        .click();
      await page.getByRole('dialog').getByRole('alert').waitFor();
    }
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await panel.getByText(note, { exact: true }).waitFor();
    await page.reload();
    await panel.getByText(note, { exact: true }).waitFor();
    assert.equal(
      (
        await db.query(
          'select count(*) from project_notes where job_id=$1 and text=$2',
          [jobs.a, note],
        )
      ).rows[0].count,
      '1',
    );
    checks.push(
      `${viewport.width}: persisted note/reload and acknowledgement-safe exact retry`,
    );
    await panel
      .getByLabel('Project priority', { exact: true })
      .selectOption('high');
    await panel.getByText('high', { exact: true }).first().waitFor();
    await page.reload();
    await panel
      .getByLabel('Project priority', { exact: true })
      .selectOption('urgent');
    await page.getByLabel('Search jobs', { exact: true }).fill(suffix);
    await page.evaluate(() => window.scrollTo(0, 0));
    await panel
      .locator('.workspace-identity strong')
      .filter({ hasText: 'urgent' })
      .waitFor();
    await page.reload();
    await panel
      .locator('.workspace-identity strong')
      .filter({ hasText: 'urgent' })
      .waitFor();
    await page.getByLabel('Search jobs', { exact: true }).fill(suffix);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page
      .locator('.workspace-center>.calendar-workspace .cw-entry')
      .filter({ hasText: reconnectedTitle })
      .first()
      .waitFor();
    await page
      .locator('.workspace-center>.calendar-workspace')
      .getByText('Loading calendar…', { exact: true })
      .waitFor({ state: 'hidden' });
    await panel.getByText(note, { exact: true }).waitFor();
    if (viewport.width === 1440) {
      const first = await page
        .locator('.project-list .project-card')
        .first()
        .boundingBox();
      assert(
        first.y + Math.min(first.height, 100) < 1000,
        'First project card content appears within desktop viewport',
      );
    } else {
      await assertMobileAppointment(page);
    }
    await page.screenshot({
      path: `/tmp/apex2/screenshots/workspace-${viewport.width}.png`,
      fullPage: false,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'no sideways overflow',
    );
    assert.deepEqual(errors, []);
    checks.push(
      `${viewport.width}: persisted priority, screenshot, no overflow or JS errors`,
    );
    await page.goto(origin + '/app/projects');
    await page.getByLabel('Search jobs', { exact: true }).fill(suffix);
    await page
      .getByLabel('Division', { exact: true })
      .selectOption('Concrete Coating');
    await page
      .getByRole('link', { name: `Open ${names.c}`, exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole('link', { name: `Open ${names.a}`, exact: true })
        .count(),
      0,
    );
    await page.getByLabel('Status', { exact: true }).selectOption('on-hold');
    await page
      .getByText('No jobs match this view.', { exact: false })
      .waitFor();
    await page.getByLabel('Status', { exact: true }).selectOption('active');
    await page
      .getByRole('link', { name: `Open ${names.c}`, exact: true })
      .click();
    await page
      .locator('.selected-project')
      .getByText('Stage configuration required', { exact: true })
      .waitFor();
    checks.push(
      `${viewport.width}: Jobs search/division/status and canonical route`,
    );
    // No selected project: quick note action must require an explicit chooser.
    await page.goto(origin + '/app/projects');
    await page.getByRole('button', { name: 'Open quick actions' }).click();
    await page.getByRole('link', { name: 'Add Note', exact: true }).click();
    await page.getByRole('region', { name: 'Choose a project' }).waitFor();
    await page
      .getByRole('region', { name: 'Choose a project' })
      .getByRole('link', { name: names.a, exact: true })
      .click();
    await page.getByRole('dialog', { name: 'Add project note' }).waitFor();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await page.getByRole('button', { name: 'Open quick actions' }).click();
    await page.getByRole('link', { name: 'Add Note', exact: true }).click();
    await page.getByRole('dialog', { name: 'Add project note' }).waitFor();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    checks.push(
      `${viewport.width}: note chooser and repeated same-path quick action`,
    );
    await page.close();
  }
  const field = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await field.addInitScript(
    (t) => localStorage.setItem('apex-gate-token', t),
    tokens.field,
  );
  await field.goto(origin + `/app/today?project=${jobs.a}`);
  const panel = field.locator('.selected-project');
  await panel.getByRole('button', { name: 'Tasks', exact: true }).click();
  await panel
    .getByRole('heading', { name: `Staff-wide ${suffix}`, exact: true })
    .waitFor();
  assert(
    await panel
      .getByRole('checkbox', {
        name: `Complete Staff-wide ${suffix}`,
        exact: true,
      })
      .isDisabled(),
  );
  assert(
    !(await panel
      .getByRole('checkbox', {
        name: `Complete Field assigned ${suffix}`,
        exact: true,
      })
      .isDisabled()),
  );
  assert.equal(
    await panel.getByLabel('Project priority', { exact: true }).count(),
    0,
  );
  checks.push(
    'field: project reads, own controls, unavailable manager priority hidden',
  );
  await field.close();
  await db.query(`update jobs set status='cancelled' where job_id=$1`, [
    jobs.b,
  ]);
  const closed = await browser.newPage();
  await closed.addInitScript(
    (t) => localStorage.setItem('apex-gate-token', t),
    tokens.admin,
  );
  await closed.goto(origin + `/app/historical/${jobs.b}?action=add-note`);
  await closed.getByRole('dialog', { name: 'Add project note' }).waitFor();
  assert(
    await closed
      .getByRole('button', { name: 'Save note', exact: true })
      .isDisabled(),
  );
  const refusal = await fetch(origin + `/api/jobs/${jobs.b}/notes`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokens.admin}`,
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ text: 'Closed refusal' }),
  });
  assert.equal(refusal.status, 409);
  checks.push('closed/cancelled: note UI and real HTTP refusal');
  await closed.close();
  console.log(
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        screenshots: ['workspace-1440.png', 'workspace-390.png'],
        limits: [
          'Jobsite upload deferred to following photo milestone; existing gallery only.',
          'Synthetic loopback acceptance; no staging or live provider acceptance.',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await db.end();
  writeFileSync('/tmp/apex2/projects-browser-server.log', logs);
}
