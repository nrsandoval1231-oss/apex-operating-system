import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, type EventActor, type EvidenceId, type JobId } from '@apex/contracts';
import { CustomerService, networkPrefix } from './customer.js';

/**
 * The customer progress page over real persisted state — PRD §9.11.
 *
 * The projection itself is unit-tested in @apex/domain. What is tested here is
 * the boundary: that a token is not recoverable from the database, that
 * revocation actually closes the page and its photos, that an unpublished photo
 * is unreachable, and that reads are recorded.
 */

const ids = {
  lead: createCanonicalId('lead'),
  otherLead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  otherJob: createCanonicalId('job'),
  gate: createCanonicalId('gate'),
  otherGate: createCanonicalId('gate'),
  revision: createCanonicalId('revision'),
  otherRevision: createCanonicalId('revision'),
  owner: createCanonicalId('user'),
  office: createCanonicalId('user'),
  field: createCanonicalId('user'),
};

const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const fieldActor: EventActor = { kind: 'user', userId: ids.field, role: 'field' };

let db: PGlite;
let customers: CustomerService;

/** Insert a gate photo directly: the capture path is tested in the gate suite. */
const addPhoto = async (options: {
  jobId?: string;
  gateInstanceId?: string;
  kind?: string;
  caption?: string;
  capturedAt?: string;
} = {}): Promise<EvidenceId> => {
  const evidenceId = createCanonicalId('evidence');
  const jobId = options.jobId ?? ids.job;
  await db.query(
    `insert into evidence_records
     (evidence_id, job_id, gate_instance_id, requirement_key, kind, storage_key, sha256,
      captured_at, captured_by, mime_type, byte_size, caption)
     values ($1, $2, $3, 'steel-placement-verified', $4, $5, repeat('a', 64), $6, $7, 'image/jpeg', 1024, $8)`,
    [evidenceId, jobId, options.gateInstanceId ?? ids.gate, options.kind ?? 'photo',
      `${jobId}/${evidenceId}.jpg`,
      options.capturedAt ?? '2026-07-30T15:00:00.000Z', ids.field,
      options.caption ?? 'Bar spacing at the deep end — see checklist item 4'],
  );
  return evidenceId;
};

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Travis'),
     ($2, '00000000-0000-0000-0000-000000000002', 'office', 'Office User'),
     ($3, '00000000-0000-0000-0000-000000000003', 'field', 'Field Lead')`,
    [ids.owner, ids.office, ids.field],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload) values
     ($1, 'test', 'cust-a', 'test:cust-a', '{"customerName":"Whitaker Oasis","address":"4102 CR 7500","city":"Lubbock","state":"TX"}'),
     ($2, 'test', 'cust-b', 'test:cust-b', '{"customerName":"Mike Johnson"}')`,
    [ids.lead, ids.otherLead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values
     ($1, $2, 1, 'active'), ($3, $4, 1, 'active')`,
    [ids.job, ids.lead, ids.otherJob, ids.otherLead],
  );
  await db.query(
    `insert into projects (job_id, current_phase_key, created_by) values ($1, 'gunite', $2)`,
    [ids.job, ids.owner],
  );
  // A gate cannot open without an approved takeoff revision, and evidence
  // cannot exist without a gate. Both jobs get one so a photo on the other job
  // is a real photo rather than an impossible row.
  for (const [revisionId, jobId] of [[ids.revision, ids.job], [ids.otherRevision, ids.otherJob]] as const) {
    await db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
       values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"fixture.calc"}]', '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
      [revisionId, jobId, 'a'.repeat(64), 'b'.repeat(64), ids.office],
    );
  }
  // Gate instances to hang evidence off. Definitions are seeded by migration.
  await db.query(
    `insert into gate_instances
     (gate_instance_id, job_id, definition_key, definition_version, approved_takeoff_revision_id, status)
     values ($1, $2, 'pre-gunite', 2, $3, 'in-progress'),
            ($4, $5, 'pre-gunite', 2, $6, 'in-progress')`,
    [ids.gate, ids.job, ids.revision, ids.otherGate, ids.otherJob, ids.otherRevision],
  );
  customers = new CustomerService(db, {
    contact: { phone: '+18065551234', label: 'Call or text us any time.' },
  });
});

const tokenOf = (url: string): string => url.replace('/c/', '');

describe('issuing a link', () => {
  it('returns the token once and stores only its hash', async () => {
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const token = tokenOf(issued.url);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = await db.query<{ token_sha256: string }>('select token_sha256 from customer_links');
    // Anyone holding the database holds a digest, not a working link.
    expect(stored.rows[0]?.token_sha256).toBe(createHash('sha256').update(token).digest('hex'));
    const columns = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'customer_links'`,
    );
    expect(columns.rows.map((row) => row.column_name)).not.toContain('token');
  });

  it('refuses a second link rather than silently replacing the customer’s', async () => {
    await customers.issueLink({ jobId: ids.job, actor: owner });
    // "Send them their link" must not be able to perform "invalidate the link
    // they already have".
    await expect(customers.issueLink({ jobId: ids.job, actor: owner }))
      .rejects.toThrow(/already has a live customer link/i);
  });

  it('is closed to the field lead', async () => {
    await expect(customers.issueLink({ jobId: ids.job, actor: fieldActor }))
      .rejects.toThrow(/may not issuing a customer link|may not/i);
  });
});

describe('rotation and revocation', () => {
  it('closes the old link the moment a new one is issued', async () => {
    const first = await customers.issueLink({ jobId: ids.job, actor: owner });
    const second = await customers.rotateLink({ jobId: ids.job, actor: owner, reason: 'Forwarded to a stranger' });
    expect(second.url).not.toBe(first.url);

    expect((await customers.getPage(tokenOf(first.url))).outcome).toBe('revoked');
    expect((await customers.getPage(tokenOf(second.url))).outcome).toBe('served');
  });

  it('never leaves a job with two live links', async () => {
    await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.rotateLink({ jobId: ids.job, actor: owner });
    const live = await db.query('select 1 from customer_links where job_id = $1 and revoked_at is null', [ids.job]);
    expect(live.rows).toHaveLength(1);
  });

  it('refuses to reinstate a revoked link at the database level', async () => {
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.revokeLink({ jobId: ids.job, actor: owner });
    const linkId = (await customers.getLinkStatus(ids.job)).history[0]?.linkId;
    await expect(db.query('update customer_links set revoked_at = null, revoked_by = null where link_id = $1', [linkId]))
      .rejects.toThrow(/cannot be reinstated/i);
    expect((await customers.getPage(tokenOf(issued.url))).outcome).toBe('revoked');
  });

  it('reports a revoked link and an invented one identically', async () => {
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.revokeLink({ jobId: ids.job, actor: owner });
    const revoked = await customers.getPage(tokenOf(issued.url));
    const invented = await customers.getPage('z'.repeat(43));
    // Different internally so the revoked read can be logged; the API renders
    // and statuses them the same, which is what a stranger sees.
    expect(revoked.outcome).toBe('revoked');
    expect(invented.outcome).toBe('unknown');
  });
});

describe('the access log', () => {
  it('records a read of the page', async () => {
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.getPage(tokenOf(issued.url), {
      remoteAddress: '198.51.100.42',
      userAgent: 'Mozilla/5.0 (iPhone)',
    });
    const status = await customers.getLinkStatus(ids.job);
    expect(status.active?.pageViews).toBe(1);
    expect(status.recentAccesses[0]).toMatchObject({
      resource: 'page',
      outcome: 'served',
      // Coarsened: enough to notice a link read from three cities, not enough
      // to follow one person around.
      ipPrefix: '198.51.100.0/24',
    });
  });

  it('records a read on a revoked link, which is the point of keeping it', async () => {
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.revokeLink({ jobId: ids.job, actor: owner });
    await customers.getPage(tokenOf(issued.url), { remoteAddress: '203.0.113.9' });
    const status = await customers.getLinkStatus(ids.job);
    expect(status.recentAccesses[0]).toMatchObject({ outcome: 'refused-revoked' });
  });

  it('records nothing for a token that never existed', async () => {
    await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.getPage('z'.repeat(43));
    expect((await customers.getLinkStatus(ids.job)).recentAccesses).toHaveLength(0);
  });

  it('is append-only', async () => {
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.getPage(tokenOf(issued.url));
    await expect(db.query('delete from customer_link_accesses')).rejects.toThrow(/append-only/i);
  });

  it('counts page views separately from photo fetches', async () => {
    const photo = await addPhoto();
    await customers.setPhotoVisibility({ evidenceId: photo, visible: true, actor: owner });
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const token = tokenOf(issued.url);
    await customers.getPage(token);
    await customers.getPhoto(token, photo);
    await customers.getPhoto(token, photo);
    const status = await customers.getLinkStatus(ids.job);
    // Otherwise "has the customer opened this" gets swamped by however many
    // photos happen to be published.
    expect(status.active?.pageViews).toBe(1);
    expect(status.recentAccesses).toHaveLength(3);
  });
});

describe('photos', () => {
  it('shows nothing until someone publishes it', async () => {
    await addPhoto();
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const result = await customers.getPage(tokenOf(issued.url));
    expect(result.outcome === 'served' && result.page.photos).toHaveLength(0);
  });

  it('never shows the internal caption', async () => {
    const photo = await addPhoto({ caption: 'Rebar short at the north wall — Ruiz Steel to redo' });
    await customers.setPhotoVisibility({ evidenceId: photo, visible: true, actor: owner });
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const result = await customers.getPage(tokenOf(issued.url));
    expect(result.outcome === 'served' && result.page.photos[0]?.caption).toBeNull();
  });

  it('shows the customer caption when one was written', async () => {
    const photo = await addPhoto();
    await customers.setPhotoVisibility({
      evidenceId: photo, visible: true, caption: 'Steel is in and inspected', actor: owner,
    });
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const result = await customers.getPage(tokenOf(issued.url));
    expect(result.outcome === 'served' && result.page.photos[0]?.caption).toBe('Steel is in and inspected');
  });

  it('refuses to publish anything that is not a photograph', async () => {
    const document = await addPhoto({ kind: 'document' });
    await expect(customers.setPhotoVisibility({ evidenceId: document, visible: true, actor: owner }))
      .rejects.toThrow(/only a photo/i);
  });

  it('drops the customer caption when the photo is taken back down', async () => {
    const photo = await addPhoto();
    await customers.setPhotoVisibility({ evidenceId: photo, visible: true, caption: 'Shell going on', actor: owner });
    const hidden = await customers.setPhotoVisibility({ evidenceId: photo, visible: false, actor: owner });
    expect(hidden.customerVisible).toBe(false);
    expect(hidden.customerCaption).toBeNull();
  });

  it('will not serve an unpublished photo even with a valid token', async () => {
    const photo = await addPhoto();
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    expect((await customers.getPhoto(tokenOf(issued.url), photo)).outcome).toBe('unknown');
  });

  it('will not serve another job’s photo through this job’s token', async () => {
    const foreign = await addPhoto({ jobId: ids.otherJob, gateInstanceId: ids.otherGate });
    await customers.setPhotoVisibility({ evidenceId: foreign, visible: true, actor: owner });
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    expect((await customers.getPhoto(tokenOf(issued.url), foreign)).outcome).toBe('unknown');
  });

  it('stops serving photos once the link is revoked', async () => {
    const photo = await addPhoto();
    await customers.setPhotoVisibility({ evidenceId: photo, visible: true, actor: owner });
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    await customers.revokeLink({ jobId: ids.job, actor: owner });
    expect((await customers.getPhoto(tokenOf(issued.url), photo)).outcome).toBe('revoked');
  });

  it('is not something the field lead decides', async () => {
    const photo = await addPhoto();
    await expect(customers.setPhotoVisibility({ evidenceId: photo, visible: true, actor: fieldActor }))
      .rejects.toThrow(/may not/i);
  });
});

describe('decisions', () => {
  const raise = () => customers.raiseDecision({
    jobId: ids.job,
    title: 'Waterline tile',
    detail: 'Three samples are at the office for you to look at.',
    consequence: 'Tile goes on next; without a choice the crew has nothing to set.',
    neededBy: '2026-08-12',
    actor: owner,
  });

  it('appears on the customer page while it is open', async () => {
    await raise();
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const result = await customers.getPage(tokenOf(issued.url));
    expect(result.outcome === 'served' && result.page.decisions).toHaveLength(1);
  });

  it('leaves the page once it is answered', async () => {
    const decision = await raise();
    await customers.resolveDecision({
      decisionId: decision.decisionId, status: 'answered',
      answerNote: 'Chose the sage 1x1 glass on the phone.', actor: owner,
    });
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const result = await customers.getPage(tokenOf(issued.url));
    expect(result.outcome === 'served' && result.page.decisions).toHaveLength(0);
  });

  it('refuses to record an answer without saying what the customer said', async () => {
    const decision = await raise();
    await expect(customers.resolveDecision({
      decisionId: decision.decisionId, status: 'answered', actor: owner,
    })).rejects.toThrow(/what the customer said/i);
  });

  it('refuses to resolve the same decision twice', async () => {
    const decision = await raise();
    await customers.resolveDecision({
      decisionId: decision.decisionId, status: 'withdrawn', actor: owner,
    });
    await expect(customers.resolveDecision({
      decisionId: decision.decisionId, status: 'withdrawn', actor: owner,
    })).rejects.toThrow(/already been resolved/i);
  });
});

describe('the page itself', () => {
  it('renders the customer’s own name and address and nothing about money', async () => {
    const issued = await customers.issueLink({ jobId: ids.job, actor: owner });
    const result = await customers.getPage(tokenOf(issued.url));
    if (result.outcome !== 'served') throw new Error('expected the page to be served');
    expect(result.page.customerName).toBe('Whitaker Oasis');
    expect(result.page.addressLine).toContain('Lubbock');
    expect(JSON.stringify(result.page)).not.toMatch(/contract|cents|invoice|draw/i);
  });

  it('previews without a token and without logging a visit', async () => {
    await customers.issueLink({ jobId: ids.job, actor: owner });
    const preview = await customers.previewPage(ids.job);
    expect(preview.headline).toBe('The shell');
    // Apex checking its own page is not a customer visit.
    expect((await customers.getLinkStatus(ids.job)).active?.pageViews).toBe(0);
  });

  it('says handover only once the job is complete', async () => {
    await db.query('update jobs set status = $2 where job_id = $1', [ids.job, 'complete']);
    const preview = await customers.previewPage(ids.job);
    expect(preview.milestones.find((step) => step.key === 'handover')?.state).toBe('current');
  });
});

describe('coarsening a client address', () => {
  it('keeps a network, not a machine', () => {
    expect(networkPrefix('198.51.100.42')).toBe('198.51.100.0/24');
    expect(networkPrefix('::ffff:198.51.100.42')).toBe('198.51.100.0/24');
    expect(networkPrefix('2001:db8:1234:5678::1')).toBe('2001:db8:1234::/48');
  });

  it('stores nothing rather than something it does not understand', () => {
    expect(networkPrefix(undefined)).toBeNull();
    expect(networkPrefix('not-an-address')).toBeNull();
  });
});

/** Guards the type-level claim that job ids stay canonical through this file. */
const _typecheck: JobId = ids.job;
void _typecheck;
