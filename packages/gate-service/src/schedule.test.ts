import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, type EventActor } from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { GateService } from './index.js';

/**
 * Subcontractor visits and crew conflicts over real persisted state — PRD §9.6.
 *
 * The detection itself is unit-tested in @apex/domain. What matters here is
 * that a double-booking is visible across jobs, that moving a visit is kept
 * rather than overwritten, and that conflicts reach the action feed.
 */

const ids = {
  leadA: createCanonicalId('lead'),
  leadB: createCanonicalId('lead'),
  jobA: createCanonicalId('job'),
  jobB: createCanonicalId('job'),
  revisionA: createCanonicalId('revision'),
  owner: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  office: createCanonicalId('user'),
  field: createCanonicalId('user'),
  gunite: createCanonicalId('sub'),
  plumber: createCanonicalId('sub'),
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const fieldActor: EventActor = { kind: 'user', userId: ids.field, role: 'field' };

let db: PGlite;
let service: GateService;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Travis'),
     ($2, '00000000-0000-0000-0000-000000000002', 'superintendent', 'Site Super'),
     ($3, '00000000-0000-0000-0000-000000000003', 'office', 'Office User'),
     ($4, '00000000-0000-0000-0000-000000000004', 'field', 'Field Lead')`,
    [ids.owner, ids.superintendent, ids.office, ids.field],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload) values
     ($1, 'test', 'sched-a', 'test:sched-a', '{"customerName":"Whitaker Oasis"}'),
     ($2, 'test', 'sched-b', 'test:sched-b', '{"customerName":"Mike Johnson"}')`,
    [ids.leadA, ids.leadB],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values
     ($1, $2, 1, 'active'), ($3, $4, 1, 'active')`,
    [ids.jobA, ids.leadA, ids.jobB, ids.leadB],
  );
  await db.query(
    `insert into takeoff_revisions
     (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"fixture.calc"}]', '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
    [ids.revisionA, ids.jobA, 'a'.repeat(64), 'b'.repeat(64), ids.office],
  );
  await db.query(
    `insert into subcontractors (subcontractor_id, name, trade) values
     ($1, 'Lubbock Gunite', 'Gunite'), ($2, 'West Texas Plumbing', 'Plumbing')`,
    [ids.gunite, ids.plumber],
  );
  service = new GateService(db);
});

/** Only the crew clashes on a job, ignoring any gate conflict on the same visit. */
const doubleBookings = async (jobId: string) =>
  (await service.getJobVisitConflicts(jobId as never)).filter((c) => c.kind === 'crew-double-booked');

const book = (jobId: string, overrides: Partial<Parameters<GateService['scheduleVisit']>[0]> = {}) =>
  service.scheduleVisit({
    jobId: jobId as never,
    subcontractorId: ids.gunite,
    phaseKey: 'gunite',
    startsOn: '2026-08-10',
    endsOn: '2026-08-10',
    actor: owner,
    ...overrides,
  });

describe('booking a crew', () => {
  it('stores the visit with the crew and trade resolved', async () => {
    const visit = await book(ids.jobA);
    expect(visit).toMatchObject({
      jobId: ids.jobA,
      subcontractorName: 'Lubbock Gunite',
      trade: 'Gunite',
      phaseKey: 'gunite',
      status: 'planned',
      rescheduleCount: 0,
    });
  });

  it('refuses a visit that ends before it starts', async () => {
    await expect(book(ids.jobA, { startsOn: '2026-08-12', endsOn: '2026-08-10' }))
      .rejects.toThrow(/cannot end before it starts/i);
  });

  it('is closed to the field lead, who does not commit other people’s time', async () => {
    await expect(book(ids.jobA, { actor: fieldActor })).rejects.toThrow(/may not schedule/i);
  });

  it('stores a conflicting booking rather than refusing it', async () => {
    await book(ids.jobA);
    // The crew genuinely is double-booked the moment someone writes it down.
    // Refusing the write would leave that fact outside the system.
    const second = await book(ids.jobB);
    expect(second.jobId).toBe(ids.jobB);
    expect(await doubleBookings(ids.jobA)).toHaveLength(1);
  });
});

describe('detecting a double-booking across jobs', () => {
  it('shows the conflict on both jobs', async () => {
    await book(ids.jobA);
    await book(ids.jobB);
    expect(await doubleBookings(ids.jobA)).toHaveLength(1);
    expect(await doubleBookings(ids.jobB)).toHaveLength(1);
  });

  it('names the other customer', async () => {
    await book(ids.jobA);
    await book(ids.jobB);
    const [conflict] = await service.getJobVisitConflicts(ids.jobA as never);
    expect(conflict?.kind === 'crew-double-booked' && conflict.otherJobName).toBe('Mike Johnson');
  });

  it('clears once one of the two is moved out of the way', async () => {
    await book(ids.jobA);
    const second = await book(ids.jobB);
    await service.rescheduleVisit({
      visitId: second.visitId, startsOn: '2026-08-20', endsOn: '2026-08-20', actor: owner,
    });
    // The gate conflict survives; only the clash is gone.
    expect(await doubleBookings(ids.jobA)).toEqual([]);
  });

  it('clears when one is cancelled', async () => {
    await book(ids.jobA);
    const second = await book(ids.jobB);
    await db.query(`update scheduled_visits set status = 'cancelled' where visit_id = $1`, [second.visitId]);
    expect(await doubleBookings(ids.jobA)).toEqual([]);
  });
});

describe('work booked before its gate', () => {
  it('flags a gunite visit while pre-gunite is unreleased', async () => {
    await book(ids.jobA);
    const conflicts = await service.getJobVisitConflicts(ids.jobA as never);
    expect(conflicts.map((c) => c.kind)).toContain('before-gate');
    const gated = conflicts.find((c) => c.kind === 'before-gate');
    expect(gated?.kind === 'before-gate' && gated.gateTitle).toBe('Pre-gunite hold point');
  });

  it('says nothing about a phase no gate guards', async () => {
    await book(ids.jobA, { phaseKey: 'design-permitting' });
    expect(await service.getJobVisitConflicts(ids.jobA as never)).toEqual([]);
  });
});

describe('moving a visit', () => {
  it('refuses to move gunite across multiple days', async () => {
    const visit = await book(ids.jobA);
    await expect(service.rescheduleVisit({
      visitId: visit.visitId, startsOn: '2026-08-17', endsOn: '2026-08-18', actor: owner,
    })).rejects.toThrow(/one-day activity/i);
  });

  it('keeps the move rather than overwriting the dates', async () => {
    const visit = await book(ids.jobA, { phaseKey: 'design-permitting' });
    const moved = await service.rescheduleVisit({
      visitId: visit.visitId, startsOn: '2026-08-17', endsOn: '2026-08-18',
      actor: owner, reason: 'Rain.',
    });
    expect(moved).toMatchObject({ startsOn: '2026-08-17', endsOn: '2026-08-18', rescheduleCount: 1 });

    const history = await db.query<{ from_starts_on: string | Date; reason: string }>(
      'select from_starts_on, reason from visit_reschedules where visit_id = $1', [visit.visitId],
    );
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0]?.reason).toBe('Rain.');
  });

  it('keeps the history append-only', async () => {
    const visit = await book(ids.jobA);
    await service.rescheduleVisit({ visitId: visit.visitId, startsOn: '2026-08-17', endsOn: '2026-08-17', actor: owner });
    await expect(db.query('delete from visit_reschedules')).rejects.toThrow(/append-only/i);
  });

  it('refuses a move to the dates it is already on', async () => {
    const visit = await book(ids.jobA);
    await expect(service.rescheduleVisit({
      visitId: visit.visitId, startsOn: '2026-08-10', endsOn: '2026-08-10', actor: owner,
    })).rejects.toThrow(/already on those dates/i);
  });

  it('refuses to move completed work', async () => {
    const visit = await book(ids.jobA);
    await db.query(`update scheduled_visits set status = 'done' where visit_id = $1`, [visit.visitId]);
    await expect(service.rescheduleVisit({
      visitId: visit.visitId, startsOn: '2026-08-17', endsOn: '2026-08-17', actor: owner,
    })).rejects.toThrow(DomainRuleError);
  });

  it('is closed to the field lead', async () => {
    const visit = await book(ids.jobA);
    await expect(service.rescheduleVisit({
      visitId: visit.visitId, startsOn: '2026-08-17', endsOn: '2026-08-17', actor: fieldActor,
    })).rejects.toThrow(/may not move/i);
  });
});

describe('conflicts on the action feed', () => {
  it('puts a double-booking in front of the owner as urgent', async () => {
    await book(ids.jobA);
    await book(ids.jobB);
    const cards = await service.getActionCards('2026-08-02');
    // A double-booking raises a card on BOTH jobs — an owner looking at either
    // one has to see it. Picking the first card of that kind therefore depends
    // on which job id happens to sort first, so this names the job it means.
    const conflict = cards.find(
      (card) => card.kind === 'schedule.crew-conflict' && card.jobId === ids.jobA,
    );
    expect(conflict).toMatchObject({ group: 'needs-you', urgency: 'urgent' });
    expect(conflict?.title).toContain('Lubbock Gunite');
    expect(conflict?.reason).toContain('Mike Johnson');
    expect(cards.filter((card) => card.kind === 'schedule.crew-conflict')).toHaveLength(2);
  });

  it('puts work booked ahead of its gate in front of the owner', async () => {
    await book(ids.jobA);
    const cards = await service.getActionCards('2026-08-02');
    expect(cards.find((card) => card.kind === 'schedule.before-gate'))
      .toMatchObject({ group: 'needs-you', urgency: 'urgent' });
  });

  it('lists a clean upcoming visit under this week rather than as a task', async () => {
    // Design and permitting is guarded by nothing, so this visit is clean.
    await book(ids.jobA, { phaseKey: 'design-permitting', startsOn: '2026-08-05', endsOn: '2026-08-05' });
    const cards = await service.getActionCards('2026-08-02');
    const upcoming = cards.find((card) => card.kind === 'schedule.upcoming');
    expect(upcoming).toMatchObject({ group: 'this-week', urgency: 'routine' });
    expect(upcoming?.dueLabel).toContain('in 3 days');
  });

  it('says nothing about a visit further out than a week', async () => {
    await book(ids.jobA, { phaseKey: 'design-permitting', startsOn: '2026-09-20', endsOn: '2026-09-20' });
    const cards = await service.getActionCards('2026-08-02');
    expect(cards.map((card) => card.kind)).not.toContain('schedule.upcoming');
  });
});
