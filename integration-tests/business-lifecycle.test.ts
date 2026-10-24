import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCanonicalId, type AuthoritativeQuantity, type EventActor, type JobId } from '../packages/contracts/src/index.ts';
import { PostgresDatabase, applyOperationalMigrations } from '../packages/database/src/index.ts';
import { MEASURED_LINE_DEFINITIONS, type DirectPriceInput } from '../packages/pricing-engine/src/index.ts';
import { CustomerService, GateService, InspectionService, WorkspaceService } from '../packages/gate-service/src/index.ts';

const url = process.env.DATABASE_URL?.trim();
const available = Boolean(url);
let db: PostgresDatabase;
const ids = { lead: createCanonicalId('lead'), user: createCanonicalId('user') };
const actor: EventActor = { kind: 'user', userId: ids.user, role: 'admin' };

beforeAll(async () => {
  if (!available) return;
  db = PostgresDatabase.create({ url: url!, applicationName: 'apex-business-lifecycle-test', maxConnections: 8 });
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
  await db.query(`insert into app_users(user_id,auth_user_id,role,display_name)
    values($1,gen_random_uuid(),'admin','Lifecycle Regression') on conflict(user_id) do nothing`, [ids.user]);
  await db.query(`insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload)
    values($1,'synthetic-lifecycle',$2,$3,$4::jsonb)`, [ids.lead, ids.lead, `lifecycle:${ids.lead}`,
    JSON.stringify({ customerName: 'Synthetic Lifecycle', vertical: 'Designer Pools', streetAddress: '1 Regression Way' })]);
});
afterAll(async () => { if (available && db) await db.close(); });

const service = () => new GateService(db);
const key = (...parts: string[]) => ['lifecycle', ids.lead, ...parts].join(':');
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

describe.skipIf(!available)('business lifecycle on PostgreSQL', () => {
  it('takes one synthetic opportunity through signed construction, invoice references and closeout', async () => {
    const api = service();
    const blocked = await api.finishEstimate({ leadId: ids.lead, actor, submission, directLines: [], measuredLines: [], feeRateBps: 3000, idempotencyKey: key('missing-price') });
    expect(blocked.proposal.status).toBe('draft');
    expect(blocked.blockers).toContainEqual(expect.objectContaining({ code: 'missing-direct-price' }));
    await expect(api.signProposal({ proposalVersionId: blocked.proposal.proposalVersionId, expectedVersionNumber: 1,
      expectedDraftRevision: 1, actor, customerAcceptanceConfirmed: true, idempotencyKey: key('sign-blocked') })).rejects.toThrow();
    expect((await db.query('select 1 from jobs where lead_id=$1', [ids.lead])).rows).toHaveLength(0);

    const priced = await api.finishEstimate({ leadId: ids.lead, actor, submission, directLines, measuredLines, feeRateBps: 3000, idempotencyKey: key('priced') });
    expect(priced.blockers).toEqual([]);
    expect(priced.proposal.status).toBe('issued');
    const signed = await api.signProposal({ proposalVersionId: priced.proposal.proposalVersionId, expectedVersionNumber: 1,
      expectedDraftRevision: priced.proposal.draftRevision, actor, customerAcceptanceConfirmed: true, idempotencyKey: key('sign') });
    const retry = await api.signProposal({ proposalVersionId: priced.proposal.proposalVersionId, expectedVersionNumber: 1,
      expectedDraftRevision: priced.proposal.draftRevision, actor, customerAcceptanceConfirmed: true, idempotencyKey: key('sign-retry') });
    expect(retry.jobId).toBe(signed.jobId);
    const jobId = signed.jobId as JobId;
    expect((await db.query('select job_id from jobs where lead_id=$1', [ids.lead])).rows).toHaveLength(1);
    expect((await db.query('select job_id from projects where job_id=$1', [jobId])).rows).toHaveLength(1);

    const schedule = await api.createDrawSchedule({ jobId, actor, idempotencyKey: key(jobId, 'draw-schedule') });
    expect(schedule.collectedCents).toBeNull();
    await api.markDrawInvoiced({ jobId, drawCode: 'deposit', invoiceReference: `SYN-${jobId}-deposit`, actor });

    const inspections = new InspectionService(db);
    const inspectionKeys = (await inspections.listInspectionTypes()).map((row) => row.inspectionKey);
    for (const inspectionKey of inspectionKeys) await inspections.recordResult({
      jobId, inspectionKey, outcome: 'passed', occurredOn: '2026-10-15', actor,
    });

    // Drive every currently scope-required active Gate through its service API.
    // Requirement keys and accepted evidence kinds are read from the persisted definition;
    // the test records synthetic evidence and explicit evaluations rather than editing state.
    for (const entry of await api.listJobGates(jobId)) {
      const gateId = createCanonicalId('gate');
      let gate = await api.createGate({ gateInstanceId: gateId, jobId, definitionKey: entry.definitionKey });
      await api.execute(gateId, { type: 'start-gate', actor, at: '2026-10-15T12:00:00.000Z' }, { idempotencyKey: key(jobId, gateId, 'start', entry.definitionKey) });
      gate = await api.getGate(gateId);
      for (const requirement of gate.requirements.values()) {
        if (requirement.evidenceRequired) {
          const kind = requirement.acceptedEvidenceKinds[0]!;
          const evidence = { evidenceId: createCanonicalId('evidence'), requirementKey: requirement.key, kind,
            storageKey: `${jobId}/${entry.definitionKey}/${requirement.key}`, sha256: 'a'.repeat(64),
            capturedAt: '2026-10-15T12:01:00.000Z', mimeType: kind === 'photo' ? 'image/jpeg' : 'application/octet-stream',
            byteSize: 64, metadata: {} };
          await api.execute(gateId, { type: 'add-evidence', actor, at: evidence.capturedAt, requirementKey: requirement.key,
            evidenceId: evidence.evidenceId, kind }, { idempotencyKey: key(jobId, gateId, 'evidence', entry.definitionKey, requirement.key), evidence });
        }
        await api.execute(gateId, { type: 'evaluate-requirement', actor, at: '2026-10-15T12:02:00.000Z',
          requirementKey: requirement.key, outcome: 'passed' }, { idempotencyKey: key(jobId, gateId, 'pass', entry.definitionKey, requirement.key) });
      }
      await api.execute(gateId, { type: 'release-gate', actor, at: '2026-10-15T12:03:00.000Z' }, { idempotencyKey: key(jobId, gateId, 'release', entry.definitionKey) });
      const released = await api.getGate(gateId);
      expect(released.status).toBe('released');
      if (entry.drawCode) await api.markDrawInvoiced({ jobId, drawCode: entry.drawCode,
        invoiceReference: `SYN-${jobId}-${entry.drawCode}`, actor });
    }

    // Traverse remaining project phases through the project command, recording why the
    // synthetic crew is treated as having completed each intervening phase.
    const phases = ['design-permitting','layout-excavation','steel-reinforcement','rough-in','gunite','tile-coping','decking','equipment-hookup','automation-programming','cover-install','plaster-fill'] as const;
    for (let index = 1; index < phases.length; index++) {
      const project = await api.getProject(jobId);
      if (project?.currentPhaseKey === phases[index]) continue;
      await api.changeProjectPhase(jobId, { actor, at: '2026-10-15T12:10:00.000Z', toPhaseKey: phases[index],
        reason: `Synthetic lifecycle fixture records completion of ${phases[index - 1]}.` }, { idempotencyKey: key(jobId, 'phase', phases[index]) });
    }
    const complete = await api.completeJob({ jobId, actor, idempotencyKey: key(jobId, 'complete') });
    expect(complete.status).toBe('complete');
    expect((await new CustomerService(db).previewPage(jobId)).milestones.find((item) => item.key === 'handover')?.state).toBe('current');
    expect((await api.getJobCloseout(jobId)).ready).toBe(true);
    expect((await api.closeJob({ jobId, actor, idempotencyKey: key(jobId, 'close') })).status).toBe('closed');
    await expect(api.createGate({ gateInstanceId: createCanonicalId('gate'), jobId, definitionKey: 'permit' })).rejects.toThrow(/closed or cancelled/i);
    expect((await api.listJobs('historical')).map((item) => item.jobId)).toContain(jobId);
    expect((await api.getProjectPhaseHistory(jobId)).length).toBeGreaterThan(1);
    expect((await db.query('select count(*)::int as count from evidence_records where job_id=$1', [jobId])).rows[0]?.count).toBeGreaterThan(0);
    const workspace = (await new WorkspaceService(db).list(actor)).find(item => item.jobId === jobId);
    expect(workspace).toMatchObject({ division: 'Designer Pools', stageCatalog: 'pools', gates: { released: 7, required: 7 }, proposalVersionId: signed.proposal.proposalVersionId });
  });
});
