import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, type EventActor, type JobId } from '@apex/contracts';
import { GateService } from './index.js';
import { InspectionService } from './inspections.js';

/**
 * Inspections over real persisted state — PRD §9.7.
 *
 * The deadline arithmetic is unit-tested in @apex/domain. What matters here is
 * the part only the database can answer: where a deadline comes from when
 * nobody typed one, that a failure is never erased by a later pass, and that a
 * Gate actually refuses to release.
 */

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  owner: createCanonicalId('user'),
  field: createCanonicalId('user'),
  office: createCanonicalId('user'),
  gunite: createCanonicalId('sub'),
};

const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const customer: EventActor = { kind: 'user', userId: ids.owner, role: 'customer' };

let db: PGlite;
let service: GateService;
let inspections: InspectionService;

const jobId = ids.job as JobId;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Travis'),
     ($2, '00000000-0000-0000-0000-000000000002', 'field', 'Field Lead'),
     ($3, '00000000-0000-0000-0000-000000000003', 'office', 'Office User')`,
    [ids.owner, ids.field, ids.office],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'insp', 'test:insp', '{"customerName":"Whitaker Oasis"}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );
  await db.query(
    `insert into takeoff_revisions
     (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"f"}]', '[{"id":"f","label":"F","formula":"Q=1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
    [ids.revision, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.office],
  );
  await db.query(
    `insert into projects (job_id, current_phase_key, created_by) values ($1, 'steel-reinforcement', $2)`,
    [ids.job, ids.owner],
  );
  await db.query(
    `insert into subcontractors (subcontractor_id, name, trade) values ($1, 'Lubbock Gunite', 'Gunite')`,
    [ids.gunite],
  );
  service = new GateService(db);
  inspections = new InspectionService(db);
});

const find = async (key: string) =>
  (await inspections.listJobInspections(jobId)).find((row) => row.inspectionKey === key);

/** Book the gunite crew, which is what gives the pre-gunite inspections a date. */
const bookGunite = (startsOn: string) => service.scheduleVisit({
  jobId,
  subcontractorId: ids.gunite,
  phaseKey: 'gunite',
  startsOn,
  endsOn: startsOn,
  actor: owner,
});

describe('the inspection list', () => {
  it('is the seven from the approved list, fixed by migration', async () => {
    const types = await inspections.listInspectionTypes();
    expect(types).toHaveLength(7);
    expect(types.map((type) => type.inspectionKey)).toEqual([
      'pool-steel-structural', 'equipotential-bonding', 'plumbing-pressure-test',
      'deck-pre-pour', 'gas-line-pressure-test', 'electrical-final', 'final-safety-barrier',
    ]);
  });

  it('cannot be changed by statement', async () => {
    await expect(db.query(
      `insert into inspection_types (inspection_key, sequence, title, phase_key, requested_by,
        lead_time_business_days, blocks_definition_key, request_method, authority)
       values ('invented', 99, 'Invented', 'gunite', 'apex', 1, 'final', 'x', 'y')`,
    )).rejects.toThrow(/fixed by/i);
  });

  it('returns all seven on a job even when nothing has been recorded', async () => {
    const all = await inspections.listJobInspections(jobId);
    expect(all).toHaveLength(7);
    // Not requested is a state, not a missing row.
    expect(all.every((row) => row.status === null && row.inspectionId === null)).toBe(true);
  });
});

describe('where a deadline comes from', () => {
  it('has none until a crew is booked into the work it gates', async () => {
    const steel = await find('pool-steel-structural');
    expect(steel?.neededBy).toBeNull();
    expect(steel?.lastSafeRequestOn).toBeNull();
    expect(steel?.neededBySource).toBeNull();
  });

  it('derives one from the earliest live booking in the blocked gate’s phase', async () => {
    await bookGunite('2026-08-13');
    const steel = await find('pool-steel-structural');
    expect(steel?.neededBy).toBe('2026-08-13');
    expect(steel?.neededBySource).toBe('crew-booking');
    // Two business days back from Thursday 13 August is Tuesday 11 August.
    expect(steel?.lastSafeRequestOn).toBe('2026-08-11');
  });

  it('prefers a date somebody recorded over the booking', async () => {
    await bookGunite('2026-08-13');
    await inspections.requestInspection({
      jobId, inspectionKey: 'pool-steel-structural',
      requestedOn: '2026-08-04', neededBy: '2026-08-10', actor: owner,
    });
    const steel = await find('pool-steel-structural');
    expect(steel?.neededBy).toBe('2026-08-10');
    expect(steel?.neededBySource).toBe('recorded');
  });

  it('ignores a cancelled booking, which is not a commitment to a date', async () => {
    const visit = await bookGunite('2026-08-13');
    await db.query('update scheduled_visits set status = $2 where visit_id = $1', [visit.visitId, 'cancelled']);
    expect((await find('pool-steel-structural'))?.neededBy).toBeNull();
  });
});

describe('recording an inspection', () => {
  it('moves from requested to scheduled to passed', async () => {
    await inspections.requestInspection({
      jobId, inspectionKey: 'pool-steel-structural', requestedOn: '2026-08-04', actor: owner,
    });
    expect((await find('pool-steel-structural'))?.status).toBe('requested');

    await inspections.requestInspection({
      jobId, inspectionKey: 'pool-steel-structural',
      requestedOn: '2026-08-04', scheduledFor: '2026-08-06', actor: owner,
    });
    expect((await find('pool-steel-structural'))?.status).toBe('scheduled');

    await inspections.recordResult({
      jobId, inspectionKey: 'pool-steel-structural',
      outcome: 'passed', occurredOn: '2026-08-06', actor: owner,
    });
    expect((await find('pool-steel-structural'))?.status).toBe('passed');
  });

  it('refuses a failure that does not say what has to be corrected', async () => {
    await expect(inspections.recordResult({
      jobId, inspectionKey: 'pool-steel-structural',
      outcome: 'failed', occurredOn: '2026-08-06', actor: owner,
    })).rejects.toThrow(/what must be corrected/i);
  });

  it('refuses a waiver that does not say why', async () => {
    await expect(inspections.recordResult({
      jobId, inspectionKey: 'gas-line-pressure-test',
      outcome: 'waived', occurredOn: '2026-08-06', actor: owner,
    })).rejects.toThrow(/why it does not apply/i);
  });

  it('keeps the failure after a later pass', async () => {
    await inspections.recordResult({
      jobId, inspectionKey: 'pool-steel-structural', outcome: 'failed',
      occurredOn: '2026-08-06', corrections: 'Add chairs under the deep-end mat', actor: owner,
    });
    await inspections.recordResult({
      jobId, inspectionKey: 'pool-steel-structural', outcome: 'passed',
      occurredOn: '2026-08-10', note: 'Chairs added', actor: owner,
    });

    const steel = await find('pool-steel-structural');
    expect(steel?.status).toBe('passed');
    // What was wrong is exactly what somebody wants six months later.
    expect(steel?.failureCount).toBe(1);
    expect(steel?.corrections).toBe('Add chairs under the deep-end mat');

    const history = await inspections.listResults(jobId, 'pool-steel-structural');
    expect(history.map((row) => row.outcome)).toEqual(['failed', 'passed']);
  });

  it('keeps the result history append-only', async () => {
    await inspections.recordResult({
      jobId, inspectionKey: 'pool-steel-structural', outcome: 'passed',
      occurredOn: '2026-08-06', actor: owner,
    });
    await expect(db.query('delete from inspection_results')).rejects.toThrow(/append-only/i);
  });

  it('accepts a result on an inspection nobody recorded requesting', async () => {
    // Usually a waiver. Refusing it would push the fact outside the system.
    const waived = await inspections.recordResult({
      jobId, inspectionKey: 'gas-line-pressure-test', outcome: 'waived',
      occurredOn: '2026-08-06', note: 'Electric heat pump — no gas on this pool', actor: owner,
    });
    expect(waived.status).toBe('waived');
  });

  it('is closed to a customer', async () => {
    await expect(inspections.requestInspection({
      jobId, inspectionKey: 'pool-steel-structural', requestedOn: '2026-08-04', actor: customer,
    })).rejects.toThrow(/may not record an inspection/i);
  });
});

describe('a gate that the city has not cleared', () => {
  const at = '2026-08-06T12:00:00.000Z';

  /**
   * Take pre-gunite all the way to the point of release: every requirement has
   * evidence and has passed, and the actor is authorized. The ONLY thing left
   * in the way is the city.
   *
   * Doing the full checklist matters. The inspection guard runs after the pure
   * engine has approved authority and requirements, so a half-finished Gate
   * would fail on its checklist and prove nothing about inspections.
   */
  const preGuniteReadyToRelease = async () => {
    const gate = await service.createGate({
      gateInstanceId: createCanonicalId('gate'), jobId, definitionKey: 'pre-gunite',
    });
    const gateId = gate.gateInstanceId;
    await service.execute(gateId, { type: 'start-gate', actor: owner, at }, {
      idempotencyKey: 'insp-start-0001',
    });
    for (const requirement of gate.requirements.values()) {
      const evidenceId = createCanonicalId('evidence');
      const kind = requirement.acceptedEvidenceKinds[0]!;
      await service.execute(gateId, {
        type: 'add-evidence', actor: owner, at, requirementKey: requirement.key, evidenceId, kind,
      }, {
        idempotencyKey: `insp-ev-${requirement.key}`,
        evidence: {
          evidenceId, requirementKey: requirement.key, kind,
          storageKey: `${ids.job}/pre-gunite/${requirement.key}.bin`,
          sha256: 'd'.repeat(64), capturedAt: at, mimeType: 'image/jpeg', byteSize: 128, metadata: {},
        },
      });
      await service.execute(gateId, {
        type: 'evaluate-requirement', actor: owner, at, requirementKey: requirement.key, outcome: 'passed',
      }, { idempotencyKey: `insp-pass-${requirement.key}` });
    }
    return gateId;
  };

  const passAllPreGuniteInspections = async () => {
    for (const key of ['pool-steel-structural', 'equipotential-bonding', 'plumbing-pressure-test']) {
      await inspections.recordResult({
        jobId, inspectionKey: key, outcome: 'passed', occurredOn: '2026-08-06', actor: owner,
      });
    }
  };

  it('refuses a release that is otherwise perfect, naming what is outstanding', async () => {
    const gateId = await preGuniteReadyToRelease();
    await expect(service.execute(gateId, { type: 'release-gate', actor: owner, at }, {
      idempotencyKey: 'insp-release-0001',
    })).rejects.toThrow(/cannot release until its inspections have passed/i);
  });

  it('names an inspection nobody has requested, not just a failed one', async () => {
    const gateId = await preGuniteReadyToRelease();
    // The dangerous case: nothing on record at all. A system that only looked
    // at recorded rows would let the pour proceed.
    await expect(service.execute(gateId, { type: 'release-gate', actor: owner, at }, {
      idempotencyKey: 'insp-release-0002',
    })).rejects.toThrow(/not requested/i);
  });

  it('lets the release through once every one has passed', async () => {
    const gateId = await preGuniteReadyToRelease();
    await passAllPreGuniteInspections();
    const result = await service.execute(gateId, { type: 'release-gate', actor: owner, at }, {
      idempotencyKey: 'insp-release-0003',
    });
    expect(result.state.status).toBe('released');
  });

  it('accepts a waiver in place of a pass', async () => {
    const gateId = await preGuniteReadyToRelease();
    await inspections.recordResult({
      jobId, inspectionKey: 'pool-steel-structural', outcome: 'passed',
      occurredOn: '2026-08-06', actor: owner,
    });
    await inspections.recordResult({
      jobId, inspectionKey: 'equipotential-bonding', outcome: 'passed',
      occurredOn: '2026-08-06', actor: owner,
    });
    await inspections.recordResult({
      jobId, inspectionKey: 'plumbing-pressure-test', outcome: 'waived',
      occurredOn: '2026-08-06', note: 'Combined into the structural visit by the city', actor: owner,
    });
    const result = await service.execute(gateId, { type: 'release-gate', actor: owner, at }, {
      idempotencyKey: 'insp-release-0004',
    });
    expect(result.state.status).toBe('released');
  });

  it('refuses an unauthorized release without mentioning inspections at all', async () => {
    const gateId = await preGuniteReadyToRelease();
    // Someone with no authority to release must be told exactly that, and must
    // not learn the job's inspection state on the way to being refused.
    await expect(service.execute(gateId, {
      type: 'release-gate', actor: { kind: 'user', userId: ids.field, role: 'field' }, at,
    }, { idempotencyKey: 'insp-release-0005' })).rejects.toThrow(/not authorized/i);
  });

  it('does not block a gate whose inspections belong to a different one', async () => {
    // Deck pre-pour blocks deck-tile, not permit. A guard that blocked
    // everything would be indistinguishable from a broken system.
    expect(await inspections.blockingFor(jobId, 'permit')).toHaveLength(0);
  });
});

describe('the action feed', () => {
  it('says nothing while there is no deadline to miss', async () => {
    const cards = await service.getActionCards('2026-08-03');
    expect(cards.filter((card) => card.kind.startsWith('inspection.'))).toHaveLength(0);
  });

  it('raises an urgent card on the last safe day', async () => {
    await bookGunite('2026-08-13');
    const cards = await service.getActionCards('2026-08-11');
    const due = cards.filter((card) => card.kind === 'inspection.due');
    // All three pre-gunite inspections share the deadline.
    expect(due).toHaveLength(3);
    expect(due[0]).toMatchObject({ group: 'needs-you', urgency: 'urgent' });
    expect(due[0]?.reason).toMatch(/Pre-gunite hold point/);
  });

  it('raises nothing before the last safe day', async () => {
    await bookGunite('2026-08-13');
    const cards = await service.getActionCards('2026-08-05');
    expect(cards.filter((card) => card.kind.startsWith('inspection.'))).toHaveLength(0);
  });

  it('turns overdue the day after', async () => {
    await bookGunite('2026-08-13');
    const cards = await service.getActionCards('2026-08-12');
    expect(cards.filter((card) => card.kind === 'inspection.overdue')).toHaveLength(3);
  });

  it('clears once the inspection passes', async () => {
    await bookGunite('2026-08-13');
    for (const key of ['pool-steel-structural', 'equipotential-bonding', 'plumbing-pressure-test']) {
      await inspections.recordResult({
        jobId, inspectionKey: key, outcome: 'passed', occurredOn: '2026-08-10', actor: owner,
      });
    }
    const cards = await service.getActionCards('2026-08-12');
    expect(cards.filter((card) => card.kind.startsWith('inspection.'))).toHaveLength(0);
  });

  it('keeps a failed inspection in front of the owner regardless of slack', async () => {
    await bookGunite('2026-08-28');
    await inspections.recordResult({
      jobId, inspectionKey: 'pool-steel-structural', outcome: 'failed',
      occurredOn: '2026-08-06', corrections: 'Add chairs under the deep-end mat', actor: owner,
    });
    const cards = await service.getActionCards('2026-08-07');
    const failed = cards.find((card) => card.kind === 'inspection.failed');
    expect(failed).toMatchObject({ urgency: 'urgent' });
    expect(failed?.reason).toMatch(/corrected and re-inspected/i);
  });
});
