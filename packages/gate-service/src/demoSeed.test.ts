import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import {
  ApprovedTakeoffRevisionSchema,
  createCanonicalId,
} from '@apex/contracts';
import { priceApprovedTakeoff } from '@apex/pricing-engine';
import { LocalEvidenceStorage } from '@apex/storage';
import { CustomerService } from './customer.js';
import {
  DEMO_CITY,
  DEMO_CUSTOMER_NAME,
  DEMO_DIRECT_LINES,
  DEMO_FEE_RATE_BPS,
  DEMO_LEAD_KEY,
  DEMO_MEASURED_LINES,
  DEMO_STREET,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  RETIRED_DEMO_CUSTOMER_TOKEN,
  removeDemoProject,
  seedDemoProject,
} from './demoSeed.js';
import { GateService } from './index.js';

/**
 * The Lubbock DEMO job has to be safe to run twice against a real database,
 * and `--remove` has to leave every other row where it was.
 */

let db: PGlite;
let evidenceDir: string;
let storage: LocalEvidenceStorage;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  evidenceDir = await mkdtemp(join(tmpdir(), 'apex-demo-'));
  storage = new LocalEvidenceStorage(evidenceDir);
});

afterEach(async () => {
  await rm(evidenceDir, { recursive: true, force: true });
});

const customerTokenPattern = /^\/c\/[A-Za-z0-9_-]{43}$/;

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

    const first = await seedDemoProject(db, storage);
    const second = await seedDemoProject(db, storage);

    expect(second).toEqual(first);
    expect(first.customerPath).toMatch(customerTokenPattern);
    expect(first.customerPath).not.toBe(`/c/${RETIRED_DEMO_CUSTOMER_TOKEN}`);
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

    const cards = await service.getActionCards('2026-10-02');
    expect(cards.some((card) => card.jobId === first.jobId && card.customerName === DEMO_CUSTOMER_NAME)).toBe(true);

    const page = await new CustomerService(db).previewPage(first.jobId as Parameters<CustomerService['previewPage']>[0]);
    expect(page.customerName).toBe(DEMO_CUSTOMER_NAME);
    expect(page.addressLine).toContain('Lubbock');
    expect(page.updates.length).toBeGreaterThan(0);
    expect(page.photos.length).toBe(1);
    const photoRows = await db.query<{ storage_key: string; sha256: string; byte_size: string }>(
      `select storage_key, sha256, byte_size::text from evidence_records
       where job_id = $1 and kind = 'photo' and customer_visible = true`,
      [first.jobId],
    );
    expect(photoRows.rows).toHaveLength(1);
    const published = photoRows.rows[0]!;
    const bytes = await storage.get(published.storage_key);
    expect(bytes).not.toBeNull();
    expect(bytes!.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(published.sha256).toBe(createHash('sha256').update(bytes!).digest('hex'));
    expect(published.byte_size).toBe(String(bytes!.length));

    const removed = await removeDemoProject(db, storage);
    expect(removed.removed).toBe(true);
    expect(await counts()).toEqual({ leads: 0, jobs: 0, links: 0 });
    const users = await db.query<{ user_id: string }>(
      'select user_id from app_users order by user_id',
    );
    expect(users.rows.map((user) => user.user_id)).toEqual([otherUser]);
    expect(users.rows.some((user) => user.user_id === DEMO_USER_ID)).toBe(false);
    const kept = await db.query('select lead_id from leads where lead_id = $1', [otherLead]);
    expect(kept.rows).toHaveLength(1);

    const again = await seedDemoProject(db, storage);
    expect(again.jobId).not.toBe(first.jobId);
    expect(again.customerPath).toMatch(customerTokenPattern);
    expect(again.customerPath).not.toBe(first.customerPath);
    const keptToken = await seedDemoProject(db, storage);
    expect(keptToken).toEqual(again);
    expect(await counts()).toEqual({ leads: 1, jobs: 1, links: 1 });
    const staff = await db.query<{ email: string }>(
      'select email from app_users where user_id = $1',
      [DEMO_USER_ID],
    );
    expect(staff.rows[0]?.email).toBe(DEMO_USER_EMAIL);
  });

  it('remove is a no-op when the demo job was never seeded', async () => {
    const result = await removeDemoProject(db);
    expect(result.removed).toBe(false);
  });

  it('replaces the retired fixed token once and then keeps the new one', async () => {
    const first = await seedDemoProject(db, storage);
    const jobId = first.jobId;
    await db.query('delete from customer_links where job_id = $1', [jobId]);
    await db.query(
      `insert into customer_links (link_id, job_id, token_sha256, issued_by)
       values ($1, $2, $3, $4)`,
      [
        createCanonicalId('clink'),
        jobId,
        createHash('sha256').update(RETIRED_DEMO_CUSTOMER_TOKEN, 'utf8').digest('hex'),
        DEMO_USER_ID,
      ],
    );
    await db.query(
      `update leads set accepted_payload = accepted_payload - 'demoLinkToken' where idempotency_key = $1`,
      [DEMO_LEAD_KEY],
    );

    const rotated = await seedDemoProject(db, storage);
    expect(rotated.jobId).toBe(first.jobId);
    expect(rotated.customerPath).toMatch(customerTokenPattern);
    expect(rotated.customerPath).not.toBe(`/c/${RETIRED_DEMO_CUSTOMER_TOKEN}`);
    expect(rotated.customerPath).not.toBe(first.customerPath);
    const again = await seedDemoProject(db, storage);
    expect(again.customerPath).toBe(rotated.customerPath);
  });

  it('leaves the photo unpublished when no evidence store is passed, then uploads it later', async () => {
    const withoutStore = await seedDemoProject(db);
    const hidden = await new CustomerService(db).previewPage(
      withoutStore.jobId as Parameters<CustomerService['previewPage']>[0],
    );
    expect(hidden.photos).toEqual([]);
    const keys = await db.query<{ storage_key: string }>(
      'select storage_key from evidence_records where job_id = $1',
      [withoutStore.jobId],
    );
    expect(keys.rows.length).toBeGreaterThan(0);
    for (const row of keys.rows) {
      expect(row.storage_key).toMatch(
        /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)+\.[A-Za-z0-9]{1,8}$/,
      );
    }

    const withStore = await seedDemoProject(db, storage);
    expect(withStore.customerPath).toBe(withoutStore.customerPath);
    const shown = await new CustomerService(db).previewPage(
      withStore.jobId as Parameters<CustomerService['previewPage']>[0],
    );
    expect(shown.photos).toHaveLength(1);
    const published = await db.query<{ storage_key: string }>(
      `select storage_key from evidence_records
       where job_id = $1 and customer_visible = true`,
      [withStore.jobId],
    );
    const bytes = await storage.get(published.rows[0]!.storage_key);
    expect(bytes?.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });
});
