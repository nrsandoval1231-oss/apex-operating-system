// Gate B acceptance: accepted Proposal -> Project -> Gates/inspections -> closeout,
// driven against a real gate-api process, PostgreSQL and S3-compatible storage.
// Setup steps use the real HTTP API; the final Gate release (including its native
// confirmation), completion, closeout and History are driven through the browser.
//
//   DATABASE_URL=... S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
//   EVIDENCE_DIR=<dir> node apps/apex-os/tests/closeout-acceptance.e2e.mjs
//
// Synthetic records only. Never point this at a database holding real customers.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from '../../../packages/database/node_modules/pg/lib/index.js';
import { SignJWT } from '../../gate-api/node_modules/jose/dist/webapi/index.js';
import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import { createCanonicalId } from '../../../packages/contracts/dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(process.env.EVIDENCE_DIR ?? resolve(root, 'var/closeout-evidence'));
mkdirSync(out, { recursive: true });
const port = 4193;
const origin = `http://127.0.0.1:${port}`;
const secret = 'closeout-acceptance-local-secret-0123456789abcdef';
const log = [];
const note = (step, detail = {}) => { log.push({ step, ...detail }); console.log(`ok  ${step}`, Object.keys(detail).length ? JSON.stringify(detail) : ''); };

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const users = { admin: createCanonicalId('user'), superintendent: createCanonicalId('user'), inactive: createCanonicalId('user') };
const server = spawn(process.execPath, ['apps/gate-api/dist/main.js'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', GATE_JWT_SECRET: secret, APEX_PUBLIC_ORIGIN: origin },
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });
let browser;

const token = (userId) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
  .setIssuer('apex-gate').setAudience('apex-gate-api').setIssuedAt().setExpirationTime('2h')
  .sign(new TextEncoder().encode(secret));
const call = async (who, method, path, body, key) => {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { authorization: `Bearer ${await token(users[who])}`, 'content-type': 'application/json',
      ...(key ? { 'idempotency-key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, json };
};
const ok = async (...args) => {
  const result = await call(...args);
  assert.ok(result.status < 300, `${args[1]} ${args[2]} -> ${result.status} ${JSON.stringify(result.json)}`);
  return result.json;
};
const run = `gateb-${Date.now()}`;
const k = (...parts) => [run, ...parts].join(':');

try {
  // Migrations run on server start; wait until ready.
  const until = Date.now() + 60_000;
  for (;;) {
    try { if ((await fetch(`${origin}/ready`)).ok) break; } catch { /* starting */ }
    if (Date.now() > until) throw new Error(`gate-api did not become ready\n${serverLog}`);
    await delay(300);
  }
  await db.query(`insert into app_users(user_id,auth_user_id,role,display_name,active) values
    ($1,gen_random_uuid(),'admin','Synthetic Admin',true),
    ($2,gen_random_uuid(),'superintendent','Synthetic Super',true),
    ($3,gen_random_uuid(),'office','Synthetic Inactive',false)`, [users.admin, users.superintendent, users.inactive]);
  note('server ready, synthetic staff provisioned');

  // Authorization boundaries.
  assert.equal((await fetch(`${origin}/api/jobs`)).status, 403);
  assert.equal((await call('inactive', 'GET', '/api/jobs')).status, 403);
  note('unauthenticated and inactive staff refused');

  // 1. Lead -> priced, issued Proposal -> acceptance -> exactly one Job/Project.
  const lead = await ok('admin', 'POST', '/api/projects/intake', { customerName: 'Synthetic Closeout Customer',
    streetAddress: '1 Acceptance Way', city: 'Lubbock', state: 'TX', postalCode: '79401' }, k('intake'));
  const quantities = [
    ['pool.water-volume', 15000, 'gal'], ['excavation.bank-volume', 100, 'BCY'], ['excavation.spoil-haul-volume', 110, 'LCY'],
    ['shell.gunite-ordered-volume', 40, 'cy'], ['shell.reinforcing-steel-weight', 1200, 'lb'], ['shell.forming-perimeter', 100, 'ft'],
    ['finishes.plaster-net-area', 900, 'sf'], ['finishes.plaster-ordered-area', 920, 'sf'], ['finishes.tile-net-length', 100, 'lf'],
    ['finishes.tile-ordered-area', 55, 'sf'], ['finishes.coping-ordered-length', 106, 'lf'], ['yard.deck-area', 360, 'sf'],
    ['plumbing.developed-run-length', 750, 'lf'], ['utilities.bonding-conductor-length', 220, 'lf'],
  ].map(([code, value, unit]) => ({ code, value, unit, calcId: `gateb.${code.replaceAll('-', '.')}` }));
  const submission = { engineVersion: 'gateb', quantityModelVersion: 'gateb-v1', jobModel: { synthetic: true }, quantities,
    calcLedger: quantities.map((q) => ({ id: q.calcId, label: q.code, formula: 'synthetic', inputs: [], value: q.value, unit: q.unit })),
    supersedeExisting: false };
  const { MEASURED_LINE_DEFINITIONS } = await import('../../../packages/pricing-engine/dist/index.js');
  const directLines = [300, 500, 600, 900, 1100, 1200, 1300].map((code) => ({ code, name: `Direct ${code}`,
    scopeStatus: 'not-applicable', amountCents: null, basis: 'Synthetic scope excludes this item.' }));
  const measuredLines = MEASURED_LINE_DEFINITIONS.map(([id]) => ({ id, amountCents: 10_000, basis: 'Synthetic estimate.' }));
  const blocked = await call('admin', 'POST', `/api/opportunities/${lead.leadId}/finish-estimate`,
    { submission, directLines: [], measuredLines: [], feeRateBps: 3000 }, k('finish-blocked'));
  assert.ok(blocked.status < 300 && blocked.json.blockers.length > 0, 'missing prices must block');
  const finished = await ok('admin', 'POST', `/api/opportunities/${lead.leadId}/finish-estimate`,
    { submission, directLines, measuredLines, feeRateBps: 3000 }, k('finish'));
  assert.equal(finished.proposal.status, 'issued');
  const p = finished.proposal;
  const signBody = { expectedVersionNumber: 1, expectedDraftRevision: p.draftRevision, customerAcceptanceConfirmed: true };
  const signed = await ok('admin', 'POST', `/api/proposals/${p.proposalVersionId}/sign`, signBody, k('sign'));
  const signedRetry = await ok('admin', 'POST', `/api/proposals/${p.proposalVersionId}/sign`, signBody, k('sign-retry'));
  assert.equal(signedRetry.jobId, signed.jobId);
  const jobId = signed.jobId;
  const jobRows = (await db.query('select job_id from jobs where lead_id=$1', [lead.leadId])).rows;
  const projectRows = (await db.query('select job_id from projects where job_id=$1', [jobId])).rows;
  assert.equal(jobRows.length, 1); assert.equal(projectRows.length, 1);
  note('accepted proposal created exactly one job and project (retry with new key returned same job)', { jobId });

  // Draw schedule; invoice references are recorded but collections stay unknown.
  const draws = await ok('admin', 'POST', `/api/jobs/${jobId}/draws`, undefined, k('draws'));
  assert.equal(draws.collectedCents ?? null, null);
  await ok('admin', 'POST', `/api/jobs/${jobId}/draws/deposit/invoice`, { invoiceReference: `SYN-${run}-deposit` });

  // 2–4. Inspections, Gates, and phases. Closeout must refuse until all are done.
  const early = await call('admin', 'POST', `/api/jobs/${jobId}/close`, undefined, k('close-early'));
  assert.ok(early.status >= 400, `early close must be refused, got ${early.status}`);
  const earlyComplete = await call('admin', 'POST', `/api/jobs/${jobId}/complete`, undefined, k('complete-early'));
  assert.ok(earlyComplete.status >= 400, `early completion must be refused, got ${earlyComplete.status}`);
  note('closeout and completion refused before final phase', { close: early.status, complete: earlyComplete.status });

  const inspectionTypes = await ok('admin', 'GET', '/api/inspection-types');
  for (const type of inspectionTypes) {
    await ok('admin', 'POST', `/api/jobs/${jobId}/inspections/${type.inspectionKey}/result`, { outcome: 'passed', occurredOn: '2026-10-16' });
  }
  note('required inspections recorded', { count: inspectionTypes.length });

  const plan = await ok('admin', 'GET', `/api/jobs/${jobId}/gates`);
  const browserGate = plan[plan.length - 1];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  for (const entry of plan.slice(0, -1)) {
    const gate = await ok('admin', 'POST', `/api/jobs/${jobId}/gates/${entry.definitionKey}`, {});
    await ok('admin', 'POST', `/api/gates/${gate.gateInstanceId}/start`, {}, k(entry.definitionKey, 'start'));
    for (const req of gate.requirements) {
      if (req.evidenceRequired) {
        const kind = req.acceptedEvidenceKinds.includes('photo') ? 'photo' : req.acceptedEvidenceKinds[0];
        const mimeType = kind === 'photo' ? 'image/png' : kind === 'document' ? 'application/pdf' : 'video/mp4';
        const content = kind === 'photo' ? png : Buffer.from(kind === 'document' ? '%PDF-1.4\n%synthetic\n' : 'synthetic');
        await ok('admin', 'POST', `/api/gates/${gate.gateInstanceId}/evidence`, { requirementKey: req.key, kind, mimeType,
          contentBase64: content.toString('base64'), capturedAt: new Date().toISOString() }, k(entry.definitionKey, req.key, 'evidence'));
      }
      await ok('admin', 'POST', `/api/gates/${gate.gateInstanceId}/requirements/${encodeURIComponent(req.key)}/evaluate`,
        { outcome: 'passed' }, k(entry.definitionKey, req.key, 'pass'));
    }
    await ok('admin', 'POST', `/api/gates/${gate.gateInstanceId}/release`, {}, k(entry.definitionKey, 'release'));
    if (entry.drawCode) await ok('admin', 'POST', `/api/jobs/${jobId}/draws/${entry.drawCode}/invoice`, { invoiceReference: `SYN-${run}-${entry.drawCode}` });
  }
  note('gates released through API', { released: plan.length - 1, browserGate: browserGate.definitionKey });

  const phases = ['design-permitting', 'layout-excavation', 'steel-reinforcement', 'rough-in', 'gunite', 'tile-coping', 'decking',
    'equipment-hookup', 'automation-programming', 'cover-install', 'plaster-fill'];
  for (const phase of phases.slice(1)) {
    const project = await ok('admin', 'GET', `/api/jobs/${jobId}/project`);
    if (project?.currentPhaseKey === phase) continue;
    await ok('admin', 'POST', `/api/jobs/${jobId}/project/phase`, { toPhaseKey: phase, reason: `Synthetic crew completed prior phase.` }, k('phase', phase));
  }
  note('project advanced to final phase');

  // 5. Browser: last Gate (upload, pass, release via native confirmation), complete, close, history.
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { authorization: `Bearer ${await token(users.admin)}` } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const dialogs = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.goto(`${origin}/app/projects/${jobId}`);
  await page.getByText('Closeout checklist').waitFor({ timeout: 20_000 });
  const closeoutBefore = await call('admin', 'GET', `/api/jobs/${jobId}/close`);
  assert.equal(closeoutBefore.json.ready, false, 'closeout must not be ready with a gate outstanding');
  await page.screenshot({ path: resolve(out, '01-project-before-final-gate.png'), fullPage: true });

  const title = browserGate.title;
  // The plan lists Gates in order; the final Gate is the last "Open workflow" toggle.
  await page.getByRole('button', { name: /open workflow/i }).last().click();
  await page.getByRole('button', { name: `Open ${title}`, exact: true }).click();
  await page.getByRole('button', { name: `Start ${title}` }).click();
  const gateState = (await ok('admin', 'GET', `/api/jobs/${jobId}/gates`)).find((g) => g.definitionKey === browserGate.definitionKey);
  const gate = await ok('admin', 'GET', `/api/gates/${gateState.gateInstanceId}`);
  const workflow = page.locator('.gate-workflow').filter({ hasText: `${title} ·` });
  await workflow.waitFor();
  for (const [index, req] of gate.requirements.entries()) {
    const article = workflow.locator('.gate-requirement').nth(index);
    if (req.evidenceRequired) {
      const kind = req.acceptedEvidenceKinds.includes('photo') ? 'photo' : req.acceptedEvidenceKinds[0];
      const file = kind === 'photo' ? { name: 'proof.png', mimeType: 'image/png', buffer: png }
        : { name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%synthetic\n') };
      await article.locator('input[type=file]').setInputFiles(file);
      await article.locator('.proof-grid').waitFor({ timeout: 15_000 });
    }
    await article.getByRole('button', { name: 'Pass' }).click();
    await article.getByText('passed', { exact: true }).waitFor();
  }
  await workflow.getByRole('button', { name: `Release ${title}` }).click();
  await workflow.getByText(`${title} · released`).waitFor({ timeout: 15_000 });
  assert.equal(dialogs.length, 1, 'release must ask for confirmation exactly once');
  const releasedRow = (await db.query('select status from gate_instances where gate_instance_id=$1', [gate.gateInstanceId]).catch(() => ({ rows: [] }))).rows[0];
  note('browser released final gate after native confirmation', { gate: browserGate.definitionKey, dialog: dialogs[0], dbStatus: releasedRow?.status ?? 'n/a' });
  if (browserGate.drawCode) await ok('admin', 'POST', `/api/jobs/${jobId}/draws/${browserGate.drawCode}/invoice`, { invoiceReference: `SYN-${run}-${browserGate.drawCode}` });

  // Superintendent may complete but may not close.
  await page.reload();
  await page.getByRole('button', { name: 'Mark complete and hand over' }).click();
  await page.getByText('Ready to archive').waitFor({ timeout: 15_000 });
  await page.screenshot({ path: resolve(out, '02-ready-to-archive.png'), fullPage: true });
  const superClose = await call('superintendent', 'POST', `/api/jobs/${jobId}/close`, undefined, k('close-super'));
  assert.ok(superClose.status >= 400, `superintendent close must be refused, got ${superClose.status}`);
  note('browser completed job; superintendent close refused', { superClose: superClose.status });

  const closeResponse = page.waitForResponse((r) => r.url().endsWith(`/api/jobs/${jobId}/close`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Close and archive project' }).click();
  const closeStatus = (await closeResponse).status();
  assert.equal(closeStatus, 200, `browser close returned ${closeStatus}`);
  const closedRow = (await db.query('select status from jobs where job_id=$1', [jobId])).rows[0];
  assert.equal(closedRow.status, 'closed');
  note('browser closed and archived job', { dbStatus: closedRow.status });

  // 6. History persists, is read-only, and closed-job mutation is refused.
  await page.goto(`${origin}/app/projects/${jobId}`);
  // A closed job redirects to its read-only historical record.
  await page.waitForURL(new RegExp(`/historical/${jobId}$`), { timeout: 15_000 });
  await page.getByText(/Historical record — changes are disabled\.\s*Closed .* by Synthetic Admin\./).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: /view record/i }).last().click();
  assert.equal(await page.getByRole('button', { name: /^Open |^Start |^Pass$|^Fail$|Mark complete|Close and archive|Set phase|Track material/i }).count(), 0, 'closed job must show no mutation controls');
  await page.screenshot({ path: resolve(out, '03-closed-history.png'), fullPage: true });
  const historical = await ok('admin', 'GET', '/api/jobs?scope=historical').catch(() => null);
  const history = await ok('admin', 'GET', `/api/jobs/${jobId}/project/history`);
  assert.ok(history.length > 1);
  const mutate = await call('admin', 'POST', `/api/jobs/${jobId}/gates/permit`, {});
  assert.ok(mutate.status >= 400, `closed-job gate creation must be refused, got ${mutate.status}`);
  const phaseMutate = await call('admin', 'POST', `/api/jobs/${jobId}/project/phase`, { toPhaseKey: 'gunite', reason: 'x' }, k('late-phase'));
  assert.ok(phaseMutate.status >= 400, `closed-job phase change must be refused, got ${phaseMutate.status}`);
  const closeRetry = await call('admin', 'POST', `/api/jobs/${jobId}/close`, undefined, k('close-retry'));
  const counts = (await db.query(`select
      (select count(*)::int from jobs where lead_id=$1) jobs,
      (select count(*)::int from projects where job_id=$2) projects,
      (select count(*)::int from evidence_records where job_id=$2) evidence,
      (select count(*)::int from draws where job_id=$2) draws`, [lead.leadId, jobId]).catch(async () =>
    db.query(`select (select count(*)::int from jobs where lead_id=$1) jobs, (select count(*)::int from projects where job_id=$2) projects,
      (select count(*)::int from evidence_records where job_id=$2) evidence`, [lead.leadId, jobId]))).rows[0];
  // Evidence retrieval after closure, from a fresh request.
  const evidenceId = (await db.query('select evidence_id from evidence_records where job_id=$1 limit 1', [jobId])).rows[0].evidence_id;
  const evidence = await fetch(`${origin}/api/evidence/${evidenceId}`, { headers: { authorization: `Bearer ${await token(users.admin)}` } });
  assert.equal(evidence.status, 200);
  const anonEvidence = await fetch(`${origin}/api/evidence/${evidenceId}`);
  assert.ok(anonEvidence.status >= 400);
  note('history retained, protected, and immutable', { historyEntries: history.length, gateMutation: mutate.status,
    phaseMutation: phaseMutate.status, closeRetry: closeRetry.status, evidenceRead: evidence.status,
    anonymousEvidence: anonEvidence.status, historicalListed: Array.isArray(historical) ? historical.some((j) => j.jobId === jobId) : 'n/a', counts });
  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);
  note('no browser page errors');
  writeFileSync(resolve(out, 'closeout-acceptance.json'), JSON.stringify({ result: 'pass', run, jobId, leadId: lead.leadId, steps: log }, null, 2));
  console.log(`PASS closeout acceptance; evidence in ${out}`);
} catch (error) {
  writeFileSync(resolve(out, 'closeout-acceptance.json'), JSON.stringify({ result: 'fail', run, error: String(error?.stack ?? error), steps: log, serverLog: serverLog.slice(-4000) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await db.end();
}
