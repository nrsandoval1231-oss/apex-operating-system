import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { applyOperationalMigrations } from '@apex/database';
import {
  ActionCardListSchema,
  DailyBriefSchema,
  calculateQuantityPayloadSha256,
  createCanonicalId,
  type AuthoritativeQuantity,
} from '@apex/contracts';
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalEvidenceStorage } from '@apex/storage';
import { createGateApi } from './server.js';

const FIXTURE_QUANTITIES: AuthoritativeQuantity[] = [
  { code: 'pool.water-volume', value: 1, unit: 'gal', calcId: 'fixture.calc' },
];

const secretText = 'test-only-secret-that-is-more-than-thirty-two-bytes';
const secret = new TextEncoder().encode(secretText);
const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  field: createCanonicalId('user'),
  office: createCanonicalId('user'),
  customer: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  owner: createCanonicalId('user'),
};

let db: PGlite;
let storage: string;
let server: ReturnType<typeof createGateApi>;
let baseUrl: string;

const token = (userId: string, role: 'field' | 'office' | 'superintendent' | 'admin' | 'customer') =>
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
     ($3, '00000000-0000-0000-0000-000000000013', 'customer', 'Customer'),
     ($4, '00000000-0000-0000-0000-000000000014', 'superintendent', 'Site Super'),
     ($5, '00000000-0000-0000-0000-000000000015', 'admin', 'Travis')`,
    [ids.field, ids.office, ids.customer, ids.superintendent, ids.owner],
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
  // The digest is derived rather than a `repeat('c', 64)` placeholder, because
  // GET /approved-takeoff validates it before serving and a placeholder is exactly
  // the corrupt row it exists to refuse. Nothing else here reads it, so this only
  // makes the fixture honest about what it claims to be.
  await db.query(
    `insert into takeoff_revisions
     (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, $6, $7, '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
    [
      ids.revision, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.office,
      calculateQuantityPayloadSha256(FIXTURE_QUANTITIES),
      JSON.stringify(FIXTURE_QUANTITIES),
    ],
  );
  server = createGateApi({ db, jwtSecret: secretText, storage: new LocalEvidenceStorage(storage), maxEvidenceBytes: 1024 });
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

    // Pre-gunite takes two signatures: the superintendent signs, the owner
    // countersigns. Gunite buries the rebar, so nobody releases it alone.
    const superintendent = await token(ids.superintendent, 'superintendent');
    const ownerToken = await token(ids.owner, 'admin');

    // And the city has to have cleared it. Three inspections gate the pour, and
    // the release refuses until each is recorded — which is §9.7's "block
    // dependent work" meaning the release actually fails, not that a warning
    // was shown.
    for (const key of ['pool-steel-structural', 'equipotential-bonding', 'plumbing-pressure-test']) {
      const recorded = await call(`/api/jobs/${ids.job}/inspections/${key}/result`, superintendent, {
        method: 'POST',
        body: JSON.stringify({ outcome: 'passed', occurredOn: '2026-07-29' }),
      });
      expect(recorded.status).toBe(200);
    }

    const signoff = await call(`/api/gates/${gate.gateInstanceId}/release`, superintendent, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-release-0001' },
    });
    expect(signoff.status).toBe(200);
    const signed = await signoff.json() as { state: { status: string }; events: Array<{ eventType: string }> };
    expect(signed.state.status).toBe('awaiting-countersign');
    expect(signed.events.map((event) => event.eventType)).toEqual(['gate.signoff_recorded']);

    // The same superintendent cannot finish the job on his own.
    const selfCountersign = await call(`/api/gates/${gate.gateInstanceId}/countersign`, superintendent, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-self-countersign-1' },
    });
    expect(selfCountersign.status).toBe(409);

    const release = await call(`/api/gates/${gate.gateInstanceId}/countersign`, ownerToken, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-countersign-0001' },
    });
    expect(release.status).toBe(200);
    const released = await release.json() as { state: { status: string }; events: Array<{ eventType: string }> };
    expect(released.state.status).toBe('released');
    // Pre-gunite bears no draw, so releasing it creates no draw eligibility.
    expect(released.events.map((event) => event.eventType)).toEqual(['gate.countersigned', 'gate.released', 'customer_update.published']);

    const milestones = await call(`/api/customer/jobs/${ids.job}/milestones`, customer);
    expect(milestones.status).toBe(200);
    const customerBody = await milestones.json() as Array<Record<string, unknown>>;
    expect(customerBody).toHaveLength(1);
    expect(customerBody[0]).not.toHaveProperty('evidenceIds');
    expect(customerBody[0]).not.toHaveProperty('storageKey');

    const forbiddenInternal = await call(`/api/gates/${gate.gateInstanceId}`, customer);
    expect(forbiddenInternal.status).toBe(403);
  });

  it('opens a construction project, advances its phase, and keeps the history', async () => {
    const office = await token(ids.office, 'office');
    const superintendent = await token(ids.superintendent, 'superintendent');
    const customer = await token(ids.customer, 'customer');

    const before = await call(`/api/jobs/${ids.job}/project`, office);
    expect(before.status).toBe(404);

    const opened = await call(`/api/jobs/${ids.job}/project`, office, {
      method: 'POST',
      body: JSON.stringify({ initialPhaseKey: 'layout-excavation', superintendentUserId: ids.superintendent }),
      headers: { 'idempotency-key': 'api-open-project-1' },
    });
    expect(opened.status).toBe(201);
    expect(await opened.json()).toMatchObject({
      currentPhaseKey: 'layout-excavation',
      customerMilestone: 'excavation',
      superintendentName: 'Site Super',
    });

    const skipped = await call(`/api/jobs/${ids.job}/project/phase`, superintendent, {
      method: 'POST',
      body: JSON.stringify({ toPhaseKey: 'gunite' }),
      headers: { 'idempotency-key': 'api-skip-phase-1' },
    });
    expect(skipped.status).toBe(409);
    expect(await skipped.json()).toMatchObject({ error: expect.stringMatching(/recorded reason/i) });

    const advanced = await call(`/api/jobs/${ids.job}/project/phase`, superintendent, {
      method: 'POST',
      body: JSON.stringify({ toPhaseKey: 'steel-reinforcement' }),
      headers: { 'idempotency-key': 'api-advance-phase-1' },
    });
    expect(advanced.status).toBe(200);
    expect(await advanced.json()).toMatchObject({ currentPhaseKey: 'steel-reinforcement', customerMilestone: 'shell' });

    const history = await call(`/api/jobs/${ids.job}/project/history`, office);
    expect(await history.json()).toEqual([
      expect.objectContaining({ fromPhaseKey: null, toPhaseKey: 'layout-excavation' }),
      expect.objectContaining({ fromPhaseKey: 'layout-excavation', toPhaseKey: 'steel-reinforcement' }),
    ]);

    // The job summary now carries the project, and customers still see none of it.
    const detail = await call(`/api/jobs/${ids.job}`, office);
    expect(await detail.json()).toMatchObject({
      project: { currentPhaseKey: 'steel-reinforcement', currentPhaseSequence: 3 },
    });
    for (const path of [`/api/jobs/${ids.job}/project`, `/api/jobs/${ids.job}/project/history`]) {
      expect((await call(path, customer)).status).toBe(403);
    }
    const customerWrite = await call(`/api/jobs/${ids.job}/project/phase`, customer, {
      method: 'POST',
      body: JSON.stringify({ toPhaseKey: 'gunite', reason: 'no' }),
      headers: { 'idempotency-key': 'api-customer-phase-1' },
    });
    expect(customerWrite.status).toBe(403);
  });

  it('serves the daily brief, frozen per day, and refuses customers', async () => {
    const office = await token(ids.office, 'office');
    const customer = await token(ids.customer, 'customer');

    const first = await call('/api/brief?date=2026-08-02', office);
    expect(first.status).toBe(200);
    const brief = DailyBriefSchema.parse(await first.json());
    expect(brief.briefDate).toBe('2026-08-02');
    expect(brief.previousBriefDate).toBeNull();

    // Asking again returns the brief that was delivered, not a fresh one.
    const again = DailyBriefSchema.parse(await (await call('/api/brief?date=2026-08-02', office)).json());
    expect(again.briefId).toBe(brief.briefId);
    expect(again.generatedAt).toBe(brief.generatedAt);

    const nextDay = DailyBriefSchema.parse(await (await call('/api/brief?date=2026-08-03', office)).json());
    expect(nextDay.previousBriefDate).toBe('2026-08-02');

    expect((await call('/api/brief?date=nope', office)).status).toBe(422);
    expect((await call('/api/brief', customer)).status).toBe(403);
  });

  /**
   * The measured authority a customer proposal is priced from. Before this route existed the
   * quantities were reachable only by querying Postgres directly, so the Proposal engine could
   * never issue against a real approved takeoff.
   */
  it('serves the approved takeoff revision to staff, with its quantities and calc ledger', async () => {
    const office = await token(ids.office, 'office');
    const response = await call(`/api/jobs/${ids.job}/approved-takeoff`, office);
    expect(response.status).toBe(200);

    const revision = await response.json() as {
      revisionId: string; jobId: string; leadId: string; status: string;
      quantityPayloadSha256: string;
      quantities: Array<{ code: string; value: number; unit: string; calcId: string }>;
      calcLedger: Array<{ id: string }>;
      blockingIssues: unknown[];
    };
    expect(revision.revisionId).toBe(ids.revision);
    expect(revision.jobId).toBe(ids.job);
    expect(revision.leadId).toBe(ids.lead);
    expect(revision.status).toBe('approved');
    expect(revision.blockingIssues).toEqual([]);
    expect(revision.quantities).toHaveLength(1);
    expect(revision.quantities[0]?.code).toBe('pool.water-volume');
    expect(revision.calcLedger[0]?.id).toBe('fixture.calc');
    // Served intact: the digest still describes the quantities that came with it, so the
    // Proposal engine's independent re-derivation will agree.
    expect(revision.quantityPayloadSha256).toBe(calculateQuantityPayloadSha256(FIXTURE_QUANTITIES));
  });

  it('never serves the approved takeoff to a customer', async () => {
    const customer = await token(ids.customer, 'customer');
    expect((await call(`/api/jobs/${ids.job}/approved-takeoff`, customer)).status).toBe(403);
  });

  /**
   * The write half of the same route — the Designer bridge. `ids.job` already
   * carries an approved revision from the fixture, which makes it the right job to
   * prove the refusal on and the wrong one to prove a first approval on.
   */
  describe('recording an approved takeoff over HTTP', () => {
    const submission = {
      engineVersion: 'designer-0.1.0',
      quantityModelVersion: 'designer-quantity-v4',
      jobModel: { lengthFt: 30, widthFt: 15 },
      quantities: [{ code: 'pool.wetted-area', value: 900, unit: 'sf', calcId: 'bridge.calc' }],
      calcLedger: [
        { id: 'bridge.calc', label: 'Wetted area', formula: 'A = f + w', inputs: [], value: 900, unit: 'sf' },
      ],
    };
    const send = (jobId: string, bearer: string, body: unknown) => call(
      `/api/jobs/${jobId}/approved-takeoff`,
      bearer,
      { method: 'POST', body: JSON.stringify(body), headers: { 'idempotency-key': createCanonicalId('event') } },
    );

    const freshJob = async () => {
      const leadId = createCanonicalId('lead');
      const jobId = createCanonicalId('job');
      await db.query(
        `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
         values ($1, 'test', $2, $3, '{}')`,
        [leadId, `src-${jobId}`, `key-${jobId}`],
      );
      await db.query(
        `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
        [jobId, leadId],
      );
      return jobId;
    };

    it('accepts a Designer export from the office and serves it straight back as authority', async () => {
      const office = await token(ids.office, 'office');
      const jobId = await freshJob();

      const created = await send(jobId, office, submission);
      expect(created.status).toBe(201);

      const served = await call(`/api/jobs/${jobId}/approved-takeoff`, office);
      expect(served.status).toBe(200);
      expect((await served.json() as { quantities: unknown[] }).quantities).toHaveLength(1);
    });

    /** A homeowner cannot decide what was measured. */
    it('refuses a customer', async () => {
      const customer = await token(ids.customer, 'customer');
      expect((await send(await freshJob(), customer, submission)).status).toBe(403);
    });

    /** Releasing a Gate and deciding the quantities behind it are different acts. */
    it('refuses a superintendent with 409 rather than letting the role decide quantities', async () => {
      const superintendent = await token(ids.superintendent, 'superintendent');
      expect((await send(await freshJob(), superintendent, submission)).status).toBe(409);
    });

    /** Replacing priced authority has to be asked for. */
    it('refuses a second approval that does not ask to supersede', async () => {
      const office = await token(ids.office, 'office');
      const response = await send(ids.job, office, submission);
      expect(response.status).toBe(409);
      expect((await response.json() as { error: string }).error).toMatch(/already has an approved takeoff/i);
    });

    /**
     * A digest is not something a caller gets to assert. Sending one is a sign the
     * client thinks it owns the evidence, and the strict schema says otherwise.
     */
    it('rejects a submission that tries to supply its own digest', async () => {
      const office = await token(ids.office, 'office');
      const response = await send(await freshJob(), office, {
        ...submission,
        quantityPayloadSha256: 'f'.repeat(64),
      });
      expect(response.status).toBe(422);
    });
  });

  /**
   * Rows seeded before the digest was enforced carry placeholder hashes and quantities with no
   * calcId. They are not authority and never were, so the answer has to distinguish "your
   * request was wrong" (422) from "this record cannot be trusted" — otherwise the operator
   * retries instead of fixing the data.
   */
  it('409s when the stored revision fails its own integrity contract', async () => {
    const office = await token(ids.office, 'office');
    /*
     * Seeded wrong at INSERT, not edited afterwards. An approved revision cannot be tampered
     * with in place — the database answers "Approved takeoff quantity evidence is immutable"
     * to any such update — so the only way a corrupt one exists is to have been written that
     * way, which is precisely what the pre-digest demo seed does.
     */
    const staleLead = createCanonicalId('lead');
    const staleJob = createCanonicalId('job');
    const staleRevision = createCanonicalId('revision');
    await db.query(
      `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
       values ($1, 'test', 'source-stale', 'test:source-stale', '{}')`,
      [staleLead],
    );
    await db.query(
      `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
      [staleJob, staleLead],
    );
    await db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version,
        job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger,
        created_by, approved_at, approved_by)
       values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1',
               repeat('a', 64), repeat('b', 64), repeat('c', 64), $4, $5, $3, now(), $3)`,
      [
        staleRevision, staleJob, ids.office,
        JSON.stringify(FIXTURE_QUANTITIES),
        '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]',
      ],
    );

    const response = await call(`/api/jobs/${staleJob}/approved-takeoff`, office);
    expect(response.status).toBe(409);
    const body = await response.json() as { error: string; detail: string };
    expect(body.error).toMatch(/integrity contract/i);
    expect(body.detail).toMatch(/SHA-256/i);
  });

  it('404s for a job with no approved takeoff, without saying whether the job exists', async () => {
    const office = await token(ids.office, 'office');
    const unknownJob = createCanonicalId('job');
    const response = await call(`/api/jobs/${unknownJob}/approved-takeoff`, office);
    expect(response.status).toBe(404);
  });

  it('requires a token when local pilot mode is off', async () => {
    // The default server in this suite has no localUserId configured.
    const anonymous = await fetch(`${baseUrl}/api/today`);
    expect(anonymous.status).toBe(403);
  });

  it('serves a local request with no token when local pilot mode is on', async () => {
    const local = createGateApi({
      db, jwtSecret: secretText, storage: new LocalEvidenceStorage(storage), localUserId: ids.office,
    });
    await new Promise<void>((done) => local.listen(0, '127.0.0.1', done));
    const localUrl = `http://127.0.0.1:${(local.address() as AddressInfo).port}`;
    try {
      const feed = await fetch(`${localUrl}/api/today?today=2026-07-31`);
      expect(feed.status).toBe(200);
      expect(ActionCardListSchema.parse(await feed.json()).length).toBeGreaterThan(0);

      // A token still wins when one is supplied, so roles stay switchable.
      const asCustomer = await fetch(`${localUrl}/api/today`, {
        headers: { authorization: `Bearer ${await token(ids.customer, 'customer')}` },
      });
      expect(asCustomer.status).toBe(403);

      // An inactive or unknown local user is refused rather than assumed.
      const unknown = createGateApi({
        db, jwtSecret: secretText, storage: new LocalEvidenceStorage(storage), localUserId: createCanonicalId('user'),
      });
      await new Promise<void>((done) => unknown.listen(0, '127.0.0.1', done));
      const unknownUrl = `http://127.0.0.1:${(unknown.address() as AddressInfo).port}`;
      try {
        expect((await fetch(`${unknownUrl}/api/today`)).status).toBe(403);
      } finally {
        await new Promise((done) => unknown.close(done));
      }
    } finally {
      await new Promise((done) => local.close(done));
    }
  });

  it('refuses to create a draw schedule without a signed contract, and keeps money staff-only', async () => {
    const office = await token(ids.office, 'office');
    const field = await token(ids.field, 'field');
    const customer = await token(ids.customer, 'customer');

    // The seeded job has no signed proposal, so there is no total to divide.
    const premature = await call(`/api/jobs/${ids.job}/draws`, office, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-draws-0001' },
    });
    expect(premature.status).toBe(409);

    const empty = await call(`/api/jobs/${ids.job}/draws`, office);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ draws: [], collectedCents: 0 });

    // Creating a schedule and confirming an invoice are the owner's and the
    // office's, never the field's.
    const fieldAttempt = await call(`/api/jobs/${ids.job}/draws`, field, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-draws-0002' },
    });
    expect(fieldAttempt.status).toBe(409);

    const invoiceAttempt = await call(`/api/jobs/${ids.job}/draws/deposit/invoice`, field, {
      method: 'POST',
      body: JSON.stringify({ invoiceReference: 'QB-1' }),
    });
    expect(invoiceAttempt.status).toBe(409);

    expect((await call(`/api/jobs/${ids.job}/draws`, customer)).status).toBe(403);
  });

  it('serves the action feed to staff, pinned to a day, and refuses customers', async () => {
    const office = await token(ids.office, 'office');
    const customer = await token(ids.customer, 'customer');

    const feedResponse = await call('/api/today?today=2026-07-31', office);
    expect(feedResponse.status).toBe(200);
    const feed = ActionCardListSchema.parse(await feedResponse.json());
    // The seeded job has an approved takeoff but no project record yet.
    expect(feed.map((card) => card.kind)).toContain('project.unopened');
    for (const card of feed) {
      expect(card.reason.length).toBeGreaterThan(20);
      expect(card.actionHref).toContain(ids.job);
    }

    // Same state, same day, same feed.
    const repeat = await call('/api/today?today=2026-07-31', office);
    expect(ActionCardListSchema.parse(await repeat.json()).map((card) => card.cardId))
      .toEqual(feed.map((card) => card.cardId));

    const badDay = await call('/api/today?today=yesterday', office);
    expect(badDay.status).toBe(422);

    expect((await call('/api/today', customer)).status).toBe(403);
  });

  it('serves the job gate plan and opens any confirmed template', async () => {
    const office = await token(ids.office, 'office');
    const customer = await token(ids.customer, 'customer');

    const planResponse = await call(`/api/jobs/${ids.job}/gates`, office);
    expect(planResponse.status).toBe(200);
    const plan = await planResponse.json() as Array<Record<string, unknown>>;
    expect(plan.map((entry) => entry.definitionKey)).toEqual([
      'permit', 'excavation', 'pre-gunite', 'shell', 'deck-tile', 'equipment', 'final',
    ]);
    expect(plan.every((entry) => entry.gateInstanceId === null && entry.status === null)).toBe(true);

    const opened = await call(`/api/jobs/${ids.job}/gates/excavation`, office, { method: 'POST', body: '{}' });
    expect(opened.status).toBe(201);
    expect(await opened.json()).toMatchObject({ definitionKey: 'excavation', status: 'not-started' });

    const unknown = await call(`/api/jobs/${ids.job}/gates/demolition`, office, { method: 'POST', body: '{}' });
    expect(unknown.status).toBe(409);

    expect((await call(`/api/jobs/${ids.job}/gates`, customer)).status).toBe(403);
  });

  it('refuses a phase key outside the nine Apex builds', async () => {
    const office = await token(ids.office, 'office');
    await call(`/api/jobs/${ids.job}/project`, office, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'api-open-project-2' },
    });
    const invalid = await call(`/api/jobs/${ids.job}/project/phase`, office, {
      method: 'POST',
      body: JSON.stringify({ toPhaseKey: 'demolition' }),
      headers: { 'idempotency-key': 'api-invalid-phase-1' },
    });
    expect(invalid.status).toBe(422);
  });

  it('serves the internal job list to staff and refuses customers', async () => {
    const office = await token(ids.office, 'office');
    const customer = await token(ids.customer, 'customer');

    const list = await call('/api/jobs', office);
    expect(list.status).toBe(200);
    const jobs = await list.json() as Array<Record<string, unknown>>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ jobId: ids.job, leadId: ids.lead, status: 'active' });
    // The seed lead payload is empty, so no identity or contract value may be invented.
    expect(jobs[0]).toMatchObject({ customerName: null, addressLine: null, contractCents: null });

    const detail = await call(`/api/jobs/${ids.job}`, office);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ jobId: ids.job });

    const missing = await call(`/api/jobs/${createCanonicalId('job')}`, office);
    expect(missing.status).toBe(404);

    const forbiddenList = await call('/api/jobs', customer);
    expect(forbiddenList.status).toBe(403);
    const forbiddenDetail = await call(`/api/jobs/${ids.job}`, customer);
    expect(forbiddenDetail.status).toBe(403);
    const unauthenticated = await fetch(`${baseUrl}/api/jobs`);
    expect(unauthenticated.status).toBe(403);
  });

  it('reports the current Gate on the job summary once one exists', async () => {
    const field = await token(ids.field, 'field');
    await call(`/api/jobs/${ids.job}/gates/pre-gunite`, field, { method: 'POST', body: '{}' });
    const detail = await call(`/api/jobs/${ids.job}`, field);
    const summary = await detail.json() as { currentGate: Record<string, unknown> | null };
    expect(summary.currentGate).toMatchObject({
      definitionKey: 'pre-gunite',
      definitionVersion: 3,
      title: 'Pre-gunite hold point',
      status: 'not-started',
    });
  });

  it('tells a signed-out browser that this environment has no provider', async () => {
    const config = await (await fetch(`${baseUrl}/api/auth/config`)).json();
    // The screen branches on this rather than on a build flag, so a local
    // environment cannot offer a sign-in button that leads nowhere.
    expect(config).toEqual({ mode: 'pilot' });
  });

  it('reports liveness and readiness separately', async () => {
    // Liveness checks nothing but the process. A platform restarting the
    // container because the database blipped would turn a recoverable outage
    // into a crash loop.
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);

    // Readiness checks the two dependencies the instance cannot serve without.
    const ready = await fetch(`${baseUrl}/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ready', database: true, evidence: true });

    // Neither needs a token: the platform probing them has none.
    expect(health.headers.get('content-type')).toContain('application/json');
  });

  it('answers 503 when a dependency it needs is gone', async () => {
    await db.close();
    const ready = await fetch(`${baseUrl}/ready`);
    // A load balancer has to stop sending traffic here, which it only does on
    // a non-2xx. Reporting healthy while unable to serve is the failure this
    // endpoint exists to prevent.
    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({ status: 'degraded', database: false });
  });

  it('requires authentication and idempotency headers', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const consolePage = await fetch(`${baseUrl}/`);
    expect(consolePage.status).toBe(200);
    expect(consolePage.headers.get('content-security-policy')).toContain("object-src 'none'");
    /*
     * Asserts the console was served, not what Gate it names. This used to check
     * for "Pre-gunite Gate", a title left over from when that was the only
     * template; the heading is now filled in from whichever Gate is actually
     * open, so pinning the old string here would have kept the wrong one alive.
     */
    expect(await consolePage.text()).toContain('APEX FIELD CONTROL');
    const unauthenticated = await fetch(`${baseUrl}/api/jobs/${ids.job}/gates/pre-gunite`, { method: 'POST' });
    expect(unauthenticated.status).toBe(403);
    const invalid = await call(`/api/jobs/${ids.job}/gates/pre-gunite`, 'not-a-valid-token', { method: 'POST' });
    expect(invalid.status).toBe(403);
    /*
     * A role claim in a token is inert.
     *
     * This used to assert that a token whose `app_role` disagreed with the
     * database was rejected. Since deployment slice 4 the claim is not read at
     * all — the role comes from `app_users` — so there is nothing left to
     * disagree. The stronger property is asserted instead: a field lead holding
     * a token that claims `office` is still a field lead, and an office-only
     * action is refused on the strength of the row rather than the claim.
     */
    const claimsOffice = await token(ids.field, 'office');
    const escalation = await call(`/api/jobs/${ids.job}/draws`, claimsOffice, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'claim-escalation-1' },
    });
    expect(escalation.status).toBe(409);
    expect(await escalation.text()).toMatch(/may not/i);
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

/**
 * The customer progress page over HTTP — PRD §9.11.
 *
 * The service tests cover token handling and the projection. What is checked
 * here is what actually crosses the wire on the only route in Apex OS that
 * answers an unauthenticated request: the headers, the status codes, and the
 * absence of anything internal in the rendered bytes.
 */
describe('customer progress page', () => {
  /** Upload one real photo through the normal field path so bytes exist on disk. */
  const publishAPhoto = async (caption?: string): Promise<string> => {
    const field = await token(ids.field, 'field');
    const office = await token(ids.office, 'office');
    const create = await call(`/api/jobs/${ids.job}/gates/pre-gunite`, field, { method: 'POST', body: '{}' });
    const gate = await create.json() as { gateInstanceId: string; requirements: Array<{ key: string }> };
    await call(`/api/gates/${gate.gateInstanceId}/start`, field, {
      method: 'POST', body: '{}', headers: { 'idempotency-key': 'customer-start-0001' },
    });
    const upload = await call(`/api/gates/${gate.gateInstanceId}/evidence`, field, {
      method: 'POST', headers: { 'idempotency-key': 'customer-proof-0001' },
      body: JSON.stringify({
        requirementKey: gate.requirements[0]?.key,
        kind: 'photo',
        mimeType: 'image/jpeg',
        contentBase64: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('pixels')]).toString('base64'),
        capturedAt: '2026-07-29T15:00:00.000Z',
        caption: 'Bar spacing short at the north wall — Ruiz Steel redoing',
      }),
    });
    const { evidenceId } = await upload.json() as { evidenceId: string };
    const published = await call(`/api/evidence/${evidenceId}/visibility`, office, {
      method: 'POST',
      body: JSON.stringify({ visible: true, ...(caption ? { caption } : {}) }),
    });
    expect(published.status).toBe(200);
    return evidenceId;
  };

  const issue = async (): Promise<string> => {
    const office = await token(ids.office, 'office');
    const response = await call(`/api/jobs/${ids.job}/customer-link`, office, { method: 'POST', body: '{}' });
    expect(response.status).toBe(201);
    const { url } = await response.json() as { url: string };
    return url;
  };

  it('serves the page to a request carrying no credentials at all', async () => {
    const url = await issue();
    const page = await fetch(`${baseUrl}${url}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Your build');
    // Search engines, referrers, and shared-machine caches are all ways a token
    // in a URL escapes. Each is closed by a header.
    expect(page.headers.get('x-robots-tag')).toContain('noindex');
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('renders nothing internal', async () => {
    await db.query(
      `insert into projects (job_id, current_phase_key, risk_note, created_by)
       values ($1, 'gunite', 'Ruiz Steel is behind and the pour may slip a week', $2)`,
      [ids.job, ids.owner],
    );
    await publishAPhoto();
    const html = await (await fetch(`${baseUrl}${await issue()}`)).text();
    // §9.11's hide list, checked against the bytes that actually leave the box.
    expect(html).not.toMatch(/Ruiz Steel/);
    expect(html).not.toMatch(/pre-gunite/i);
    expect(html).not.toMatch(/risk|draw|invoice|contract|takeoff|checklist/i);
    expect(html).not.toContain(ids.job);
  });

  it('serves a published photo and refuses an unpublished one', async () => {
    const url = await issue();
    const evidenceId = await publishAPhoto();
    const photo = await fetch(`${baseUrl}${url}/photo/${evidenceId}`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get('content-type')).toBe('image/jpeg');

    const office = await token(ids.office, 'office');
    await call(`/api/evidence/${evidenceId}/visibility`, office, {
      method: 'POST', body: JSON.stringify({ visible: false }),
    });
    expect((await fetch(`${baseUrl}${url}/photo/${evidenceId}`)).status).toBe(404);
  });

  it('answers a revoked link and an invented one identically', async () => {
    const url = await issue();
    const office = await token(ids.office, 'office');
    await call(`/api/jobs/${ids.job}/customer-link`, office, { method: 'DELETE', body: '{}' });

    const revoked = await fetch(`${baseUrl}${url}`);
    const invented = await fetch(`${baseUrl}/c/${'z'.repeat(43)}`);
    // A stranger must not be able to tell a real link scheme from a wrong guess.
    expect(revoked.status).toBe(404);
    expect(invented.status).toBe(404);
    expect(await revoked.text()).toBe(await invented.text());
  });

  it('closes the old link when the link is rotated', async () => {
    const first = await issue();
    const office = await token(ids.office, 'office');
    const rotated = await call(`/api/jobs/${ids.job}/customer-link/rotate`, office, {
      method: 'POST', body: JSON.stringify({ reason: 'Forwarded to a stranger' }),
    });
    expect(rotated.status).toBe(201);
    const { url: second } = await rotated.json() as { url: string };
    expect((await fetch(`${baseUrl}${first}`)).status).toBe(404);
    expect((await fetch(`${baseUrl}${second}`)).status).toBe(200);
  });

  it('keeps link management behind staff authentication', async () => {
    const customer = await token(ids.customer, 'customer');
    expect((await fetch(`${baseUrl}/api/jobs/${ids.job}/customer-link`)).status).toBe(403);
    // A signed-in customer may read their own milestones; they may not read or
    // mint the token that opens the page.
    expect((await call(`/api/jobs/${ids.job}/customer-link`, customer)).status).toBe(403);
    expect((await call(`/api/jobs/${ids.job}/customer-link`, customer, { method: 'POST', body: '{}' })).status).toBe(403);
  });

  it('records the read and shows it to staff', async () => {
    const url = await issue();
    await fetch(`${baseUrl}${url}`);
    const office = await token(ids.office, 'office');
    const status = await (await call(`/api/jobs/${ids.job}/customer-link`, office)).json() as {
      active: { pageViews: number } | null;
      recentAccesses: Array<{ resource: string; outcome: string }>;
    };
    expect(status.active?.pageViews).toBe(1);
    expect(status.recentAccesses[0]).toMatchObject({ resource: 'page', outcome: 'served' });
    // The token itself is never handed back, only its effects.
    expect(JSON.stringify(status)).not.toContain(url.replace('/c/', ''));
  });

  it('previews the page for staff without minting a token or logging a visit', async () => {
    await issue();
    const office = await token(ids.office, 'office');
    const preview = await call(`/api/jobs/${ids.job}/customer-preview`, office);
    expect(preview.status).toBe(200);
    const page = await preview.json() as { headline: string };
    expect(page.headline).toBe('Getting ready to start');
    const status = await (await call(`/api/jobs/${ids.job}/customer-link`, office)).json() as {
      active: { pageViews: number } | null;
    };
    expect(status.active?.pageViews).toBe(0);
  });
});
