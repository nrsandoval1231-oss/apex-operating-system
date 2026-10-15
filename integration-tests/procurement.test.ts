import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculateQuantityPayloadSha256, createCanonicalId, type AuthoritativeQuantity, type JobId } from '../packages/contracts/src/index.ts';
import { PostgresDatabase, applyOperationalMigrations } from '../packages/database/src/index.ts';
import { GateService } from '../packages/gate-service/src/index.ts';

const url = process.env.DATABASE_URL?.trim();
const available = Boolean(url);
let db: PostgresDatabase;
const userId = createCanonicalId('user');
const code = 'shell.reinforcing-steel-weight' as const;
const quantity: AuthoritativeQuantity = { code, value: 100, unit: 'lb', calcId: 'procurement.steel' };
const ledger = [{ id: quantity.calcId, label: 'Steel', formula: 'approved input', inputs: [], value: 100, unit: 'lb' }];

beforeAll(async () => {
  if (!available) return;
  db = PostgresDatabase.create({ url: url!, applicationName: 'apex-procurement-test', maxConnections: 8 });
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
  await db.query(`insert into app_users(user_id,auth_user_id,role,display_name)
    values($1,gen_random_uuid(),'office','Procurement Test') on conflict(user_id) do nothing`, [userId]);
});
afterAll(async () => { if (available && db) await db.close(); });

const makeJob = async (digest = calculateQuantityPayloadSha256([quantity])) => {
  const leadId = createCanonicalId('lead');
  const jobId = createCanonicalId('job') as JobId;
  const revisionId = createCanonicalId('revision');
  await db.query(`insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload)
    values($1,'test',$2,$3,'{}')`, [leadId, jobId, `procurement:${jobId}`]);
  await db.query(`insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`, [jobId, leadId]);
  await db.query(`insert into takeoff_revisions
    (revision_id,job_id,revision_number,status,engine_version,quantity_model_version,job_input_sha256,
     calc_ledger_sha256,quantity_payload_sha256,quantities,calc_ledger,created_by,approved_at,approved_by)
    values($1,$2,1,'approved','test','q1',repeat('a',64),repeat('b',64),$3,$4,$5,$6,now(),$6)`,
    [revisionId, jobId, digest, JSON.stringify([quantity]), JSON.stringify(ledger), userId]);
  await db.query('update jobs set current_takeoff_revision_id=$2 where job_id=$1', [jobId, revisionId]);
  return { jobId, revisionId };
};
const actor = { userId, role: 'office' };
const service = () => new GateService(db);

describe.skipIf(!available)('material procurement on PostgreSQL', () => {
  it('pins the approved source quantity and serializes duplicate concurrent creation', async () => {
    const { jobId, revisionId } = await makeJob();
    const otherJob = await makeJob();
    const calls = await Promise.all([
      service().createProcurement({ jobId, actor, quantityCode: code, neededBy: null, idempotencyKey: `procurement:${jobId}:create-a` }),
      service().createProcurement({ jobId, actor, quantityCode: code, neededBy: null, idempotencyKey: `procurement:${jobId}:create-b` }),
    ]);
    expect(calls[0]?.lineId).toBe(calls[1]?.lineId);
    expect(calls[0]).toMatchObject({ revisionId, quantityCode: code, requiredQuantity: 100, unit: 'lb' });
    await expect(db.query('update material_procurement set required_quantity=500 where line_id=$1', [calls[0]!.lineId]))
      .rejects.toThrow(/source fields .* immutable/i);
    await expect(db.query(`insert into material_procurement
      (line_id,job_id,revision_id,quantity_code,required_quantity,unit,updated_by,idempotency_key)
      values($1,$2,$3,$4,100,'lb',$5,$6)`, [
      createCanonicalId('material-line'), otherJob.jobId, revisionId, code, userId,
      `procurement:${otherJob.jobId}:cross-job-revision`,
    ])).rejects.toThrow(/foreign key constraint/i);
    expect((await db.query('select 1 from material_procurement_history where line_id=$1', [calls[0]!.lineId])).rows).toHaveLength(1);
  });

  it('refuses a bad source digest and creates no procurement line', async () => {
    const { jobId } = await makeJob('f'.repeat(64));
    await expect(service().createProcurement({ jobId, actor, quantityCode: code, neededBy: null, idempotencyKey: `procurement:${jobId}:bad-digest` })).rejects.toThrow(/digest is invalid/i);
    expect((await db.query('select 1 from material_procurement where job_id=$1', [jobId])).rows).toHaveLength(0);
  });

  it('persists partial receipt, enforces optimistic retry, date boundaries, stale revisions, and closed locks', async () => {
    const { jobId, revisionId } = await makeJob();
    const blockers = async (date: string) => (await service().getProcurementToday(date)).filter((item) => item.jobId === jobId);
    const line = await service().createProcurement({ jobId, actor, quantityCode: code, neededBy: '2026-10-15', idempotencyKey: `procurement:${jobId}:create` });
    const changes = { expectedRevision: line.revision, orderedQuantity: 120, vendor: 'Steel Yard', orderReference: 'PO-LOCAL-1', neededBy: '2026-10-15', expectedOn: '2026-10-16', receivedQuantity: 40 };
    const savedCalls = await Promise.all([
      service().updateProcurement({ lineId: line.lineId, actor, idempotencyKey: `procurement:${jobId}:receipt-1`, changes, action: 'receipt' }),
      service().updateProcurement({ lineId: line.lineId, actor, idempotencyKey: `procurement:${jobId}:receipt-1`, changes, action: 'receipt' }),
    ]);
    const saved = savedCalls[0]!;
    expect(savedCalls[1]?.revision).toBe(saved.revision);
    expect(saved).toMatchObject({ receivedQuantity: 40, outstandingQuantity: 80 });
    expect(await blockers('2026-10-14')).toHaveLength(0);
    expect((await blockers('2026-10-15')).map((item) => item.lineId)).toContain(line.lineId);
    const officeCards = await service().getActionCards('2026-10-15');
    expect(officeCards.some((card) => card.jobId === jobId && card.kind === 'procurement.overdue')).toBe(true);
    expect((await service().getActionCards('2026-10-15', false)).some((card) => card.kind === 'procurement.overdue')).toBe(false);
    const requiredReceived = await service().updateProcurement({
      lineId: line.lineId, actor, idempotencyKey: `procurement:${jobId}:receipt-2`,
      changes: { ...changes, expectedRevision: saved.revision, receivedQuantity: 100 }, action: 'receipt',
    });
    expect(requiredReceived).toMatchObject({ receivedQuantity: 100, outstandingQuantity: 20 });
    expect(await blockers('2026-10-16')).toHaveLength(0);
    expect((await blockers('2026-10-17')).map((item) => item.lineId)).toContain(line.lineId);
    const officeBrief = await service().getDailyBrief('2026-10-17', true);
    expect([...officeBrief.needsYou, ...officeBrief.running, ...officeBrief.thisWeek]
      .some((item) => item.card.kind === 'procurement.overdue')).toBe(true);
    const fieldBrief = await service().getDailyBrief('2026-10-17', false);
    expect([...fieldBrief.needsYou, ...fieldBrief.running, ...fieldBrief.thisWeek]
      .some((item) => item.card.kind === 'procurement.overdue')).toBe(false);
    const persistedBrief = await db.query<{ payload: { needsYou: Array<{ card: { kind: string } }> } }>(
      'select payload from daily_briefs where brief_date=$1', ['2026-10-17'],
    );
    expect(persistedBrief.rows[0]?.payload.needsYou.some((item) => item.card.kind === 'procurement.overdue')).toBe(true);
    await expect(service().updateProcurement({ lineId: line.lineId, actor, idempotencyKey: `procurement:${jobId}:stale`, changes, action: 'updated' })).rejects.toThrow(/changed; reload/i);
    const retried = await service().updateProcurement({
      lineId: line.lineId, actor, idempotencyKey: `procurement:${jobId}:receipt-2`,
      changes: { ...changes, expectedRevision: saved.revision, receivedQuantity: 100 }, action: 'receipt',
    });
    expect(retried.receivedQuantity).toBe(100);

    const nextRevision = createCanonicalId('revision');
    await db.query('update jobs set current_takeoff_revision_id=null where job_id=$1', [jobId]);
    await db.query(`insert into takeoff_revisions
      (revision_id,job_id,revision_number,status,engine_version,quantity_model_version,job_input_sha256,calc_ledger_sha256,quantity_payload_sha256,quantities,calc_ledger,created_by,approved_at,approved_by)
      values($1,$2,2,'draft','test','q1',repeat('c',64),repeat('d',64),$3,$4,$5,$6,null,null)`,
      [nextRevision, jobId, calculateQuantityPayloadSha256([quantity]), JSON.stringify([quantity]), JSON.stringify(ledger), userId]);
    await db.query(`update takeoff_revisions set status='superseded',superseded_by_revision_id=$2 where revision_id=$1`, [revisionId, nextRevision]);
    await db.query(`update takeoff_revisions set status='approved',approved_at=now(),approved_by=$2 where revision_id=$1`, [nextRevision, userId]);
    await db.query('update jobs set current_takeoff_revision_id=$2 where job_id=$1', [jobId, nextRevision]);
    expect((await service().listProcurement(jobId))[0]?.staleTakeoff).toBe(true);
    await db.query(`update jobs set status='closed',closed_at=now(),closed_by=$2,reconciliation_complete=true where job_id=$1`, [jobId, userId]);
    await expect(service().updateProcurement({ lineId: line.lineId, actor, idempotencyKey: `procurement:${jobId}:closed`, changes: { ...changes, expectedRevision: requiredReceived.revision, receivedQuantity: 100 }, action: 'updated' })).rejects.toThrow(/closed or cancelled/i);
  });
});

