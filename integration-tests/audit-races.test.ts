import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCanonicalId, type AuthoritativeQuantity, type EventActor, type JobId } from '../packages/contracts/src/index.ts';
import { PostgresDatabase, applyOperationalMigrations, type Database } from '../packages/database/src/index.ts';
import { MEASURED_LINE_DEFINITIONS, type DirectPriceInput } from '../packages/pricing-engine/src/index.ts';
import { GateService, InspectionService } from '../packages/gate-service/src/index.ts';

const url = process.env.DATABASE_URL?.trim();
let db: PostgresDatabase;
const actorId = createCanonicalId('user');
const actor: EventActor = { kind: 'user', userId: actorId, role: 'admin' };
beforeAll(async () => {
  if (!url) return;
  db = PostgresDatabase.create({ url, applicationName: 'apex-audit-races', maxConnections: 6 });
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
  await db.query(`insert into app_users(user_id,auth_user_id,role,display_name)
    values($1,gen_random_uuid(),'admin','Synthetic Audit Regression')`, [actorId]);
});
afterAll(async () => { if (db) await db.close(); });
const key = () => `audit:${createCanonicalId('event')}`;
const directLines: DirectPriceInput[] = ([300, 500, 600, 900, 1100, 1200, 1300] as const).map((code) => ({
  code, name: `Lifecycle direct line ${code}`, scopeStatus: 'not-applicable' as const, amountCents: null,
  basis: 'Synthetic test scope explicitly excludes this direct item.',
}));
const measuredLines = MEASURED_LINE_DEFINITIONS.map(([id]) => ({ id, amountCents: 100_00, basis: 'Synthetic regression estimate.' }));
const quantities: AuthoritativeQuantity[] = [
  ['pool.water-volume', 15000, 'gal'], ['excavation.bank-volume', 100, 'BCY'],
  ['excavation.spoil-haul-volume', 110, 'LCY'], ['shell.gunite-ordered-volume', 40, 'cy'],
  ['shell.reinforcing-steel-weight', 1200, 'lb'], ['shell.forming-perimeter', 100, 'ft'],
  ['finishes.plaster-net-area', 900, 'sf'], ['finishes.plaster-ordered-area', 920, 'sf'],
  ['finishes.tile-net-length', 100, 'lf'], ['finishes.tile-ordered-area', 55, 'sf'],
  ['finishes.coping-ordered-length', 106, 'lf'], ['yard.deck-area', 360, 'sf'],
  ['plumbing.developed-run-length', 750, 'lf'], ['utilities.bonding-conductor-length', 220, 'lf'],
].map(([code, value, unit]) => ({ code: code as AuthoritativeQuantity['code'], value: value as number,
  unit: unit as string, calcId: `lifecycle.${String(code).replaceAll('-', '.')}` }));
const submission = {
  engineVersion: 'lifecycle-test', quantityModelVersion: 'lifecycle-v1', jobModel: { synthetic: true },
  quantities,
  calcLedger: quantities.map((fact) => ({ id: fact.calcId, label: fact.code, formula: 'synthetic fixture input', inputs: [], value: fact.value, unit: fact.unit })),
  supersedeExisting: false,
} as const;


const makeSignedJob = async () => {
  const leadId = createCanonicalId('lead');
  await db.query(`insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload)
    values($1,'synthetic-audit',$1,$2,'{"customerName":"Synthetic Audit"}')`, [leadId, key()]);
  const api = new GateService(db);
  const estimate = await api.finishEstimate({ leadId, actor, submission, directLines, measuredLines,
    feeRateBps: 3000, idempotencyKey: key() });
  expect(estimate.proposal.status).toBe('issued');
  const signed = await api.signProposal({ proposalVersionId: estimate.proposal.proposalVersionId,
    expectedVersionNumber: estimate.proposal.versionNumber, expectedDraftRevision: estimate.proposal.draftRevision,
    actor, customerAcceptanceConfirmed: true, idempotencyKey: key() });
  return { leadId, jobId: signed.jobId as JobId, estimate, api };
};

describe.skipIf(!url)('forensic lifecycle regressions on PostgreSQL', () => {
  it('refuses a new estimate after signing and preserves the signed lead and approved job takeoff', async () => {
    const { leadId, jobId, estimate, api } = await makeSignedJob();
    const result = await Promise.allSettled([api.finishEstimate({ leadId, actor,
      submission: { ...submission, jobModel: { synthetic: true, revision: 2 }, supersedeExisting: true },
      directLines, measuredLines, feeRateBps: 3000, idempotencyKey: key() })]);
    const lead = await db.query<{ status: string }>('select status from leads where lead_id=$1', [leadId]);
    const takeoff = await db.query<{ status: string }>('select status from takeoff_revisions where revision_id=$1', [estimate.takeoff.revisionId]);
    const job = await db.query<{ current_takeoff_revision_id: string }>('select current_takeoff_revision_id from jobs where job_id=$1', [jobId]);
    expect.soft(result[0]?.status, 'a signed opportunity must reject a new estimate').toBe('rejected');
    expect.soft(lead.rows[0]?.status, 'signed lead status must be retained').toBe('signed');
    expect.soft(takeoff.rows[0]?.status, 'job-bound approved revision must remain approved').toBe('approved');
    expect(job.rows[0]?.current_takeoff_revision_id).toBe(estimate.takeoff.revisionId);
    expect((await db.query('select 1 from proposal_versions where lead_id=$1', [leadId])).rows).toHaveLength(1);
    // A replay of the original design remains valid and returns its signed version.
    const replay = await api.finishEstimate({ leadId, actor, submission, directLines, measuredLines,
      feeRateBps: 3000, idempotencyKey: key() });
    expect(replay.proposal.status).toBe('signed');
    expect(replay.proposal.proposalVersionId).toBe(estimate.proposal.proposalVersionId);
  });

  it('rechecks Gate requirements when a failed evaluation commits after release preflight', async () => {
    const { jobId, api } = await makeSignedJob();
    const inspections = new InspectionService(db);
    for (const { inspectionKey } of await inspections.listInspectionTypes()) {
      await inspections.recordResult({ jobId, inspectionKey, outcome: 'passed', occurredOn: '2026-10-15', actor });
    }
    const gateId = createCanonicalId('gate');
    await api.createGate({ gateInstanceId: gateId, jobId, definitionKey: 'permit' });
    await api.execute(gateId, { type: 'start-gate', actor, at: new Date().toISOString() }, { idempotencyKey: key() });
    const gate = await api.getGate(gateId);
    for (const requirement of gate.requirements.values()) {
      if (requirement.evidenceRequired) {
        const kind = requirement.acceptedEvidenceKinds[0]!;
        const evidence = { evidenceId: createCanonicalId('evidence'), requirementKey: requirement.key, kind,
          storageKey: `${jobId}/permit/${requirement.key}`, sha256: 'a'.repeat(64),
          capturedAt: new Date().toISOString(), mimeType: kind === 'photo' ? 'image/jpeg' : 'application/octet-stream',
          byteSize: 64, metadata: {} };
        await api.execute(gateId, { type: 'add-evidence', actor, at: evidence.capturedAt,
          requirementKey: requirement.key, evidenceId: evidence.evidenceId, kind }, { idempotencyKey: key(), evidence });
      }
      await api.execute(gateId, { type: 'evaluate-requirement', actor, at: new Date().toISOString(),
        requirementKey: requirement.key, outcome: 'passed' }, { idempotencyKey: key() });
    }
    const requirementKey = [...gate.requirements.keys()][0]!;
    let signalPreflight!: () => void;
    let release!: () => void;
    const preflight = new Promise<void>((resolve) => { signalPreflight = resolve; });
    const resume = new Promise<void>((resolve) => { release = resolve; });
    // Pause at transaction entry, after the baseline service has computed its decision.
    // A fixed service should read/decide again after entering this transaction.
    let paused = false;
    const instrumented: Database = {
      query: (sql, params) => db.query(sql, params),
      transaction: async (work) => {
        if (!paused) { paused = true; signalPreflight(); await resume; }
        return db.transaction(work);
      },
    };
    const pending = Promise.allSettled([new GateService(instrumented).execute(gateId,
      { type: 'release-gate', actor, at: new Date().toISOString() }, { idempotencyKey: key() })]);
    await preflight;
    try {
      await api.execute(gateId, { type: 'evaluate-requirement', actor, at: new Date().toISOString(),
        requirementKey, outcome: 'failed', note: 'Synthetic competing failure before release obtains its lock.' },
      { idempotencyKey: key() });
    } finally { release(); }
    const [result] = await pending;
    const final = await api.getGate(gateId);
    expect.soft(result?.status, 'release must fail after a requirement failure commits').toBe('rejected');
    expect.soft(final.status, 'failed checklist must not be released').not.toBe('released');
    expect((await db.query(`select 1 from events where job_id=$1 and event_type='gate.released'`, [jobId])).rows).toHaveLength(0);
  });
});
