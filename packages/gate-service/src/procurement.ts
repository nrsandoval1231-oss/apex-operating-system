import type { Database, Queryable } from '@apex/database';
import {
  AUTHORITATIVE_QUANTITY_UNITS,
  ProcurementLineSchema,
  PROCUREMENT_CODES,
  calculateQuantityPayloadSha256,
  createCanonicalId,
  type JobId,
  type MaterialId,
  type ProcurementLine,
  type ProcurementUpdate,
  type UserId,
} from '@apex/contracts';
import { DomainRuleError, RoleRefusalError } from '@apex/domain';
import { assertJobMutable } from './jobState.js';

const STAFF_WRITE = ['admin', 'office'] as const;
type Actor = { readonly userId: UserId; readonly role: string };
type DbLine = {
  line_id: MaterialId; job_id: string; revision_id: string; quantity_code: string;
  required_quantity: string | number; unit: string; ordered_quantity: string | number | null;
  vendor: string | null; order_reference: string | null; needed_by: string | Date | null;
  expected_on: string | Date | null; received_quantity: string | number; revision: number;
  updated_by: string; updated_at: string | Date; current_takeoff_revision_id: string | null;
  updated_by_name: string | null;
};
export type ProcurementTodayBlocker = ProcurementLine & {
  readonly neededByOverdue: boolean;
  readonly expectedDeliveryOverdue: boolean;
};
const day = (value: string | Date | null) => value === null ? null : value instanceof Date
  ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const num = (value: string | number | null) => value === null ? null : Number(value);
const toLine = (row: DbLine): ProcurementLine => ProcurementLineSchema.parse({
  lineId: row.line_id, jobId: row.job_id, revisionId: row.revision_id,
  quantityCode: row.quantity_code, requiredQuantity: Number(row.required_quantity), unit: row.unit,
  orderedQuantity: num(row.ordered_quantity), vendor: row.vendor, orderReference: row.order_reference,
  neededBy: day(row.needed_by), expectedOn: day(row.expected_on),
  receivedQuantity: Number(row.received_quantity),
  outstandingQuantity: Math.max(0, Number(row.ordered_quantity ?? row.required_quantity) - Number(row.received_quantity)),
  revision: row.revision, updatedBy: row.updated_by, updatedByName: row.updated_by_name,
  updatedAt: new Date(row.updated_at).toISOString(),
  staleTakeoff: row.current_takeoff_revision_id !== row.revision_id,
});
const selectLines = `select p.*, j.current_takeoff_revision_id, u.display_name as updated_by_name
  from material_procurement p join jobs j using(job_id) join app_users u on u.user_id=p.updated_by`;

export class ProcurementService {
  constructor(private readonly db: Database) {}

  async list(jobId: JobId): Promise<readonly ProcurementLine[]> {
    const result = await this.db.query<DbLine>(`${selectLines} where p.job_id=$1 order by p.quantity_code`, [jobId]);
    return result.rows.map(toLine);
  }

  async create(input: { jobId: JobId; actor: Actor; quantityCode: (typeof PROCUREMENT_CODES)[number]; neededBy: string | null; idempotencyKey: string }): Promise<ProcurementLine> {
    this.authorize(input.actor);
    let lineId: MaterialId = createCanonicalId('material');
    await this.db.transaction(async (tx) => {
      await assertJobMutable(tx, input.jobId);
      const source = await tx.query<{ revision_id: string; quantity_payload_sha256: string; quantities: unknown }>(
        `select tr.revision_id,tr.quantity_payload_sha256,tr.quantities from jobs j
         join takeoff_revisions tr on tr.revision_id=j.current_takeoff_revision_id
         where j.job_id=$1 and tr.status='approved'`, [input.jobId]);
      const revision = source.rows[0];
      if (!revision) throw new DomainRuleError('A current approved takeoff is required before tracking materials.');
      const quantities = typeof revision.quantities === 'string' ? JSON.parse(revision.quantities) : revision.quantities;
      if (!Array.isArray(quantities) || calculateQuantityPayloadSha256(quantities) !== revision.quantity_payload_sha256) {
        throw new DomainRuleError('The approved takeoff quantity digest is invalid; material tracking is unavailable.');
      }
      const quantity = quantities.find((q: { code?: string }) => q.code === input.quantityCode);
      if (!quantity) throw new DomainRuleError('That material code is not present in the approved takeoff.');
      const expectedUnit = AUTHORITATIVE_QUANTITY_UNITS[input.quantityCode];
      if (quantity.unit !== expectedUnit || !Number.isFinite(quantity.value) || quantity.value < 0) {
        throw new DomainRuleError('The approved material quantity has an invalid unit or value.');
      }
      const keyUse = await tx.query<{
        line_id: MaterialId; job_id: JobId; revision_id: string; quantity_code: string;
        snapshot: DbLine; actor_id: UserId;
      }>(`select p.line_id,p.job_id,p.revision_id,p.quantity_code,h.snapshot,h.actor_id
          from material_procurement p join material_procurement_history h
            on h.line_id=p.line_id and h.idempotency_key=p.idempotency_key and h.action='created'
         where p.idempotency_key=$1`, [input.idempotencyKey]);
      if (keyUse.rows[0]) {
        const prior = keyUse.rows[0];
        const snapshot = typeof prior.snapshot === 'string' ? JSON.parse(prior.snapshot) as DbLine : prior.snapshot;
        if (prior.job_id !== input.jobId || prior.revision_id !== revision.revision_id
          || prior.quantity_code !== input.quantityCode || day(snapshot.needed_by) !== input.neededBy
          || prior.actor_id !== input.actor.userId) {
          throw new DomainRuleError('Idempotency key was already used for a different material procurement request.');
        }
        lineId = prior.line_id;
        return;
      }
      const prior = await tx.query<{ line_id: MaterialId; needed_by: string | Date | null }>(
        `select line_id,needed_by from material_procurement where job_id=$1 and revision_id=$2 and quantity_code=$3`,
        [input.jobId, revision.revision_id, input.quantityCode]);
      if (prior.rows[0]) {
        if (day(prior.rows[0].needed_by) !== input.neededBy) {
          throw new DomainRuleError('Material line already exists with a different required-by date; update it explicitly after reloading.');
        }
        lineId = prior.rows[0].line_id;
        return;
      }
      const inserted = await tx.query(
        `insert into material_procurement(line_id,job_id,revision_id,quantity_code,required_quantity,unit,needed_by,updated_by,idempotency_key)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(job_id,revision_id,quantity_code) do nothing returning line_id`,
        [lineId,input.jobId,revision.revision_id,input.quantityCode,quantity.value,expectedUnit,input.neededBy,input.actor.userId,input.idempotencyKey]);
      if (!inserted.rows[0]) {
        const existing = await tx.query<{ line_id: MaterialId }>(`select line_id from material_procurement where job_id=$1 and revision_id=$2 and quantity_code=$3`, [input.jobId, revision.revision_id, input.quantityCode]);
        if (!existing.rows[0]) throw new DomainRuleError('Material line creation was already applied with a different request.');
        lineId = existing.rows[0].line_id;
      }
      const created = await tx.query<{ revision: number }>('select revision from material_procurement where line_id=$1', [lineId]);
      await this.history(tx, lineId, created.rows[0]!.revision, 'created', input.actor.userId, input.idempotencyKey);
    });
    const line = (await this.db.query<DbLine>(`${selectLines} where p.line_id=$1`, [lineId])).rows[0];
    if (!line) throw new Error('Material line disappeared after creation.');
    return toLine(line);
  }

  async update(input: { lineId: string; actor: Actor; idempotencyKey: string; changes: ProcurementUpdate; action: 'updated' | 'receipt' }): Promise<ProcurementLine> {
    this.authorize(input.actor);
    await this.db.transaction(async (tx) => {
      const owner = await tx.query<{ job_id: JobId }>('select job_id from material_procurement where line_id=$1', [input.lineId]);
      const jobId = owner.rows[0]?.job_id;
      if (!jobId) throw new DomainRuleError('Unknown material line.');
      await assertJobMutable(tx, jobId);
      const duplicate = await tx.query<{
        line_id: MaterialId; actor_id: UserId; action: string; revision: number;
        snapshot: DbLine;
      }>('select line_id,actor_id,action,revision,snapshot from material_procurement_history where idempotency_key=$1', [input.idempotencyKey]);
      if (duplicate.rows[0]) {
        const prior = duplicate.rows[0];
        const snapshot = typeof prior.snapshot === 'string' ? JSON.parse(prior.snapshot) as DbLine : prior.snapshot;
        const sameChanges = prior.line_id === input.lineId
          && prior.actor_id === input.actor.userId
          && (prior.action === input.action || (input.action === 'updated' && prior.action === 'receipt'))
          && snapshot.revision === input.changes.expectedRevision + 1
          && (snapshot.ordered_quantity === null ? input.changes.orderedQuantity === null
            : Number(snapshot.ordered_quantity) === input.changes.orderedQuantity)
          && snapshot.vendor === input.changes.vendor
          && snapshot.order_reference === input.changes.orderReference
          && day(snapshot.needed_by) === input.changes.neededBy
          && day(snapshot.expected_on) === input.changes.expectedOn
          && Number(snapshot.received_quantity) === input.changes.receivedQuantity;
        if (!sameChanges) throw new DomainRuleError('Idempotency key was already used for a different material procurement request.');
        return;
      }
      const current = await tx.query<{ job_id: JobId; revision: number; received_quantity: string | number }>('select job_id,revision,received_quantity from material_procurement where line_id=$1 for update', [input.lineId]);
      const row = current.rows[0];
      if (!row) throw new DomainRuleError('Unknown material line.');
      if (row.revision !== input.changes.expectedRevision) throw new DomainRuleError('Material line changed; reload before updating.');
      const next = row.revision + 1;
      await tx.query(`update material_procurement set ordered_quantity=$2,vendor=$3,order_reference=$4,needed_by=$5,expected_on=$6,received_quantity=$7,revision=$8,updated_by=$9,updated_at=now() where line_id=$1`,
        [input.lineId,input.changes.orderedQuantity,input.changes.vendor,input.changes.orderReference,input.changes.neededBy,input.changes.expectedOn,input.changes.receivedQuantity,next,input.actor.userId]);
      const action = Number(row.received_quantity) !== input.changes.receivedQuantity ? 'receipt' : input.action;
      await this.history(tx,input.lineId,next,action,input.actor.userId,input.idempotencyKey);
    });
    const result = await this.db.query<DbLine>(`${selectLines} where p.line_id=$1`, [input.lineId]);
    if (!result.rows[0]) throw new DomainRuleError('Unknown material line.');
    return toLine(result.rows[0]);
  }

  async today(today: string) {
    const result = await this.db.query<DbLine>(`${selectLines} where j.status not in ('closed','cancelled') and
      ((p.needed_by is not null and p.needed_by <= $1 and p.received_quantity < p.required_quantity) or
       (p.expected_on is not null and p.expected_on < $1 and p.ordered_quantity is not null and p.received_quantity < p.ordered_quantity))`, [today]);
    return result.rows.map((row): ProcurementTodayBlocker => ({
      ...toLine(row),
      neededByOverdue: row.needed_by !== null && day(row.needed_by)! <= today
        && Number(row.received_quantity) < Number(row.required_quantity),
      expectedDeliveryOverdue: row.expected_on !== null && day(row.expected_on)! < today
        && row.ordered_quantity !== null && Number(row.received_quantity) < Number(row.ordered_quantity),
    }));
  }

  private authorize(actor: Actor) {
    if (!STAFF_WRITE.includes(actor.role as (typeof STAFF_WRITE)[number])) throw new RoleRefusalError(`Role ${actor.role} may not manage material procurement.`);
  }
  private async history(tx: Queryable, lineId: string, revision: number, action: string, actor: UserId, key: string) {
    const snapshot = await tx.query('select * from material_procurement where line_id=$1', [lineId]);
    await tx.query(`insert into material_procurement_history(line_id,revision,action,snapshot,actor_id,idempotency_key) values($1,$2,$3,$4,$5,$6)`, [lineId,revision,action,JSON.stringify(snapshot.rows[0]),actor,key]);
  }
}
