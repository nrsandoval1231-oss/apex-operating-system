import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculateQuantityPayloadSha256, createCanonicalId, type AuthoritativeQuantity, type JobId } from '../packages/contracts/src/index.ts';
import { PostgresDatabase, applyOperationalMigrations } from '../packages/database/src/index.ts';
import { GateService } from '../packages/gate-service/src/index.ts';

const url = process.env.DATABASE_URL?.trim();
const available = Boolean(url);
let db: PostgresDatabase;
const actorId = createCanonicalId('user');
const secondActorId = createCanonicalId('user');
const quantity: AuthoritativeQuantity = { code: 'shell.reinforcing-steel-weight', value: 100, unit: 'lb', calcId: 'procurement.steel' };
const ledger = [{ id: quantity.calcId, label: 'Steel', formula: 'approved input', inputs: [], value: 100, unit: 'lb' }];
const actor = { userId: actorId, role: 'office' };
const secondActor = { userId: secondActorId, role: 'office' };

beforeAll(async () => {
  if (!available) return;
  db = PostgresDatabase.create({ url: url!, applicationName: 'apex-procurement-retry-test', maxConnections: 4 });
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
  for (const [userId, name] of [[actorId, 'Procurement Retry One'], [secondActorId, 'Procurement Retry Two']] as const) {
    await db.query(`insert into app_users(user_id,auth_user_id,role,display_name)
      values($1,gen_random_uuid(),'office',$2) on conflict(user_id) do nothing`, [userId, name]);
  }
});
afterAll(async () => { if (available && db) await db.close(); });

const makeJob = async () => {
  const leadId = createCanonicalId('lead');
  const jobId = createCanonicalId('job') as JobId;
  const revisionId = createCanonicalId('revision');
  await db.query(`insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload)
    values($1,'test',$2,$3,'{}')`, [leadId, jobId, `procurement-retry:${jobId}`]);
  await db.query(`insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`, [jobId, leadId]);
  await db.query(`insert into takeoff_revisions
    (revision_id,job_id,revision_number,status,engine_version,quantity_model_version,job_input_sha256,
     calc_ledger_sha256,quantity_payload_sha256,quantities,calc_ledger,created_by,approved_at,approved_by)
    values($1,$2,1,'approved','test','q1',repeat('a',64),repeat('b',64),$3,$4,$5,$6,now(),$6)`,
    [revisionId, jobId, calculateQuantityPayloadSha256([quantity]), JSON.stringify([quantity]), JSON.stringify(ledger), actorId]);
  await db.query('update jobs set current_takeoff_revision_id=$2 where job_id=$1', [jobId, revisionId]);
  return jobId;
};
const service = () => new GateService(db);

describe.skipIf(!available)('material procurement idempotency on PostgreSQL', () => {
  it('returns an exact retry and refuses reuse across lines, payloads, and actors', async () => {
    const firstJob = await makeJob();
    const secondJob = await makeJob();
    const firstLine = await service().createProcurement({
      jobId: firstJob, actor, quantityCode: quantity.code, neededBy: null, idempotencyKey: `procurement-retry:${firstJob}:create`,
    });
    const secondLine = await service().createProcurement({
      jobId: secondJob, actor, quantityCode: quantity.code, neededBy: null, idempotencyKey: `procurement-retry:${secondJob}:create`,
    });
    expect((await service().createProcurement({
      jobId: firstJob, actor, quantityCode: quantity.code, neededBy: null, idempotencyKey: `procurement-retry:${firstJob}:same-create`,
    })).lineId).toBe(firstLine.lineId);
    await expect(service().createProcurement({
      jobId: firstJob, actor, quantityCode: quantity.code, neededBy: '2026-11-01', idempotencyKey: `procurement-retry:${firstJob}:changed-create`,
    })).rejects.toThrow(/different required-by date/i);
    await expect(service().createProcurement({
      jobId: secondJob, actor, quantityCode: quantity.code, neededBy: null, idempotencyKey: `procurement-retry:${firstJob}:create`,
    })).rejects.toThrow(/idempotency key .* different .* request/i);
    const laterUpdateActor = { userId: secondActorId, role: 'office' };
    await service().updateProcurement({
      lineId: firstLine.lineId, actor: laterUpdateActor, idempotencyKey: `procurement-retry:${firstJob}:later-date`,
      changes: {
        expectedRevision: firstLine.revision, orderedQuantity: null, vendor: null, orderReference: null,
        neededBy: '2026-12-01', expectedOn: null, receivedQuantity: 0,
      }, action: 'updated',
    });
    const originalCreateRetry = await service().createProcurement({
      jobId: firstJob, actor, quantityCode: quantity.code, neededBy: null, idempotencyKey: `procurement-retry:${firstJob}:create`,
    });
    expect(originalCreateRetry).toMatchObject({ lineId: firstLine.lineId, neededBy: '2026-12-01', updatedBy: secondActorId });
    const emptyOrder = {
      expectedRevision: secondLine.revision, orderedQuantity: null, vendor: null, orderReference: null,
      neededBy: null, expectedOn: null, receivedQuantity: 0,
    };
    const emptyOrderKey = `procurement-retry:${secondJob}:empty-order`;
    const emptyOrderSaved = await service().updateProcurement({
      lineId: secondLine.lineId, actor, idempotencyKey: emptyOrderKey, changes: emptyOrder, action: 'updated',
    });
    expect((await service().updateProcurement({
      lineId: secondLine.lineId, actor, idempotencyKey: emptyOrderKey, changes: emptyOrder, action: 'updated',
    })).revision).toBe(emptyOrderSaved.revision);
    await expect(service().updateProcurement({
      lineId: secondLine.lineId, actor, idempotencyKey: emptyOrderKey,
      changes: { ...emptyOrder, orderedQuantity: 0 }, action: 'updated',
    })).rejects.toThrow(/idempotency key .* different .* request/i);
    const changes = {
      expectedRevision: originalCreateRetry.revision, orderedQuantity: 120, vendor: 'Steel Yard', orderReference: 'PO-RETRY-1',
      neededBy: '2026-11-01', expectedOn: '2026-11-08', receivedQuantity: 40,
    };
    const key = `procurement-retry:${firstJob}:update`;
    const saved = await service().updateProcurement({ lineId: firstLine.lineId, actor, idempotencyKey: key, changes, action: 'updated' });
    const exactRetry = await service().updateProcurement({ lineId: firstLine.lineId, actor, idempotencyKey: key, changes, action: 'updated' });
    expect(exactRetry).toMatchObject({ lineId: firstLine.lineId, revision: saved.revision, receivedQuantity: 40, vendor: 'Steel Yard' });
    await expect(service().updateProcurement({
      lineId: secondLine.lineId, actor, idempotencyKey: key,
      changes: { ...changes, expectedRevision: secondLine.revision }, action: 'updated',
    })).rejects.toThrow(/idempotency key .* different .* request/i);
    await expect(service().updateProcurement({
      lineId: firstLine.lineId, actor, idempotencyKey: key,
      changes: { ...changes, vendor: 'Another Yard' }, action: 'updated',
    })).rejects.toThrow(/idempotency key .* different .* request/i);
    await expect(service().updateProcurement({
      lineId: firstLine.lineId, actor: secondActor, idempotencyKey: key, changes, action: 'updated',
    })).rejects.toThrow(/idempotency key .* different .* request/i);
    expect((await db.query('select revision from material_procurement where line_id=$1', [firstLine.lineId])).rows[0]?.revision).toBe(saved.revision);
    expect((await db.query('select count(*)::int as count from material_procurement_history where idempotency_key=$1', [key])).rows[0]?.count).toBe(1);
  });

  it('replays a concurrent retry with the same key instead of reporting a stale revision', async () => {
    const jobId = await makeJob();
    const line = await service().createProcurement({
      jobId, actor, quantityCode: quantity.code, neededBy: null, idempotencyKey: `procurement-retry:${jobId}:create`,
    });
    const changes = {
      expectedRevision: line.revision, orderedQuantity: 100, vendor: 'Steel Yard', orderReference: 'PO-RACE-1',
      neededBy: null, expectedOn: null, receivedQuantity: 25,
    };
    const key = `procurement-retry:${jobId}:race`;
    const results = await Promise.allSettled(Array.from({ length: 4 }, () =>
      service().updateProcurement({ lineId: line.lineId, actor, idempotencyKey: key, changes, action: 'receipt' })));
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
    for (const result of results) {
      if (result.status === 'fulfilled') expect(result.value).toMatchObject({ revision: line.revision + 1, receivedQuantity: 25 });
    }
    expect((await db.query('select count(*)::int as count from material_procurement_history where idempotency_key=$1', [key])).rows[0]?.count).toBe(1);
  });
});
