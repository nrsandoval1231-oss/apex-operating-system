import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, CustomerMilestoneProjectionSchema, type EvidenceKind, type EventActor } from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { GateService } from './index.js';

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  gate: createCanonicalId('gate'),
  field: createCanonicalId('user'),
  office: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  owner: createCanonicalId('user'),
};
const fieldActor: EventActor = { kind: 'user', userId: ids.field, role: 'field' };
const officeActor: EventActor = { kind: 'user', userId: ids.office, role: 'office' };
/**
 * Pre-gunite is released by the superintendent, not the field lead — confirmed
 * authority model, docs/decisions/construction-model.md §3.
 */
const superintendentActor: EventActor = { kind: 'user', userId: ids.superintendent, role: 'superintendent' };
/** The owner countersigns pre-gunite, because gunite cannot be undone. */
const ownerActor: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };

let db: PGlite;
let service: GateService;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'field', 'Field Lead'),
     ($2, '00000000-0000-0000-0000-000000000002', 'office', 'Office User'),
     ($3, '00000000-0000-0000-0000-000000000003', 'superintendent', 'Site Super'),
     ($4, '00000000-0000-0000-0000-000000000004', 'admin', 'Travis')`,
    [ids.field, ids.office, ids.superintendent, ids.owner],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'source-gate', 'test:source-gate', '{}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );
  await db.query(
    `insert into takeoff_revisions
     (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"fixture.calc"}]', '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
    [ids.revision, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.office],
  );
  service = new GateService(db);
  await service.createGate({ gateInstanceId: ids.gate, jobId: ids.job, definitionKey: 'pre-gunite' });
});

const context = (key: string) => ({ idempotencyKey: key, correlationId: createCanonicalId('event') });
const evidence = (requirementKey: string, kind: EvidenceKind = 'photo') => ({
  evidenceId: createCanonicalId('evidence'),
  requirementKey,
  kind,
  storageKey: `${ids.job}/pre-gunite/${requirementKey}.jpg`,
  sha256: 'c'.repeat(64),
  capturedAt: '2026-07-29T14:00:00.000Z',
  mimeType: 'image/jpeg',
  byteSize: 512,
  metadata: {},
});

describe('persistent pre-gunite Gate', () => {
  it('persists the evidence-to-release path and emits draw/customer projections atomically', async () => {
    await service.execute(ids.gate, {
      type: 'start-gate', actor: fieldActor, at: '2026-07-29T14:00:00.000Z',
    }, context('start-gate-1'));

    const initial = await service.getGate(ids.gate);
    for (const requirement of initial.requirements.values()) {
      const proof = evidence(requirement.key, requirement.acceptedEvidenceKinds[0]);
      await service.execute(ids.gate, {
        type: 'add-evidence', actor: fieldActor, at: proof.capturedAt,
        requirementKey: requirement.key, evidenceId: proof.evidenceId, kind: proof.kind,
      }, { ...context(`evidence-${requirement.key}`), evidence: proof });
      await service.execute(ids.gate, {
        type: 'evaluate-requirement', actor: fieldActor, at: '2026-07-29T14:05:00.000Z',
        requirementKey: requirement.key, outcome: 'passed',
      }, context(`pass-${requirement.key}`));
    }

    // Pre-gunite is irreversible, so the superintendent's signature holds the
    // Gate open rather than releasing it.
    const signoff = await service.execute(ids.gate, {
      type: 'release-gate', actor: superintendentActor, at: '2026-07-29T14:10:00.000Z',
    }, context('release-gate-1'));
    expect(signoff.events.map((event) => event.eventType)).toEqual(['gate.signoff_recorded']);
    expect(signoff.state.status).toBe('awaiting-countersign');

    const release = await service.execute(ids.gate, {
      type: 'countersign-gate', actor: ownerActor, at: '2026-07-29T14:20:00.000Z',
    }, context('countersign-gate-1'));
    // Pre-gunite releases work, not money — it bears no draw.
    expect(release.events.map((event) => event.eventType)).toEqual([
      'gate.countersigned', 'gate.released', 'customer_update.published',
    ]);

    const reloaded = await new GateService(db).getGate(ids.gate);
    expect(reloaded.status).toBe('released');
    expect([...reloaded.requirements.values()].every((item) => item.status === 'passed')).toBe(true);

    const draws = await db.query(`select draw_id from job_draws where job_id = $1`, [ids.job]);
    expect(draws.rows).toHaveLength(0);
    const projections = await service.getCustomerMilestones(ids.job);
    expect(projections).toHaveLength(1);
    // The wording comes from the Gate definition, not from a hardcoded string.
    expect(projections[0]).toMatchObject({
      milestone: 'shell',
      title: 'Ready for the concrete shell',
    });
    expect(CustomerMilestoneProjectionSchema.safeParse(projections[0]).success).toBe(true);
    expect(projections[0]).not.toHaveProperty('evidenceIds');
    expect(projections[0]).not.toHaveProperty('margin');
  });

  it('treats a repeated idempotency key as the same command', async () => {
    const command = { type: 'start-gate' as const, actor: fieldActor, at: '2026-07-29T14:00:00.000Z' };
    const first = await service.execute(ids.gate, command, context('duplicate-start-1'));
    const duplicate = await service.execute(ids.gate, command, context('duplicate-start-1'));
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    const events = await db.query(`select event_id from events where payload->>'gateInstanceId' = $1`, [ids.gate]);
    expect(events.rows).toHaveLength(1);
  });

  it('rejects evidence kinds outside the versioned requirement definition', async () => {
    await service.execute(ids.gate, {
      type: 'start-gate', actor: fieldActor, at: '2026-07-29T14:00:00.000Z',
    }, context('start-for-kind-1'));
    // 'crew-qualification-confirmed' accepts documents and photos, not measurements.
    const proof = evidence('crew-qualification-confirmed', 'measurement');
    await expect(service.execute(ids.gate, {
      type: 'add-evidence', actor: fieldActor, at: proof.capturedAt,
      requirementKey: proof.requirementKey, evidenceId: proof.evidenceId, kind: proof.kind,
    }, { ...context('invalid-kind-1'), evidence: proof })).rejects.toThrow(DomainRuleError);
  });

  it('does not let office staff release a field hold point', async () => {
    await expect(service.execute(ids.gate, {
      type: 'release-gate', actor: officeActor, at: '2026-07-29T14:10:00.000Z',
    }, context('office-release-1'))).rejects.toThrow(/not authorized/i);
  });

  it('honours the release authority named by the Gate definition', async () => {
    const gate = await service.getGate(ids.gate);
    expect(gate.releaseRoles).toEqual(['admin', 'superintendent']);
    // The field lead captures the evidence but does not sign off the hold point.
    await expect(service.execute(ids.gate, {
      type: 'release-gate', actor: fieldActor, at: '2026-07-29T14:10:00.000Z',
    }, context('field-release-1'))).rejects.toThrow(/not authorized/i);
  });
});

describe('job summary read model', () => {
  const second = {
    lead: createCanonicalId('lead'),
    job: createCanonicalId('job'),
    proposal: createCanonicalId('proposal'),
    proposalVersion: createCanonicalId('proposal_version'),
  };

  const addSignedProposal = async (totalCents: string) => {
    await db.query(`insert into proposals (proposal_id, lead_id) values ($1, $2)`, [second.proposal, ids.lead]);
    await db.query(
      `insert into proposal_versions
       (proposal_version_id, proposal_id, lead_id, job_id, version_number, status, takeoff_revision_id,
        quantity_payload_sha256, quantity_model_version, pricing_library_version, proposal_payload_sha256,
        proposal_payload, total_cents, created_by, signed_at)
       values ($1, $2, $3, $4, 1, 'signed', $5, repeat('c', 64), 'quantity-v1', 'pricing-v1', repeat('d', 64),
               '{}', $6, $7, now())`,
      [second.proposalVersion, second.proposal, ids.lead, ids.job, ids.revision, totalCents, ids.office],
    );
  };

  beforeEach(async () => {
    // A second job with a lead identity, no proposal, no takeoff, and no Gate.
    await db.query(
      `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
       values ($1, 'website', 'source-second', 'test:source-second', $2)`,
      [second.lead, { customerName: 'Mike Johnson', streetAddress: '7821 Knoxville Ave', city: 'Lubbock', state: 'TX' }],
    );
    await db.query(
      `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'on-hold')`,
      [second.job, second.lead],
    );
  });

  it('returns every job newest first with its lead identity and current Gate', async () => {
    const jobs = await service.listJobs();
    expect(jobs.map((job) => job.jobId)).toEqual([second.job, ids.job]);

    const withoutGate = jobs[0];
    expect(withoutGate).toMatchObject({
      status: 'on-hold',
      customerName: 'Mike Johnson',
      addressLine: '7821 Knoxville Ave, Lubbock, TX',
      contractCents: null,
      approvedTakeoffRevisionId: null,
      currentGate: null,
    });

    const withGate = jobs[1];
    expect(withGate?.currentGate).toMatchObject({
      gateInstanceId: ids.gate,
      definitionKey: 'pre-gunite',
      // A new Gate pins the active version, which is 2 since the PRD §9.4 baseline landed.
      definitionVersion: 2,
      status: 'not-started',
    });
    expect(withGate?.approvedTakeoffRevisionId).toBe(ids.revision);
    // The seed lead payload is '{}', so no identity may be invented for it.
    expect(withGate?.customerName).toBeNull();
    expect(withGate?.addressLine).toBeNull();
  });

  it('reports the signed proposal total as the contract value', async () => {
    await addSignedProposal('18500000');
    const job = await service.getJob(ids.job);
    expect(job?.contractCents).toBe(18_500_000);
  });

  it('refuses a contract total that cannot survive as an exact integer', async () => {
    await addSignedProposal('9007199254740993');
    await expect(service.getJob(ids.job)).rejects.toThrow(/safe integer/i);
  });

  it('ignores unsigned proposal versions when reporting contract value', async () => {
    await db.query(`insert into proposals (proposal_id, lead_id) values ($1, $2)`, [second.proposal, ids.lead]);
    await db.query(
      `insert into proposal_versions
       (proposal_version_id, proposal_id, lead_id, version_number, status, takeoff_revision_id,
        quantity_payload_sha256, quantity_model_version, pricing_library_version, proposal_payload_sha256,
        proposal_payload, total_cents, created_by)
       values ($1, $2, $3, 1, 'draft', $4, repeat('c', 64), 'quantity-v1', 'pricing-v1', repeat('d', 64),
               '{}', 12300000, $5)`,
      [second.proposalVersion, second.proposal, ids.lead, ids.revision, ids.office],
    );
    expect((await service.getJob(ids.job))?.contractCents).toBeNull();
  });

  it('prefers an unreleased Gate over a newer released one', async () => {
    // A second definition is required: one gate instance per definition per job.
    await db.query(
      `insert into gate_definitions
         (definition_key, version, title, phase, phase_key, draw_code, customer_milestone,
          customer_update_title, customer_update_summary, active, release_roles)
       values ('pre-deck', 1, 'Pre-deck release', 'decking', 'decking', 'pre-deck-draw', 'finishes',
               'Deck ready', 'The deck area is prepared.', true, array['admin'])`,
    );
    const released = createCanonicalId('gate');
    await db.query(
      `insert into gate_instances
       (gate_instance_id, job_id, definition_key, definition_version, approved_takeoff_revision_id, status, released_at, released_by, created_at)
       values ($1, $2, 'pre-deck', 1, $3, 'released', now(), $4, now() + interval '1 hour')`,
      [released, ids.job, ids.revision, ids.field],
    );
    // The released gate is newer, but the unreleased one is what still needs attention.
    expect((await service.getJob(ids.job))?.currentGate?.gateInstanceId).toBe(ids.gate);
  });

  it('falls back to the most recent released Gate once nothing is outstanding', async () => {
    await db.query(
      `update gate_instances set status = 'released', released_at = now(), released_by = $2
       where gate_instance_id = $1`,
      [ids.gate, ids.field],
    );
    const summary = await service.getJob(ids.job);
    expect(summary?.currentGate).toMatchObject({ gateInstanceId: ids.gate, status: 'released' });
    expect(summary?.currentGate?.customerMilestone).toBe('shell');
  });

  it('returns null for a job that does not exist', async () => {
    expect(await service.getJob(createCanonicalId('job'))).toBeNull();
  });
});
