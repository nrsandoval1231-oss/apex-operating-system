import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { LocalEvidenceStorage } from '@apex/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import {
  ApprovedTakeoffRevisionSchema,
  createCanonicalId,
} from '@apex/contracts';
import { priceApprovedTakeoff } from '@apex/pricing-engine';
import { CustomerService } from './customer.js';
import {
  DEMO_CITY,
  DEMO_CUSTOMER_NAME,
  DEMO_CUSTOMER_TOKEN,
  DEMO_JOB_ID,
  DEMO_DIRECT_LINES,
  DEMO_FEE_RATE_BPS,
  DEMO_LEAD_KEY,
  DEMO_MEASURED_LINES,
  DEMO_STREET,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  removeDemoProject,
  seedDemoProject,
} from './demoSeed.js';
import { GateService } from './index.js';

/**
 * The Lubbock DEMO job has to be safe to run twice against a real database,
 * and `--remove` has to leave every other row where it was.
 */

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
});

const counts = async () => {
  const leads = await db.query<{ count: string }>(
    'select count(*)::text as count from leads where idempotency_key = $1',
    [DEMO_LEAD_KEY],
  );
  const jobs = await db.query<{ count: string }>(
    `select count(*)::text as count from jobs j
     join leads l on l.lead_id = j.lead_id
     where l.idempotency_key = $1`,
    [DEMO_LEAD_KEY],
  );
  const links = await db.query<{ count: string }>(
    `select count(*)::text as count from customer_links cl
     join jobs j on j.job_id = cl.job_id
     join leads l on l.lead_id = j.lead_id
     where l.idempotency_key = $1 and cl.revoked_at is null`,
    [DEMO_LEAD_KEY],
  );
  return {
    leads: Number(leads.rows[0]?.count),
    jobs: Number(jobs.rows[0]?.count),
    links: Number(links.rows[0]?.count),
  };
};

describe('Lubbock DEMO project seed', () => {
  it('walks the pipeline once, prices with the engine, and does not duplicate', async () => {
    const otherUser = createCanonicalId('user');
    const otherLead = createCanonicalId('lead');
    await db.query(
      `insert into app_users (user_id, auth_user_id, role, display_name)
       values ($1, '00000000-0000-0000-0000-000000000099', 'office', 'Someone Else')`,
      [otherUser],
    );
    await db.query(
      `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
       values ($1, 'test', 'keep-me', 'test:keep-me-lead', '{"customerName":"Keep Me"}')`,
      [otherLead],
    );

    const first = await seedDemoProject(db);
    const second = await seedDemoProject(db);

    expect(second).toEqual(first);
    expect(first.jobId).toBe(DEMO_JOB_ID);
    expect(first.customerPath).toBe(`/c/${DEMO_CUSTOMER_TOKEN}`);
    expect(await counts()).toEqual({ leads: 1, jobs: 1, links: 1 });

    const service = new GateService(db);
    const job = await service.getJob(first.jobId as Parameters<GateService['getJob']>[0]);
    expect(job?.customerName).toBe(DEMO_CUSTOMER_NAME);
    expect(job?.addressLine).toContain(DEMO_STREET);
    expect(job?.addressLine).toContain(DEMO_CITY);
    expect(job?.contractCents).toBeGreaterThan(0);

    const takeoff = await db.query<{
      revision_id: string;
      lead_id: string;
      job_id: string | null;
      revision_number: number;
      status: string;
      engine_version: string;
      job_input_sha256: string;
      calc_ledger_sha256: string;
      quantity_payload_sha256: string;
      quantity_model_version: string;
      created_at: string | Date;
      created_by: string;
      approved_at: string | Date;
      approved_by: string;
      blocking_issues: unknown;
      quantities: unknown;
      calc_ledger: unknown;
    }>('select * from takeoff_revisions where lead_id = $1', [first.leadId]);
    const row = takeoff.rows[0];
    expect(row).toBeDefined();
    const revision = ApprovedTakeoffRevisionSchema.parse({
      revisionId: row!.revision_id,
      leadId: row!.lead_id,
      jobId: row!.job_id,
      revisionNumber: row!.revision_number,
      status: row!.status,
      engineVersion: row!.engine_version,
      jobInputSha256: row!.job_input_sha256,
      calcLedgerSha256: row!.calc_ledger_sha256,
      quantityPayloadSha256: row!.quantity_payload_sha256,
      quantityModelVersion: row!.quantity_model_version,
      createdAt: new Date(row!.created_at).toISOString(),
      createdBy: row!.created_by,
      approvedAt: new Date(row!.approved_at).toISOString(),
      approvedBy: row!.approved_by,
      blockingIssues: row!.blocking_issues,
      quantities: row!.quantities,
      calcLedger: row!.calc_ledger,
    });
    const priced = priceApprovedTakeoff({
      revision,
      directLines: DEMO_DIRECT_LINES,
      measuredLines: DEMO_MEASURED_LINES,
      feeRateBps: DEMO_FEE_RATE_BPS,
    });
    expect(priced.blockers).toEqual([]);
    expect(priced.canIssue).toBe(true);
    expect(job?.contractCents).toBe(priced.totalCents);
    expect(priced.feeCents).toBe(Math.round(priced.directCostCents * DEMO_FEE_RATE_BPS / 10000));

    const gates = await service.listJobGates(first.jobId as Parameters<GateService['listJobGates']>[0]);
    expect(gates.find((gate) => gate.definitionKey === 'permit')?.status).toBe('released');
    expect(gates.find((gate) => gate.definitionKey === 'excavation')?.status).toBe('released');
    expect(gates.find((gate) => gate.definitionKey === 'pre-gunite')?.status).toBeNull();
    expect(gates.find((gate) => gate.definitionKey === 'shell')?.status).toBeNull();
    expect(gates.find((gate) => gate.definitionKey === 'cover-install')).toBeUndefined();
    expect(gates.find((gate) => gate.definitionKey === 'automation-programming-complete')).toBeUndefined();

    const cards = await service.getActionCards('2026-10-02');
    expect(cards.some((card) => card.jobId === first.jobId && card.customerName === DEMO_CUSTOMER_NAME)).toBe(true);

    const page = await new CustomerService(db).previewPage(first.jobId as Parameters<CustomerService['previewPage']>[0]);
    expect(page.customerName).toBe(DEMO_CUSTOMER_NAME);
    expect(page.addressLine).toContain('Lubbock');
    expect(page.updates.length).toBeGreaterThan(0);
    expect(page.photos.length).toBe(1);
    expect(page.photos[0]?.caption).toMatch(/hole is dug/i);
    const published = await db.query<{ definition_key: string }>(
      `select gi.definition_key
       from evidence_records er
       join gate_instances gi on gi.gate_instance_id = er.gate_instance_id
       where er.job_id = $1 and er.customer_visible = true`,
      [first.jobId],
    );
    expect(published.rows.map((row) => row.definition_key)).toEqual(['excavation']);

    const removed = await removeDemoProject(db);
    expect(removed.removed).toBe(true);
    expect(await counts()).toEqual({ leads: 0, jobs: 0, links: 0 });
    const users = await db.query<{ user_id: string }>(
      'select user_id from app_users order by user_id',
    );
    expect(users.rows.map((user) => user.user_id)).toEqual([otherUser]);
    expect(users.rows.some((user) => user.user_id === DEMO_USER_ID)).toBe(false);
    const kept = await db.query('select lead_id from leads where lead_id = $1', [otherLead]);
    expect(kept.rows).toHaveLength(1);

    const again = await seedDemoProject(db);
    expect(again.jobId).toBe(DEMO_JOB_ID);
    expect(again.customerPath).toBe(first.customerPath);
    expect(await counts()).toEqual({ leads: 1, jobs: 1, links: 1 });
    const staff = await db.query<{ email: string }>(
      'select email from app_users where user_id = $1',
      [DEMO_USER_ID],
    );
    expect(staff.rows[0]?.email).toBe(DEMO_USER_EMAIL);
  });

  it('deletes stored demo objects on remove and skips keys that were never valid', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'apex-demo-objects-'));
    const storage = new LocalEvidenceStorage(directory);
    try {
      const seeded = await seedDemoProject(db);
      const validKey = `${seeded.jobId}/demo/excavation/hole.jpg`;
      await storage.put(validKey, Buffer.from('jpeg'), 'image/jpeg');
      await db.query(
        `update evidence_records set storage_key = $2
         where evidence_id = (
           select er.evidence_id from evidence_records er
           join gate_instances gi on gi.gate_instance_id = er.gate_instance_id
           where er.job_id = $1 and gi.definition_key = 'excavation'
           limit 1
         )`,
        [seeded.jobId, validKey],
      );
      await removeDemoProject(db, storage);
      expect(await storage.get(validKey)).toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('remove is a no-op when the demo job was never seeded', async () => {
    const result = await removeDemoProject(db);
    expect(result.removed).toBe(false);
  });
});
