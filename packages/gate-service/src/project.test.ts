import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, type EventActor } from '@apex/contracts';
import { PhaseRuleError } from '@apex/domain';
import { GateService } from './index.js';

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  owner: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  office: createCanonicalId('user'),
  field: createCanonicalId('user'),
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const superintendent: EventActor = { kind: 'user', userId: ids.superintendent, role: 'superintendent' };
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
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'source-project', 'test:source-project', '{"customerName":"Whitaker"}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );
  service = new GateService(db);
});

const open = (overrides: Partial<Parameters<GateService['openProject']>[0]> = {}) =>
  service.openProject({ jobId: ids.job, actor: owner, idempotencyKey: 'open-project-key', ...overrides });

describe('opening a construction project', () => {
  it('starts at design and permitting and records the opening position', async () => {
    const project = await open();
    expect(project).toMatchObject({
      currentPhaseKey: 'design-permitting',
      currentPhaseSequence: 1,
      customerMilestone: 'design',
      superintendentUserId: null,
    });

    const history = await service.getProjectPhaseHistory(ids.job);
    expect(history).toEqual([expect.objectContaining({
      fromPhaseKey: null,
      toPhaseKey: 'design-permitting',
      actorUserId: ids.owner,
      reason: null,
    })]);
  });

  it('emits project.created against the job', async () => {
    await open();
    const events = await db.query<{ event_type: string; payload: Record<string, unknown> }>(
      `select event_type, payload from events where job_id = $1`,
      [ids.job],
    );
    expect(events.rows).toEqual([expect.objectContaining({ event_type: 'project.created' })]);
    expect(events.rows[0]?.payload).toMatchObject({ initialPhaseKey: 'design-permitting' });
  });

  it('is idempotent — reopening returns the existing project without resetting it', async () => {
    await open();
    await service.changeProjectPhase(ids.job, {
      actor: owner, at: new Date().toISOString(), toPhaseKey: 'layout-excavation',
    }, { idempotencyKey: 'advance-to-excavation' });

    const reopened = await open({ idempotencyKey: 'a-different-key' });
    expect(reopened.currentPhaseKey).toBe('layout-excavation');
    const history = await service.getProjectPhaseHistory(ids.job);
    expect(history).toHaveLength(2);
  });

  it('may be opened mid-build when a live job is imported', async () => {
    const project = await open({ initialPhaseKey: 'rough-in' });
    expect(project).toMatchObject({ currentPhaseKey: 'rough-in', customerMilestone: 'shell' });
  });

  it('refuses a field user and a customer', async () => {
    await expect(open({ actor: fieldActor })).rejects.toThrow(/may not open a construction project/i);
    await expect(open({ actor: { kind: 'user', userId: ids.field, role: 'customer' } }))
      .rejects.toThrow(/may not open a construction project/i);
  });

  it('refuses a superintendent who is not an admin or superintendent user', async () => {
    await expect(open({ superintendentUserId: ids.office })).rejects.toThrow(/active admin or superintendent/i);
  });

  it('accepts the owner or a superintendent as accountable', async () => {
    const project = await open({ superintendentUserId: ids.superintendent });
    expect(project).toMatchObject({
      superintendentUserId: ids.superintendent,
      superintendentName: 'Site Super',
    });
  });
});

describe('changing phase', () => {
  const advance = (toPhaseKey: Parameters<GateService['changeProjectPhase']>[1]['toPhaseKey'], options: {
    actor?: EventActor; reason?: string; key?: string;
  } = {}) => service.changeProjectPhase(ids.job, {
    actor: options.actor ?? owner,
    at: new Date().toISOString(),
    toPhaseKey,
    ...(options.reason ? { reason: options.reason } : {}),
  }, { idempotencyKey: options.key ?? `phase-${toPhaseKey}` });

  beforeEach(async () => { await open(); });

  it('advances one phase and records the transition', async () => {
    const project = await advance('layout-excavation', { actor: superintendent });
    expect(project).toMatchObject({ currentPhaseKey: 'layout-excavation', customerMilestone: 'excavation' });

    const history = await service.getProjectPhaseHistory(ids.job);
    expect(history.at(-1)).toMatchObject({
      fromPhaseKey: 'design-permitting',
      toPhaseKey: 'layout-excavation',
      actorUserId: ids.superintendent,
      reason: null,
    });
  });

  it('refuses a skip without a reason and records one with a reason', async () => {
    await expect(advance('gunite')).rejects.toThrow(PhaseRuleError);
    const project = await advance('gunite', { reason: 'Excavation, steel, and rough-in completed before import.' });
    expect(project.currentPhaseKey).toBe('gunite');
    expect((await service.getProjectPhaseHistory(ids.job)).at(-1)?.reason)
      .toBe('Excavation, steel, and rough-in completed before import.');
  });

  it('refuses a field user', async () => {
    await expect(advance('layout-excavation', { actor: fieldActor })).rejects.toThrow(PhaseRuleError);
  });

  it('is idempotent under a repeated command key', async () => {
    await advance('layout-excavation', { key: 'same-key-twice' });
    const repeated = await service.changeProjectPhase(ids.job, {
      actor: owner, at: new Date().toISOString(), toPhaseKey: 'steel-reinforcement',
    }, { idempotencyKey: 'same-key-twice' });

    expect(repeated.currentPhaseKey).toBe('layout-excavation');
    expect(await service.getProjectPhaseHistory(ids.job)).toHaveLength(2);
  });

  it('keeps phase history append-only', async () => {
    await advance('layout-excavation');
    await expect(db.query('update project_phase_transitions set reason = $1', ['rewritten']))
      .rejects.toThrow(/append-only/i);
    await expect(db.query('delete from project_phase_transitions')).rejects.toThrow(/append-only/i);
  });
});

describe('the customer-facing milestone', () => {
  it('follows the current phase while the job runs', async () => {
    await open({ initialPhaseKey: 'plaster-fill' });
    expect((await service.getProject(ids.job))?.customerMilestone).toBe('water');
  });

  it('reads handover only once the job itself completes', async () => {
    await open({ initialPhaseKey: 'plaster-fill' });
    await db.query(`update jobs set status = 'complete' where job_id = $1`, [ids.job]);
    expect((await service.getProject(ids.job))?.customerMilestone).toBe('handover');
  });
});

describe('the job summary read model', () => {
  it('carries no project until one is opened', async () => {
    expect((await service.getJob(ids.job))?.project).toBeNull();
  });

  it('carries phase, milestone, and accountable superintendent once opened', async () => {
    await open({ initialPhaseKey: 'tile-coping', superintendentUserId: ids.superintendent });
    expect((await service.getJob(ids.job))?.project).toMatchObject({
      currentPhaseKey: 'tile-coping',
      currentPhaseTitle: 'Waterline Tile & Coping Installation',
      currentPhaseSequence: 6,
      customerMilestone: 'finishes',
      superintendentName: 'Site Super',
    });
  });
});

describe('closing a completed job', () => {
  it('closes a completed job only after reconciliation and is idempotent', async () => {
    await expect(service.closeJob({ jobId: ids.job, actor: owner, idempotencyKey: 'close-before-complete' }))
      .rejects.toThrow(/marked complete/i);
    await db.query(`update jobs set status = 'complete' where job_id = $1`, [ids.job]);
    const closed = await service.closeJob({ jobId: ids.job, actor: owner, idempotencyKey: 'close-job-key' });
    expect(closed.status).toBe('closed');
    expect((await db.query(`select status, closed_by, reconciliation_complete from jobs where job_id = $1`, [ids.job])).rows[0])
      .toMatchObject({ status: 'closed', closed_by: ids.owner, reconciliation_complete: true });
    expect((await db.query(`select event_type from events where job_id = $1 and event_type = 'job.closed'`, [ids.job])).rows)
      .toHaveLength(1);
    expect((await service.closeJob({ jobId: ids.job, actor: owner, idempotencyKey: 'different-key' })).status).toBe('closed');
  });

  it('refuses field closure', async () => {
    await db.query(`update jobs set status = 'complete' where job_id = $1`, [ids.job]);
    await expect(service.closeJob({ jobId: ids.job, actor: fieldActor, idempotencyKey: 'field-close' }))
      .rejects.toThrow(/may not close/i);
  });
});

describe('the fixed construction model', () => {
  it('holds exactly the eleven confirmed phases and six milestones', async () => {
    const phases = await db.query<{ phase_key: string }>('select phase_key from construction_phases order by sequence');
    expect(phases.rows.map((row) => row.phase_key)).toEqual([
      'design-permitting', 'layout-excavation', 'steel-reinforcement', 'rough-in', 'gunite',
      'tile-coping', 'decking', 'equipment-hookup', 'automation-programming', 'cover-install', 'plaster-fill',
    ]);
    const milestones = await db.query('select milestone_key from customer_milestones');
    expect(milestones.rows).toHaveLength(6);
  });

  it('refuses to be changed by statement', async () => {
    await expect(db.query(
      `insert into construction_phases values ('demolition', 10, 'Demolition', 'design')`,
    )).rejects.toThrow(/fixed by docs\/decisions\/construction-model\.md/i);
    await expect(db.query(`delete from customer_milestones where milestone_key = 'handover'`))
      .rejects.toThrow(/fixed by/i);
  });
});

/**
 * Naming who is responsible for a job.
 *
 * The Today feed has raised "no superintendent assigned" since the card engine
 * shipped, and the name could only be set when the project was opened — so the
 * card named a fact nobody could change.
 */
describe('assigning a superintendent', () => {
  it('puts a named superintendent on an open project', async () => {
    await open();
    const updated = await service.assignSuperintendent({
      jobId: ids.job,
      superintendentUserId: ids.superintendent,
      actor: owner,
      idempotencyKey: 'assign-super-key',
    });
    expect(updated.superintendentUserId).toBe(ids.superintendent);
    expect((await service.getProject(ids.job))?.superintendentName).toBe('Site Super');
  });

  /** Taking somebody off a job is as much a fact as putting them on it. */
  it('clears the assignment when given null', async () => {
    await open({ superintendentUserId: ids.superintendent });
    const cleared = await service.assignSuperintendent({
      jobId: ids.job,
      superintendentUserId: null,
      actor: owner,
      idempotencyKey: 'clear-super-key',
    });
    expect(cleared.superintendentUserId).toBeNull();
  });

  /**
   * Who was responsible in August is exactly the question somebody asks months
   * later. A column quietly overwritten cannot answer it.
   */
  it('records the assignment as an event', async () => {
    await open();
    await service.assignSuperintendent({
      jobId: ids.job,
      superintendentUserId: ids.superintendent,
      actor: owner,
      idempotencyKey: 'assign-super-event',
    });
    const events = await db.query<{ event_type: string }>(
      'select event_type from events where job_id = $1',
      [ids.job],
    );
    expect(events.rows.map((row) => row.event_type)).toContain('project.superintendent_assigned');
  });

  /** The field does not name an office user, so neither does the assignment. */
  it('refuses anyone who is not an active superintendent', async () => {
    await open();
    await expect(service.assignSuperintendent({
      jobId: ids.job,
      superintendentUserId: ids.office,
      actor: owner,
      idempotencyKey: 'assign-office-key',
    })).rejects.toThrow(/only an active superintendent/i);
  });

  it('refuses a job with no project, because there is nothing to assign to', async () => {
    await expect(service.assignSuperintendent({
      jobId: ids.job,
      superintendentUserId: ids.superintendent,
      actor: owner,
      idempotencyKey: 'assign-no-project',
    })).rejects.toThrow(/no construction project/i);
  });

  it('refuses a role that may not open a project either', async () => {
    await open();
    await expect(service.assignSuperintendent({
      jobId: ids.job,
      superintendentUserId: ids.superintendent,
      actor: fieldActor,
      idempotencyKey: 'assign-field-key',
    })).rejects.toThrow(/may not assign/i);
  });

  it('lists only active superintendents', async () => {
    const people = await service.listSuperintendents();
    expect(people.map((person) => person.userId)).toEqual([ids.superintendent]);
  });
});
