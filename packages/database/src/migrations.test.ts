import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { OPERATIONAL_MIGRATIONS, applyOperationalMigrations } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const migration = async (name: string) => readFile(resolve(here, '../migrations', name), 'utf8');

const ids = {
  lead: 'lead_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  job: 'job_01ARZ3NDEKTSV4RRFFQ69G5FAW',
  revision1: 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAX',
  revision2: 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAY',
  gate: 'gate_01ARZ3NDEKTSV4RRFFQ69G5FAZ',
  evidence: 'evidence_01ARZ3NDEKTSV4RRFFQ69G5FB0',
  event: 'event_01ARZ3NDEKTSV4RRFFQ69G5FB1',
  user: 'user_01ARZ3NDEKTSV4RRFFQ69G5FB2',
};

let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(await migration('0001_core.sql'));
  await db.exec(await migration('0002_rls.sql'));
  await db.exec(`
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key,
      bucket_id text not null,
      name text not null,
      owner_id uuid
    );
  `);
  await db.exec(await migration('0003_evidence_storage.sql'));
  await db.exec(await migration('0004_pre_gunite_definition.sql'));
  await db.exec(await migration('0005_gate_instance_uniqueness.sql'));
  await db.exec(await migration('0006_approved_takeoff_authority.sql'));
  await db.exec(await migration('0007_quantity_payload_digest.sql'));
  await db.exec(await migration('0008_proposal_versions.sql'));
});

const seedJob = async () => {
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name)
     values ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Test Admin')`,
    [ids.user],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'source-1', 'test:source-1', '{}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status)
     values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );
};

describe('operational schema', () => {
  it('registers the approved takeoff authority migration in the runtime migrator', () => {
    expect(OPERATIONAL_MIGRATIONS).toContain('0006_approved_takeoff_authority.sql');
    expect(OPERATIONAL_MIGRATIONS).toContain('0007_quantity_payload_digest.sql');
  });

  it('registers durable Proposal versions in the runtime migrator', () => {
    expect(OPERATIONAL_MIGRATIONS).toContain('0008_proposal_versions.sql');
  });

  it('executes every core and authorization migration in PostgreSQL', async () => {
    const legacy = new PGlite();
    for (const name of [
      '0001_core.sql',
      '0002_rls.sql',
      '0004_pre_gunite_definition.sql',
      '0005_gate_instance_uniqueness.sql',
      '0006_approved_takeoff_authority.sql',
    ]) {
      await legacy.exec(await migration(name));
    }
    await legacy.exec(`
      insert into app_users (user_id, auth_user_id, role, display_name)
      values ('${ids.user}', '00000000-0000-0000-0000-000000000001', 'admin', 'Test Admin');
      insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
      values ('${ids.lead}', 'test', 'legacy-source', 'test:legacy-source', '{}');
      insert into jobs (job_id, lead_id, signed_proposal_version, status)
      values ('${ids.job}', '${ids.lead}', 1, 'active');
      insert into takeoff_revisions
        (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantities, calc_ledger, created_by)
      values
        ('${ids.revision1}', '${ids.job}', 1, 'draft', 'designer-1', 'quantity-v1', repeat('a', 64), repeat('b', 64), '[]', '[]', '${ids.user}');
    `);
    await expect(legacy.exec(await migration('0007_quantity_payload_digest.sql'))).rejects.toThrow(/backfill quantity_payload_sha256/i);
    await legacy.close();
  });

  it('executes every core and authorization migration in PostgreSQL', async () => {
    const result = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining([
      'leads',
      'jobs',
      'takeoff_revisions',
      'gate_instances',
      'evidence_records',
      'requirement_evaluations',
      'events',
      // This fixture runs only 0001 and 0002, so the table still carries its
      // original name. The rename to `job_draws` lands in 0013.
      'draw_eligibility',
      'customer_milestone_projections',
    ]));
  });

  it('enforces atomic intake idempotency', async () => {
    await db.query(
      `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
       values ($1, 'website', 'submission-1', 'website:submission-1', '{}')`,
      [ids.lead],
    );
    await expect(db.query(
      `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
       values ('lead_01ARZ3NDEKTSV4RRFFQ69G5FB3', 'website', 'submission-2', 'website:submission-1', '{}')`,
    )).rejects.toThrow();
  });

  it('allows only one approved takeoff revision per job', async () => {
    await seedJob();
    const insert = (revisionId: string, revisionNumber: number) => db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, blocking_issues, created_by, approved_at, approved_by)
       values ($1, $2, $3, 'approved', 'designer-1', 'designer-quantity-v2', $4, $5, repeat('c', 64), '[{"code":"pool.water-volume"}]', '[{"id":"geom.total.volumeGal"}]', '[]', $6, now(), $6)`,
      [revisionId, ids.job, revisionNumber, 'a'.repeat(64), 'b'.repeat(64), ids.user],
    );
    await insert(ids.revision1, 1);
    await expect(insert(ids.revision2, 2)).rejects.toThrow();
  });

  it('rejects blocked approvals and protects approved quantity evidence from mutation', async () => {
    await seedJob();
    const insert = (blockingIssues: string) => db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, blocking_issues, created_by, approved_at, approved_by)
       values ($1, $2, 1, 'approved', 'designer-1', 'designer-quantity-v2', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume"}]', '[{"id":"geom.total.volumeGal"}]', $5, $6, now(), $6)`,
      [ids.revision1, ids.job, 'a'.repeat(64), 'b'.repeat(64), blockingIssues, ids.user],
    );

    await expect(insert('["gas-capacity"]')).rejects.toThrow();
    await insert('[]');
    await expect(db.query(
      `update takeoff_revisions set quantities = '[{"code":"pool.water-volume","value":99999}]' where revision_id = $1`,
      [ids.revision1],
    )).rejects.toThrow(/immutable/i);
  });

  it('persists a formatted quantity digest and makes it immutable with approved evidence', async () => {
    await seedJob();
    const insert = (revisionId: string, status: 'draft' | 'approved', digest: string) => db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, blocking_issues, created_by, approved_at, approved_by)
       values ($1, $2, 1, $3, 'designer-1', 'designer-quantity-v2', repeat('a', 64), repeat('b', 64), $4, '[{"code":"pool.water-volume"}]', '[{"id":"geom.total.volumeGal"}]', '[]', $5,
         case when $3 = 'approved' then now() else null end,
         case when $3 = 'approved' then $5 else null end)`,
      [revisionId, ids.job, status, digest, ids.user],
    );

    await expect(insert(ids.revision1, 'draft', 'not-a-sha256')).rejects.toThrow();
    await insert(ids.revision1, 'approved', 'c'.repeat(64));
    const stored = await db.query<{ quantity_payload_sha256: string }>(
      'select quantity_payload_sha256 from takeoff_revisions where revision_id = $1',
      [ids.revision1],
    );
    expect(stored.rows[0]?.quantity_payload_sha256).toBe('c'.repeat(64));
    await expect(db.query(
      `update takeoff_revisions set quantity_payload_sha256 = repeat('d', 64) where revision_id = $1`,
      [ids.revision1],
    )).rejects.toThrow(/immutable/i);
  });

  it('stores the current approved revision on the job and rejects non-approved pointers', async () => {
    await seedJob();
    const insert = (revisionId: string, revisionNumber: number, status: 'draft' | 'approved') => db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, blocking_issues, created_by, approved_at, approved_by)
       values ($1, $2, $3, $4, 'designer-1', 'designer-quantity-v2', $5, $6, repeat('c', 64), '[{"code":"pool.water-volume"}]', '[{"id":"geom.total.volumeGal"}]', '[]', $7,
         case when $4 = 'approved' then now() else null end,
         case when $4 = 'approved' then $7 else null end)`,
      [revisionId, ids.job, revisionNumber, status, 'a'.repeat(64), 'b'.repeat(64), ids.user],
    );
    await insert(ids.revision1, 1, 'approved');
    await db.query(`update jobs set current_takeoff_revision_id = $1 where job_id = $2`, [ids.revision1, ids.job]);
    const current = await db.query<{ current_takeoff_revision_id: string }>(
      `select current_takeoff_revision_id from jobs where job_id = $1`,
      [ids.job],
    );
    expect(current.rows[0]?.current_takeoff_revision_id).toBe(ids.revision1);

    await expect(db.query(
      `update takeoff_revisions set status = 'superseded' where revision_id = $1`,
      [ids.revision1],
    )).rejects.toThrow(/current revision/i);
    await db.query(`update jobs set current_takeoff_revision_id = null where job_id = $1`, [ids.job]);
    await db.query(`update takeoff_revisions set status = 'superseded' where revision_id = $1`, [ids.revision1]);
    await insert(ids.revision2, 2, 'draft');
    await expect(db.query(
      `update jobs set current_takeoff_revision_id = $1 where job_id = $2`,
      [ids.revision2, ids.job],
    )).rejects.toThrow(/approved/i);
  });

  it('stores evidence separately from requirement evaluation state', async () => {
    await seedJob();
    await db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, blocking_issues, created_by, approved_at, approved_by)
       values ($1, $2, 1, 'approved', 'designer-1', 'designer-quantity-v2', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume"}]', '[{"id":"geom.total.volumeGal"}]', '[]', $5, now(), $5)`,
      [ids.revision1, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.user],
    );

    await db.query(
      `insert into gate_instances (gate_instance_id, job_id, definition_key, definition_version, approved_takeoff_revision_id, status)
       values ($1, $2, 'pre-gunite', 1, $3, 'in-progress')`,
      [ids.gate, ids.job, ids.revision1],
    );
    await db.query(
      `insert into evidence_records
       (evidence_id, job_id, gate_instance_id, requirement_key, kind, storage_key, sha256, captured_at, captured_by, mime_type, byte_size, metadata)
       values ($1, $2, $3, 'steel-spacing', 'photo', $4, $5, now(), $6, 'image/jpeg', 100, '{}')`,
      [ids.evidence, ids.job, ids.gate, `${ids.job}/pre-gunite/steel.jpg`, 'c'.repeat(64), ids.user],
    );
    const columns = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'evidence_records'`,
    );
    expect(columns.rows.map((row) => row.column_name)).not.toEqual(expect.arrayContaining(['passed', 'outcome', 'status']));
  });

  it('makes durable events append-only', async () => {
    await seedJob();
    await db.query(
      `insert into events
       (event_id, schema_version, event_type, occurred_at, recorded_at, actor, lead_id, job_id, correlation_id, idempotency_key, payload)
       values ($1, 1, 'job.created', now(), now(), '{"kind":"system","system":"gate-api"}', $2, $3, $1, 'job-created-1', '{}')`,
      [ids.event, ids.lead, ids.job],
    );
    await expect(db.query(`update events set payload = '{"changed":true}' where event_id = $1`, [ids.event])).rejects.toThrow(/append-only/i);
    await expect(db.query(`delete from events where event_id = $1`, [ids.event])).rejects.toThrow(/append-only/i);
  });

  it('provisions a private evidence bucket with storage policies', async () => {
    const bucket = await db.query<{ id: string; public: boolean; file_size_limit: number }>(
      `select id, public, file_size_limit from storage.buckets where id = 'gate-evidence'`,
    );
    expect(bucket.rows).toEqual([{ id: 'gate-evidence', public: false, file_size_limit: 250_000_000 }]);
    const policies = await db.query<{ policyname: string }>(
      `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'`,
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual(expect.arrayContaining([
      'gate_evidence_staff_read',
      'gate_evidence_staff_insert',
    ]));
  });

  it('seeds the versioned pre-gunite hold point without chemistry advice', async () => {
    const requirements = await db.query<{ requirement_key: string }>(
      `select requirement_key from gate_requirements
       where definition_key = 'pre-gunite' and definition_version = 1
       order by sequence`,
    );
    expect(requirements.rows.map((row) => row.requirement_key)).toEqual([
      'approved-plan-on-site',
      'shell-dimensions',
      'steel-spacing',
      'bonding',
      'plumbing-pressure-test',
    ]);
    expect(requirements.rows.some((row) => row.requirement_key.includes('chem'))).toBe(false);
  });
});

/**
 * Row-level security is retired, not silently bypassed — migration 0019.
 *
 * The state this asserts against is the one 0019 exists to end: tables that
 * reported `rowsecurity = true` while every policy was skipped, because the
 * connection owned the tables and nothing ever set `request.jwt.claims`. The
 * schema asserted a protection that was not running.
 */
describe('retired row-level security', () => {
  it('leaves no table claiming a protection that is not enforced', async () => {
    const db = new PGlite();
    await applyOperationalMigrations(db);
    const enabled = await db.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and rowsecurity = true
       order by tablename`,
    );
    expect(enabled.rows.map((row) => row.tablename)).toEqual([]);
  });

  it('keeps the policy definitions, so re-enabling is a decision and not archaeology', async () => {
    const db = new PGlite();
    await applyOperationalMigrations(db);
    const policies = await db.query<{ count: string }>(
      `select count(*)::text as count from pg_policies where schemaname = 'public'`,
    );
    // Correct as written and free while inactive. Deleting them would make
    // turning RLS on later a rewrite rather than a switch.
    expect(Number(policies.rows[0]?.count)).toBeGreaterThan(20);
  });
});
