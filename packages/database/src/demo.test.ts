import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { applyOperationalMigrations, STORAGE_MIGRATION } from './index.js';
import {
  ApprovedTakeoffRevisionSchema,
  calculateQuantityPayloadSha256,
  type AuthoritativeQuantity,
} from '@apex/contracts';
import { beforeEach, describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const migration = async (name: string) => readFile(resolve(here, '../migrations', name), 'utf8');

// ANSI colors
const c: Record<string, ((s: string) => string) | undefined> = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const log = {
  step: (n: number, msg: string) => console.log(`\n${c.blue?.(`Step ${n}:`) ?? `Step ${n}:`} ${c.bold?.(msg) ?? msg}`),
  ok: (msg: string) => console.log(`  ${c.green?.('✓') ?? '✓'} ${msg}`),
  data: (label: string, value: string | number) => console.log(`    ${c.yellow?.(label) ?? label}: ${value}`),
};

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key, name text not null, public boolean not null, 
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table if not exists storage.objects (
      id uuid primary key, bucket_id text not null, name text not null, owner_id uuid
    );
  `);
  await applyOperationalMigrations(db);
  await db.exec(await migration(STORAGE_MIGRATION));
});

describe('Apex Operating System - Local Demo', () => {
  it('runs the full end-to-end flow', async () => {
    console.log(c.bold?.('\n🚀 Apex Operating System - Full Flow Demo\n') ?? '\n🚀 Apex Operating System - Full Flow Demo\n');

    // Step 1: Database ready
    log.step(1, 'Database initialized');
    log.ok('All migrations applied');

    // Step 2: Seed users and leads
    log.step(2, 'Seeding users and leads');
    const userId = 'user_01TESTTESTTESTTESTTESTTEST';
    const leadId = 'lead_01TESTTESTTESTTESTTESTTEST';
    
    await db.query(
      `insert into app_users (user_id, auth_user_id, role, display_name)
       values ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Demo Admin')`,
      [userId]
    );
    await db.query(
      `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
       values ($1, 'website', 'demo-001', 'demo-key-001', '{"name":"Demo Customer"}')`,
      [leadId]
    );
    log.ok('Created admin user and lead');
    log.data('Lead ID', leadId);

    // Step 3: Create Job and Takeoff
    log.step(3, 'Creating Job and Takeoff Revision');
    const jobId = 'job_01TESTTESTTESTTESTTESTTEST';
    const revisionId = 'revision_01TESTTESTTESTTESTTESTTEST';
    
    await db.query(
      `insert into jobs (job_id, lead_id, signed_proposal_version, status)
       values ($1, $2, 1, 'active')`,
      [jobId, leadId]
    );
    /*
     * A CONTRACT-VALID approved revision, not an illustrative one.
     *
     * This previously carried a repeat('c', 64) digest, a quantity with no calcId, and a Calc
     * ledger entry missing formula/inputs/value/unit. Nothing here asserted on any of it, so it
     * passed — but this file is a narrated walkthrough of the lifecycle, and the shape it walks
     * through is the shape a reader copies. It could never have been served as pricing
     * authority: GET /api/jobs/:jobId/approved-takeoff answers 409 for exactly this row.
     *
     * The digest is derived rather than typed, so the demo cannot drift from the contract.
     */
    const demoQuantities: AuthoritativeQuantity[] = [
      { code: 'pool.water-volume', value: 12881, unit: 'gal', calcId: 'geom.total.volumeGal' },
    ];
    const demoCalcLedger = [
      {
        id: 'geom.total.volumeGal',
        label: 'Total volume',
        formula: 'V = A_surface x d_avg x 7.48',
        inputs: [
          { symbol: 'A_surface', label: 'Surface area', value: 336, unit: 'sf' },
          { symbol: 'd_avg', label: 'Average depth', value: 5.12, unit: 'ft' },
        ],
        value: 12881,
        unit: 'gal',
      },
    ];
    const demoQuantityDigest = calculateQuantityPayloadSha256(demoQuantities);
    await db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version,
        job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger,
        blocking_issues, created_by, approved_at, approved_by)
       values ($1, $2, 1, 'approved', 'designer-1', 'designer-quantity-v2',
               repeat('a', 64), repeat('b', 64), $4, $5, $6,
               '[]', $3, now(), $3)`,
      [revisionId, jobId, userId, demoQuantityDigest, JSON.stringify(demoQuantities), JSON.stringify(demoCalcLedger)]
    );
    /*
     * Prove the demo's revision is servable, rather than trusting that it looks right.
     *
     * Without this the data drifts back the moment someone edits it: nothing else in this file
     * asserts on the revision at all, which is exactly how it came to carry a placeholder
     * digest and a quantity with no calcId. This is the same schema
     * GET /api/jobs/:jobId/approved-takeoff validates against before serving.
     */
    ApprovedTakeoffRevisionSchema.parse({
      revisionId,
      leadId,
      jobId,
      revisionNumber: 1,
      status: 'approved',
      engineVersion: 'designer-1',
      jobInputSha256: 'a'.repeat(64),
      calcLedgerSha256: 'b'.repeat(64),
      quantityPayloadSha256: demoQuantityDigest,
      quantityModelVersion: 'designer-quantity-v2',
      createdAt: new Date().toISOString(),
      createdBy: userId,
      approvedAt: new Date().toISOString(),
      approvedBy: userId,
      blockingIssues: [],
      quantities: demoQuantities,
      calcLedger: demoCalcLedger,
    });

    log.ok('Created job and approved takeoff revision');
    log.data('Job ID', jobId);

    // Step 4: Create Proposal
    log.step(4, 'Creating Proposal and Version');
    const proposalId = 'proposal_01TESTTESTTESTTESTTESTTEST';
    const proposalVersionId = 'proposal_version_01TESTTESTTESTTESTTESTTEST';
    
    await db.query(
      `insert into proposals (proposal_id, lead_id, current_version)
       values ($1, $2, 1)`,
      [proposalId, leadId]
    );
    await db.query(
      `insert into proposal_versions
       (proposal_version_id, proposal_id, lead_id, job_id, version_number, status,
        takeoff_revision_id, quantity_payload_sha256, quantity_model_version,
        pricing_library_version, proposal_payload_sha256, proposal_payload,
        total_cents, created_by, created_at)
       values ($1, $2, $3, null, 1, 'draft', $4, $6, 'designer-quantity-v2',
               'proposal-pricing-v1', repeat('d', 64), '{"status":"draft","total":100000}',
               100000, $5, now())`,
      // The SAME digest as the revision it is priced from. A proposal version pinning a
      // different hash than its own takeoff revision is the precise thing the digest exists
      // to make impossible, so the demo must not depict it.
      [proposalVersionId, proposalId, leadId, revisionId, userId, demoQuantityDigest]
    );
    log.ok('Created draft proposal');
    log.data('Proposal Version ID', proposalVersionId);

    // Step 5: Issue and Sign
    log.step(5, 'Issuing and Signing Proposal');
    await db.query(
      `update proposal_versions
       set status = 'issued', issued_at = now(), issued_by = $1
       where proposal_version_id = $2`,
      [userId, proposalVersionId]
    );
    log.ok('Proposal issued');
    
    await db.query(
      `update proposal_versions
       set status = 'signed', signed_at = now(), job_id = $1
       where proposal_version_id = $2`,
      [jobId, proposalVersionId]
    );
    log.ok('Proposal signed - job.bound event emitted');

    // Step 6: Verify job.bound
    log.step(6, 'Verifying job.bound Event');
    const events = await db.query<{ event_type: string; payload: Record<string, unknown> }>(
      `select event_type, payload from events where job_id = $1`,
      [jobId]
    );
    const jobBound = events.rows.find((e) => e.event_type === 'job.bound');
    
    expect(jobBound).toBeDefined();
    log.ok('job.bound event found!');
    log.data('Event Type', jobBound!.event_type);
    log.data('Proposal Version', jobBound!.payload.signedProposalVersionId as string);
    log.data('Signed At', jobBound!.payload.signedAt as string);

    // Step 7: Summary
    log.step(7, 'Database State Summary');
    const tables = ['leads', 'jobs', 'takeoff_revisions', 'proposals', 'proposal_versions', 'events'];
    for (const table of tables) {
      const result = await db.query<{ count: string }>(`select count(*) as count from ${table}`);
      log.data(table, result.rows[0]?.count ?? '0');
    }

    console.log('\n' + (c.bold?.(c.green?.('✅ Full end-to-end flow completed successfully!') ?? '✅ Full end-to-end flow completed successfully!') ?? '✅ Full end-to-end flow completed successfully!'));
    console.log(c.cyan?.('Flow: Lead → Job → Takeoff → Proposal → Sign → job.bound event') ?? 'Flow: Lead → Job → Takeoff → Proposal → Sign → job.bound event');
  });
});