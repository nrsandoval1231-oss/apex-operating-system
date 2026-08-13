import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { ActionCardListSchema, createCanonicalId, type ActionCard, type EventActor, type JobId } from '@apex/contracts';
import { GateService } from './index.js';
import { InspectionService } from './inspections.js';

/**
 * The action-card feed over real persisted state.
 *
 * The derivation itself is unit-tested in @apex/domain. What matters here is
 * that the snapshot the service assembles is faithful: requirement progress,
 * evidence completeness, sign-off identity, and unbilled draws all have to be
 * read correctly or the feed lies with a straight face.
 */

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  owner: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  office: createCanonicalId('user'),
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const superintendent: EventActor = { kind: 'user', userId: ids.superintendent, role: 'superintendent' };
const TODAY = '2026-07-31';
const at = '2026-07-29T12:00:00.000Z';

let db: PGlite;
let service: GateService;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Travis'),
     ($2, '00000000-0000-0000-0000-000000000002', 'superintendent', 'Site Super'),
     ($3, '00000000-0000-0000-0000-000000000003', 'office', 'Office User')`,
    [ids.owner, ids.superintendent, ids.office],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'source-cards', 'test:source-cards', '{"customerName":"Whitaker Oasis","city":"Lubbock"}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );
  service = new GateService(db);
});

/**
 * The city's part of a release.
 *
 * §9.7 blocks a Gate until every inspection that gates it has a result, so a
 * test that releases a Gate has to play the inspector too. Driven off
 * `inspection_types` rather than a hard-coded list, so a Gate that gains an
 * inspection later does not silently stop being covered here.
 */
const clearInspections = async (definitionKey: string) => {
  const types = await db.query<{ inspection_key: string }>(
    'select inspection_key from inspection_types where blocks_definition_key = $1',
    [definitionKey],
  );
  const inspections = new InspectionService(db);
  for (const row of types.rows) {
    await inspections.recordResult({
      jobId: ids.job as JobId,
      inspectionKey: row.inspection_key,
      outcome: 'passed',
      occurredOn: '2026-07-29',
      actor: owner,
    });
  }
};

const addApprovedTakeoff = () => db.query(
  `insert into takeoff_revisions
   (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
   values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"fixture.calc"}]', '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
  [ids.revision, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.office],
);

type PhaseKey = NonNullable<Parameters<GateService['openProject']>[0]['initialPhaseKey']>;

const openProject = (phaseKey: PhaseKey) =>
  service.openProject({
    jobId: ids.job, actor: owner, initialPhaseKey: phaseKey,
    superintendentUserId: ids.superintendent, idempotencyKey: `open-${phaseKey}`,
  });

/** Open a Gate and take it as far as `stop`. Re-entrant: opening is idempotent. */
const runGate = async (definitionKey: string, stop: 'started' | 'evidence' | 'ready' | 'signed') => {
  const opened = await service.createGate({
    gateInstanceId: createCanonicalId('gate'), jobId: ids.job, definitionKey,
  });
  const gateInstanceId = opened.gateInstanceId;
  if (opened.status !== 'not-started' && stop === 'started') return gateInstanceId;
  if (opened.status === 'not-started') {
    await service.execute(gateInstanceId, { type: 'start-gate', actor: superintendent, at }, { idempotencyKey: `s-${definitionKey}` });
  }
  if (stop === 'started') return gateInstanceId;

  const gate = await service.getGate(gateInstanceId);
  for (const requirement of gate.requirements.values()) {
    const evidenceId = createCanonicalId('evidence');
    const kind = requirement.acceptedEvidenceKinds[0]!;
    await service.execute(gateInstanceId, {
      type: 'add-evidence', actor: superintendent, at, requirementKey: requirement.key, evidenceId, kind,
    }, {
      idempotencyKey: `e-${definitionKey}-${requirement.key}`,
      evidence: {
        evidenceId, requirementKey: requirement.key, kind,
        storageKey: `${ids.job}/${definitionKey}/${requirement.key}.bin`,
        sha256: 'd'.repeat(64), capturedAt: at, mimeType: 'image/jpeg', byteSize: 64, metadata: {},
      },
    });
  }
  if (stop === 'evidence') return gateInstanceId;

  for (const requirement of (await service.getGate(gateInstanceId)).requirements.values()) {
    await service.execute(gateInstanceId, {
      type: 'evaluate-requirement', actor: superintendent, at, requirementKey: requirement.key, outcome: 'passed',
    }, { idempotencyKey: `p-${definitionKey}-${requirement.key}` });
  }
  if (stop === 'ready') return gateInstanceId;

  await clearInspections(definitionKey);
  await service.execute(gateInstanceId, { type: 'release-gate', actor: superintendent, at }, { idempotencyKey: `r-${definitionKey}` });
  return gateInstanceId;
};

const cards = () => service.getActionCards(TODAY);
const kindsOf = (list: readonly ActionCard[]) => list.map((card) => card.kind);
const byKind = (list: readonly ActionCard[], kind: ActionCard['kind']) => list.find((card) => card.kind === kind);

describe('the feed on a bare signed job', () => {
  it('asks for a takeoff and a project, and nothing it cannot support', async () => {
    const feed = await cards();
    expect(ActionCardListSchema.safeParse(feed).success).toBe(true);
    expect(kindsOf(feed).sort()).toEqual(['project.unopened', 'takeoff.missing']);
    expect(byKind(feed, 'takeoff.missing')?.customerName).toBe('Whitaker Oasis');
  });

  it('drops the takeoff card once one is approved', async () => {
    await addApprovedTakeoff();
    expect(kindsOf(await cards())).not.toContain('takeoff.missing');
  });
});

describe('the feed reads gate progress from the database', () => {
  beforeEach(async () => {
    await addApprovedTakeoff();
    await openProject('layout-excavation');
  });

  it('counts evidence and evaluations separately', async () => {
    await runGate('excavation', 'started');
    const started = byKind(await cards(), 'gate.in-progress');
    expect(started?.title).toBe('Excavation: 0 of 4 clear');
    expect(started?.reason).toMatch(/still need evaluating/i);

    await runGate('excavation', 'evidence');
    const withEvidence = byKind(await cards(), 'gate.in-progress');
    expect(withEvidence?.reason).toMatch(/still need evaluating/i);
  });

  it('turns a fully cleared gate into a sign-off that names its draw', async () => {
    await runGate('excavation', 'ready');
    const ready = byKind(await cards(), 'gate.ready');
    expect(ready).toMatchObject({ group: 'needs-you', urgency: 'important' });
    expect(ready?.reason).toContain('Draw 1');
  });

  it('reads a failed requirement as a blocked gate', async () => {
    const gateInstanceId = await runGate('excavation', 'evidence');
    const gate = await service.getGate(gateInstanceId);
    const first = [...gate.requirements.keys()][0]!;
    await service.execute(gateInstanceId, {
      type: 'evaluate-requirement', actor: superintendent, at, requirementKey: first, outcome: 'failed', note: 'Depth short at the deep end.',
    }, { idempotencyKey: 'fail-excavation' });

    const blocked = byKind(await cards(), 'gate.blocked');
    expect(blocked).toMatchObject({ group: 'needs-you', urgency: 'urgent' });
  });

  it('asks to open the gate for the phase the job is in', async () => {
    const notOpened = (await cards()).filter((card) => card.kind === 'gate.not-opened');
    expect(notOpened.some((card) => card.title.includes('Excavation') && card.group === 'running')).toBe(true);
  });
});

describe('legacy countersign state', () => {
  it('does not create a countersign action card', async () => {
    await addApprovedTakeoff();
    await openProject('gunite');
    await runGate('pre-gunite', 'signed');

    const feed = await cards();
    const card = byKind(feed, 'gate.countersign');
    expect(card).toBeUndefined();
  });
});

describe('the money card', () => {
  beforeEach(async () => {
    await addApprovedTakeoff();
    await openProject('layout-excavation');
  });

  it('appears as soon as a draw-bearing gate releases', async () => {
    await runGate('excavation', 'signed');
    const card = byKind(await cards(), 'draw.uninvoiced');
    // No signed contract on this fixture, so the draw has no amount — and the
    // card says so rather than printing a figure it does not have.
    expect(card?.title).toBe('Bill the Draw 1');
    expect(card?.reason).toMatch(/figure has to come from the contract/i);
    expect(card?.dueLabel).toBe('Billable for 2 days');
  });

  it('does not appear for a gate that bears no draw', async () => {
    await runGate('permit', 'signed');
    expect(kindsOf(await cards())).not.toContain('draw.uninvoiced');
  });

  it('clears once the invoice is recorded', async () => {
    await runGate('excavation', 'signed');
    await db.query(`update job_draws set status = 'invoiced', invoice_reference = 'QB-1041', invoiced_at = now(), invoiced_by = $2 where job_id = $1`, [ids.job, ids.owner]);
    expect(kindsOf(await cards())).not.toContain('draw.uninvoiced');
  });
});

describe('the project record on the feed', () => {
  beforeEach(addApprovedTakeoff);

  it('flags a job nobody is accountable for', async () => {
    await service.openProject({ jobId: ids.job, actor: owner, idempotencyKey: 'open-unassigned' });
    expect(kindsOf(await cards())).toContain('project.unassigned');
  });

  it('escalates a target date that has passed', async () => {
    await openProject('rough-in');
    await db.query(
      `update projects set target_completion_end = '2026-07-24' where job_id = $1`, [ids.job],
    );
    const card = byKind(await cards(), 'project.overdue');
    expect(card).toMatchObject({ urgency: 'urgent', dueLabel: 'Overdue by 7 days' });
    expect(card?.reason).toContain('Plumbing & Electrical Rough-In');
  });

  it('surfaces a recorded risk without demanding an action', async () => {
    await openProject('decking');
    await db.query(`update projects set risk_note = 'Tile selection outstanding.' where job_id = $1`, [ids.job]);
    expect(byKind(await cards(), 'project.risk')).toMatchObject({
      group: 'running', reason: 'Tile selection outstanding.',
    });
  });
});

describe('the feed as the owner sees it', () => {
  it('goes quiet on a job that is finished', async () => {
    await addApprovedTakeoff();
    await openProject('plaster-fill');
    await db.query(`update jobs set status = 'complete' where job_id = $1`, [ids.job]);
    expect(await cards()).toEqual([]);
  });

  it('is reproducible for a given day', async () => {
    await addApprovedTakeoff();
    await openProject('gunite');
    await runGate('pre-gunite', 'signed');
    const first = await service.getActionCards(TODAY);
    const second = await service.getActionCards(TODAY);
    expect(first.map((card) => card.cardId)).toEqual(second.map((card) => card.cardId));
  });
});
