import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations, PostgresDatabase } from '@apex/database';
import { createCanonicalId, type EventActor } from '@apex/contracts';
import { GateService } from './index.js';

const ids = { office: createCanonicalId('user'), admin: createCanonicalId('user'), field: createCanonicalId('user') };
const office: EventActor = { kind: 'user', userId: ids.office, role: 'office' };
const field: EventActor = { kind: 'user', userId: ids.field, role: 'field' };
let db: PGlite;
let service: GateService;
let leads: string[];

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(`insert into app_users (user_id, auth_user_id, role, display_name) values
    ($1, '00000000-0000-0000-0000-000000000061', 'office', 'Office'),
    ($2, '00000000-0000-0000-0000-000000000062', 'admin', 'Admin'),
    ($3, '00000000-0000-0000-0000-000000000063', 'field', 'Field')`, [ids.office, ids.admin, ids.field]);
  leads = [createCanonicalId('lead'), createCanonicalId('lead'), createCanonicalId('lead')];
  for (let index = 0; index < leads.length; index++) {
    await db.query(`insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
      values ($1, 'followup-test', $2, $3, $4::jsonb)`,
    [leads[index], `source-${index}`, `followup-test-key-${index}`, JSON.stringify({ customerName: `Customer ${index}`, streetAddress: `${index} Test Way` })]);
  }
  service = new GateService(db);
});

describe('pre-contract lead follow-ups', () => {
  it('shows missing work, keeps future actions off Today until their civil date, then completes back to missing', async () => {
    expect((await service.getLeadFollowupsToday('2026-10-15')).map((row) => row.leadId)).toContain(leads[0]);
    const created = await service.scheduleLeadFollowup({ leadId: leads[0]!, nextAction: 'Call about the issued proposal',
      dueDate: '2026-10-16', assignedUserId: ids.office, actor: office, idempotencyKey: 'followup-create-01' });
    expect((await service.getLeadFollowupsToday('2026-10-15')).map((row) => row.leadId)).not.toContain(leads[0]);
    expect((await service.getLeadFollowupsToday('2026-10-16')).find((row) => row.leadId === leads[0])).toMatchObject({
      kind: 'due-today', dueDate: '2026-10-16', nextAction: 'Call about the issued proposal',
    });
    await service.completeLeadFollowup({ leadId: leads[0]!, followupId: created.followupId, actor: office,
      idempotencyKey: 'followup-complete-01' });
    await service.completeLeadFollowup({ leadId: leads[0]!, followupId: created.followupId, actor: office,
      idempotencyKey: 'followup-complete-01' });
    expect((await service.getLeadFollowupsToday('2026-10-16')).find((row) => row.leadId === leads[0])?.kind)
      .toBe('missing-next-action');
    expect((await service.getOpportunityWork(leads[0]!))?.followups).toHaveLength(1);
  });

  it('orders overdue, due-today, then missing, with civil date and stable lead ordering', async () => {
    await service.scheduleLeadFollowup({ leadId: leads[0]!, nextAction: 'Old call', dueDate: '2026-10-12', assignedUserId: ids.office, actor: office, idempotencyKey: 'followup-order-01' });
    await service.scheduleLeadFollowup({ leadId: leads[1]!, nextAction: 'Today call', dueDate: '2026-10-15', assignedUserId: ids.office, actor: office, idempotencyKey: 'followup-order-02' });
    const rows = await service.getLeadFollowupsToday('2026-10-15');
    expect(rows.map((row) => row.kind)).toEqual(['overdue', 'due-today', 'missing-next-action']);
    expect(rows.map((row) => row.leadId)).toEqual([leads[0], leads[1], leads[2]]);
  });

  it('replaces atomically while retaining completed history and rejects non-office authority', async () => {
    const first = await service.scheduleLeadFollowup({ leadId: leads[0]!, nextAction: 'First', dueDate: '2026-10-15', assignedUserId: ids.office, actor: office, idempotencyKey: 'followup-replace-01' });
    const retry = await service.scheduleLeadFollowup({ leadId: leads[0]!, nextAction: 'First', dueDate: '2026-10-15', assignedUserId: ids.office, actor: office, idempotencyKey: 'followup-replace-01' });
    expect(retry.followupId).toBe(first.followupId);
    const second = await service.scheduleLeadFollowup({ leadId: leads[0]!, nextAction: 'Second', dueDate: '2026-10-16', assignedUserId: ids.office, actor: office, idempotencyKey: 'followup-replace-02' });
    expect((await service.getOpportunityWork(leads[0]!))?.followups).toHaveLength(2);
    expect((await service.getOpportunityWork(leads[0]!))?.followups.filter((entry) => entry.completedAt === null)).toHaveLength(1);
    expect(second.completedAt).toBeNull();
    await expect(service.scheduleLeadFollowup({ leadId: leads[1]!, nextAction: 'No', dueDate: '2026-10-15', assignedUserId: ids.office,
      actor: field, idempotencyKey: 'followup-refuse-01' })).rejects.toThrow(/admin or office/i);
    await expect(service.scheduleLeadFollowup({ leadId: leads[1]!, nextAction: 'No', dueDate: '2026-10-15', assignedUserId: ids.field,
      actor: office, idempotencyKey: 'followup-refuse-02' })).rejects.toThrow(/assigned/i);
  });

  it('excludes signed and rejected leads and refuses follow-up creation for either', async () => {
    await db.query(`update leads set status = case when lead_id = $1 then 'signed' else 'rejected' end where lead_id in ($1, $2)`, [leads[0], leads[1]]);
    const rows = await service.getLeadFollowupsToday('2026-10-15');
    expect(rows.map((row) => row.leadId)).toEqual([leads[2]]);
    await expect(service.scheduleLeadFollowup({ leadId: leads[0]!, nextAction: 'Call', dueDate: '2026-10-15', assignedUserId: ids.office, actor: office, idempotencyKey: 'followup-closed-01' })).rejects.toThrow(/open pre-contract/i);
  });
});

const postgresUrl = process.env.DATABASE_URL?.trim();
describe.skipIf(!postgresUrl)('PostgreSQL follow-up concurrency', () => {
  let pg: PostgresDatabase | undefined;
  let pgService: GateService;
  let leadId: string;
  let pgUserId: `user_${string}`;
  beforeEach(async () => {
    pg = PostgresDatabase.create({ url: postgresUrl!, applicationName: 'apex-lead-followup-test', maxConnections: 4 });
    await pg.withMigrationLock((client) => applyOperationalMigrations(client));
    pgUserId = createCanonicalId('user');
    await pg.query(`insert into app_users (user_id, auth_user_id, role, display_name) values ($1, gen_random_uuid(), 'office', 'Follow-up Test')`, [pgUserId]);
    leadId = createCanonicalId('lead');
    await pg.query(`insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
      values ($1, 'followup-concurrency', $2, $3, '{"customerName":"Concurrency Test"}')`, [leadId, leadId, `followup:${leadId}`]);
    pgService = new GateService(pg);
  });
  afterAll(async () => { await pg?.close(); });
  it('serializes duplicate and replacement requests with one open row and retained history', async () => {
    const actor: EventActor = { kind: 'user', userId: pgUserId, role: 'office' };
    const same = { leadId, nextAction: 'Concurrent call', dueDate: '2026-10-15', assignedUserId: pgUserId, actor, idempotencyKey: `same:${leadId}` };
    const duplicates = await Promise.all([pgService.scheduleLeadFollowup(same), pgService.scheduleLeadFollowup(same)]);
    expect(duplicates[0]?.followupId).toBe(duplicates[1]?.followupId);
    const replaced = await Promise.all([
      pgService.scheduleLeadFollowup({ ...same, nextAction: 'Updated call', idempotencyKey: `replace-a:${leadId}` }),
      pgService.scheduleLeadFollowup({ ...same, nextAction: 'Updated call', idempotencyKey: `replace-b:${leadId}` }),
    ]);
    const state = await pg!.query<{ total: string; open: string }>(`select count(*)::text total, count(*) filter (where completed_at is null)::text open from lead_followups where lead_id = $1`, [leadId]);
    expect(Number(state.rows[0]?.total)).toBe(3);
    expect(Number(state.rows[0]?.open)).toBe(1);
    expect(replaced.every((row) => row.completedAt === null)).toBe(true);
  });
});
