import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId } from '@apex/contracts';
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGateApi } from './server.js';

const secretText = 'test-only-secret-that-is-more-than-thirty-two-bytes';
const secret = new TextEncoder().encode(secretText);
const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  field: createCanonicalId('user'),
  office: createCanonicalId('user'),
  customer: createCanonicalId('user'),
};

let db: PGlite;
let storage: string;
let server: ReturnType<typeof createGateApi>;
let baseUrl: string;

const token = (userId: string, role: 'field' | 'office' | 'customer') =>
  new SignJWT({ app_role: role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('apex-gate')
    .setAudience('apex-gate-api')
    .setExpirationTime('5m')
    .sign(secret);

const call = async (path: string, bearer: string, init: RequestInit = {}) => fetch(`${baseUrl}${path}`, {
  ...init,
  headers: {
    authorization: `Bearer ${bearer}`,
    'content-type': 'application/json',
    ...init.headers,
  },
});

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  storage = await mkdtemp(join(tmpdir(), 'apex-gate-evidence-'));
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000011', 'field', 'Field Lead'),
     ($2, '00000000-0000-0000-0000-000000000012', 'office', 'Office User'),
     ($3, '00000000-0000-0000-0000-000000000013', 'customer', 'Customer')`,
    [ids.field, ids.office, ids.customer],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'api-source', 'test:api-source', '{}')`,
    [ids.lead],
  );
  await db.query(`insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`, [ids.job, ids.lead]);
  await db.query(
    `insert into job_customer_access (job_id, auth_user_id) values ($1, '00000000-0000-0000-0000-000000000013')`, [ids.job],
  );
  await db.query(
    `insert into takeoff_revisions
     (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, '{}', '[]', $5, now(), $5)`,
    [ids.revision, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.office],
  );
  server = createGateApi({ db, jwtSecret: secretText, evidenceDirectory: storage, maxEvidenceBytes: 1024 });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(storage, { recursive: true, force: true });
});

describe('Gate HTTP vertical slice', () => {
  it('runs approved revision through evidence, release, draw, and customer-safe publication', async () => {
    const field = await token(ids.field, 'field');
    const customer = await token(ids.customer, 'customer');
    const create = await call(`/api/jobs/${ids.job}/gates/pre-gunite`, field, { method: 'POST', body: '{}' });
    expect(create.status).toBe(201);
    const gate = await create.json() as { gateInstanceId: string; requirements: Array<{ key: string; acceptedEvidenceKinds: string[] }> };

    const start = await call(`/api/gates/${gate.gateInstanceId}/start`, field, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-start-0001' },
    });
    expect(start.status).toBe(200);

    let firstEvidenceId = '';
    for (const requirement of gate.requirements) {
      const uploadBody = JSON.stringify({
        requirementKey: requirement.key,
        kind: requirement.acceptedEvidenceKinds[0],
        mimeType: 'image/jpeg',
        contentBase64: Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.from(`proof:${requirement.key}`),
        ]).toString('base64'),
        capturedAt: '2026-07-29T15:00:00.000Z',
      });
      const evidenceIdempotencyKey = `api-evidence-${requirement.key}`;
      const upload = await call(`/api/gates/${gate.gateInstanceId}/evidence`, field, {
        method: 'POST',
        headers: { 'idempotency-key': evidenceIdempotencyKey },
        body: uploadBody,
      });
      expect(upload.status).toBe(201);
      const uploaded = await upload.json() as { evidenceId: string };
      firstEvidenceId ||= uploaded.evidenceId;
      if (requirement === gate.requirements[0]) {
        const duplicate = await call(`/api/gates/${gate.gateInstanceId}/evidence`, field, {
          method: 'POST', headers: { 'idempotency-key': evidenceIdempotencyKey }, body: uploadBody,
        });
        expect(duplicate.status).toBe(200);
        const evidenceRows = await db.query(`select evidence_id from evidence_records`);
        expect(evidenceRows.rows).toHaveLength(1);
      }

      const evaluate = await call(`/api/gates/${gate.gateInstanceId}/requirements/${requirement.key}/evaluate`, field, {
        method: 'POST',
        headers: { 'idempotency-key': `api-evaluate-${requirement.key}` },
        body: JSON.stringify({ outcome: 'passed' }),
      });
      expect(evaluate.status).toBe(200);
    }

    const proof = await call(`/api/evidence/${firstEvidenceId}`, field);
    expect(proof.status).toBe(200);
    expect(proof.headers.get('cache-control')).toBe('private, no-store');

    const release = await call(`/api/gates/${gate.gateInstanceId}/release`, field, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-release-0001' },
    });
    expect(release.status).toBe(200);
    const released = await release.json() as { state: { status: string }; events: Array<{ eventType: string }> };
    expect(released.state.status).toBe('released');
    expect(released.events.map((event) => event.eventType)).toEqual(['gate.released', 'draw.eligible', 'customer_update.published']);

    const milestones = await call(`/api/customer/jobs/${ids.job}/milestones`, customer);
    expect(milestones.status).toBe(200);
    const customerBody = await milestones.json() as Array<Record<string, unknown>>;
    expect(customerBody).toHaveLength(1);
    expect(customerBody[0]).not.toHaveProperty('evidenceIds');
    expect(customerBody[0]).not.toHaveProperty('storageKey');

    const forbiddenInternal = await call(`/api/gates/${gate.gateInstanceId}`, customer);
    expect(forbiddenInternal.status).toBe(403);
  });

  it('requires authentication and idempotency headers', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const consolePage = await fetch(`${baseUrl}/`);
    expect(consolePage.status).toBe(200);
    expect(consolePage.headers.get('content-security-policy')).toContain("object-src 'none'");
    expect(await consolePage.text()).toContain('Pre-gunite Gate');
    const unauthenticated = await fetch(`${baseUrl}/api/jobs/${ids.job}/gates/pre-gunite`, { method: 'POST' });
    expect(unauthenticated.status).toBe(403);
    const invalid = await call(`/api/jobs/${ids.job}/gates/pre-gunite`, 'not-a-valid-token', { method: 'POST' });
    expect(invalid.status).toBe(403);
    const mismatchedRole = await token(ids.field, 'office');
    const mismatched = await call(`/api/jobs/${ids.job}/gates/pre-gunite`, mismatchedRole, { method: 'POST' });
    expect(mismatched.status).toBe(403);
    const field = await token(ids.field, 'field');
    const create = await call(`/api/jobs/${ids.job}/gates/pre-gunite`, field, { method: 'POST', body: '{}' });
    const gate = await create.json() as { gateInstanceId: string };
    const withoutKey = await call(`/api/gates/${gate.gateInstanceId}/start`, field, { method: 'POST', body: '{}' });
    expect(withoutKey.status).toBe(422);
    await db.query(`update app_users set active = false where user_id = $1`, [ids.field]);
    const inactive = await call(`/api/gates/${gate.gateInstanceId}`, field);
    expect(inactive.status).toBe(403);
    await db.query(`update app_users set active = true where user_id = $1`, [ids.field]);
    const start = await call(`/api/gates/${gate.gateInstanceId}/start`, field, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'security-start-0001' },
    });
    expect(start.status).toBe(200);
    const mismatchedMime = await call(`/api/gates/${gate.gateInstanceId}/evidence`, field, {
      method: 'POST', headers: { 'idempotency-key': 'security-proof-0001' },
      body: JSON.stringify({
        requirementKey: 'approved-plan-on-site', kind: 'photo', mimeType: 'image/jpeg',
        contentBase64: Buffer.from('not really a jpeg').toString('base64'),
        capturedAt: '2026-07-29T15:00:00.000Z',
      }),
    });
    expect(mismatchedMime.status).toBe(422);
  });
});
