import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresDatabase, applyOperationalMigrations, type Database, type Queryable } from '../packages/database/src/index.ts';
import { createCanonicalId, type EventActor, type JobId } from '../packages/contracts/src/index.ts';
import { GateService } from '../packages/gate-service/src/index.ts';

const url = process.env.DATABASE_URL?.trim();
const available = Boolean(url);
let db: PostgresDatabase;
const actorId = createCanonicalId('user');
const actor: EventActor = { kind: 'user', userId: actorId, role: 'admin' };

beforeAll(async () => {
  if (!available) return;
  db = PostgresDatabase.create({ url: url!, applicationName: 'apex-closed-job-race-test', maxConnections: 4 });
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name)
     values ($1, gen_random_uuid(), 'admin', 'Race Test') on conflict (user_id) do nothing`, [actorId],
  );
});

afterAll(async () => { if (available && db) await db.close(); });

const makeJob = async () => {
  const leadId = createCanonicalId('lead');
  const jobId = createCanonicalId('job') as JobId;
  const revisionId = createCanonicalId('revision');
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', $2, $3, '{}')`, [leadId, jobId, `closed-race:${jobId}`],
  );
  await db.query('insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, \'active\')', [jobId, leadId]);
  await db.query(
    `insert into takeoff_revisions
     (revision_id, job_id, revision_number, status, engine_version, quantity_model_version,
      job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, 'approved', 'race-test', 'q1', repeat('a', 64), repeat('b', 64), repeat('c', 64),
       '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"race.volume"}]',
       '[{"id":"race.volume","label":"Volume","formula":"V=1","inputs":[],"value":1,"unit":"gal"}]', $3, now(), $3)`,
    [revisionId, jobId, actorId],
  );
  return { jobId, revisionId };
};

// Directly commit the immutable status while holding the same Job row lock as
// closeJob. This isolates the serialization boundary; it does not exercise the
// closeout checklist or claim that closeout itself was completed.
const closeJobRow = (jobId: JobId) => db.transaction(async (tx) => {
  await tx.query(
    `update jobs set status = 'closed', closed_at = now(), closed_by = $2,
       reconciliation_complete = true where job_id = $1`, [jobId, actorId],
  );
});

/** Let a service finish its preflight read, commit closure, then release it into the write tx. */
const closureWinsAfterPreflight = async <T>(
  jobId: JobId,
  action: (service: GateService) => Promise<T>,
): Promise<PromiseSettledResult<T>> => {
  let signalPreflight!: () => void;
  let release!: () => void;
  const preflightDone = new Promise<void>((resolve) => { signalPreflight = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  const instrumented: Database = {
    query: async <Row>(sql: string, params?: unknown[]) => {
      const result = await db.query<Row>(sql, params);
      if (/select status from jobs where job_id = \$1 for update/i.test(sql)) {
        signalPreflight();
        await released;
      }
      return result;
    },
    transaction: (work) => db.transaction(work),
  };
  const pending = action(new GateService(instrumented));
  await preflightDone;
  await closeJobRow(jobId);
  release();
  return Promise.allSettled([pending]).then(([settled]) => settled!);
};

/** Hold the service's Job lock until a competing closure update has been sent. */
const withHeldJobLock = async <T>(jobId: JobId, action: (service: GateService) => Promise<T>) => {
  let signalAcquired!: () => void;
  let release!: () => void;
  let signalCloseSent!: () => void;
  const acquired = new Promise<void>((resolve) => { signalAcquired = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  const closeSent = new Promise<void>((resolve) => { signalCloseSent = resolve; });
  let closedTransaction = false;
  const instrumented: Database = {
    query: <Row>(sql: string, params?: unknown[]) => db.query<Row>(sql, params),
    transaction: <R>(work: (tx: Queryable) => Promise<R>) => db.transaction(async (tx) => work({
      query: async <Row>(sql: string, params?: unknown[]) => {
        const result = await tx.query<Row>(sql, params);
        if (!closedTransaction && /select status from jobs where job_id = \$1 for update/i.test(sql)) {
          closedTransaction = true;
          signalAcquired();
          await released;
        }
        return result;
      },
    })),
  };
  const mutation = action(new GateService(instrumented));
  await acquired;
  const closure = db.transaction(async (tx) => {
    signalCloseSent();
    await tx.query(
      `update jobs set status = 'closed', closed_at = now(), closed_by = $2,
         reconciliation_complete = true where job_id = $1`, [jobId, actorId],
    );
  });
  await closeSent;
  release();
  const [result] = await Promise.all([mutation, closure]);
  return result;
};

describe.skipIf(!available)('closed-job mutation serialization on PostgreSQL', () => {
  it('orders Gate creation before a competing closure and refuses it after closure wins', async () => {
    const first = await makeJob();
    const created = await withHeldJobLock(first.jobId, (service) => service.createGate({
      gateInstanceId: createCanonicalId('gate'), jobId: first.jobId, definitionKey: 'permit',
    }));
    expect(created.jobId).toBe(first.jobId);
    expect((await db.query<{ status: string }>('select status from jobs where job_id = $1', [first.jobId])).rows[0]?.status).toBe('closed');

    const second = await makeJob();
    await closeJobRow(second.jobId);
    const gateId = createCanonicalId('gate');
    await expect(new GateService(db).createGate({
      gateInstanceId: gateId, jobId: second.jobId, definitionKey: 'permit',
    })).rejects.toThrow(/closed or cancelled/i);
    expect((await db.query('select 1 from gate_instances where gate_instance_id = $1', [gateId])).rows).toHaveLength(0);
  });

  it('orders Gate commands before a competing closure and refuses them after closure wins', async () => {
    const first = await makeJob();
    const gateId = createCanonicalId('gate');
    await new GateService(db).createGate({ gateInstanceId: gateId, jobId: first.jobId, definitionKey: 'permit' });
    const executed = await withHeldJobLock(first.jobId, (service) => service.execute(gateId, {
      type: 'start-gate', actor, at: new Date().toISOString(),
    }, { idempotencyKey: `closed-race:${first.jobId}` }));
    expect(executed.state.status).toBe('in-progress');
    expect((await db.query<{ status: string }>('select status from jobs where job_id = $1', [first.jobId])).rows[0]?.status).toBe('closed');

    const second = await makeJob();
    const secondGate = createCanonicalId('gate');
    await new GateService(db).createGate({ gateInstanceId: secondGate, jobId: second.jobId, definitionKey: 'permit' });
    await closeJobRow(second.jobId);
    await expect(new GateService(db).execute(secondGate, {
      type: 'start-gate', actor, at: new Date().toISOString(),
    }, { idempotencyKey: `closed-race:${second.jobId}` })).rejects.toThrow(/closed or cancelled/i);
  });

  it('rechecks a stale preflight after closure for Gate creation and a non-Gate mutation', async () => {
    const gateJob = await makeJob();
    const gateId = createCanonicalId('gate');
    const gateResult = await closureWinsAfterPreflight(gateJob.jobId, (service) => service.createGate({
      gateInstanceId: gateId, jobId: gateJob.jobId, definitionKey: 'permit',
    }));
    expect(gateResult.status).toBe('rejected');
    expect((await db.query('select 1 from gate_instances where gate_instance_id = $1', [gateId])).rows).toHaveLength(0);

    const commandJob = await makeJob();
    const commandGate = createCanonicalId('gate');
    await new GateService(db).createGate({ gateInstanceId: commandGate, jobId: commandJob.jobId, definitionKey: 'permit' });
    const commandResult = await closureWinsAfterPreflight(commandJob.jobId, (service) => service.execute(commandGate, {
      type: 'start-gate', actor, at: new Date().toISOString(),
    }, { idempotencyKey: `closed-race:${commandJob.jobId}` }));
    expect(commandResult.status).toBe('rejected');
    expect((await new GateService(db).getGate(commandGate)).status).toBe('not-started');

    const scheduleJob = await makeJob();
    const subcontractorId = createCanonicalId('sub');
    await db.query('insert into subcontractors (subcontractor_id, name, trade) values ($1, $2, $3)', [subcontractorId, 'Race Test Crew', 'Gunite']);
    const scheduleResult = await closureWinsAfterPreflight(scheduleJob.jobId, (service) => service.scheduleVisit({
      jobId: scheduleJob.jobId, subcontractorId, phaseKey: 'gunite',
      startsOn: '2026-10-14', endsOn: '2026-10-14', actor,
    }));
    expect(scheduleResult.status).toBe('rejected');
    expect((await db.query('select 1 from scheduled_visits where job_id = $1', [scheduleJob.jobId])).rows).toHaveLength(0);
  });

  it('refuses mutations when cancellation commits first', async () => {
    const job = await makeJob();
    await db.query("update jobs set status = 'cancelled' where job_id = $1", [job.jobId]);
    const gateId = createCanonicalId('gate');
    await expect(new GateService(db).createGate({
      gateInstanceId: gateId, jobId: job.jobId, definitionKey: 'permit',
    })).rejects.toThrow(/closed or cancelled/i);
    expect((await db.query('select 1 from gate_instances where gate_instance_id = $1', [gateId])).rows).toHaveLength(0);
  });
});
