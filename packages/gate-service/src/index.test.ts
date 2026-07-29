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
};
const fieldActor: EventActor = { kind: 'user', userId: ids.field, role: 'field' };
const officeActor: EventActor = { kind: 'user', userId: ids.office, role: 'office' };

let db: PGlite;
let service: GateService;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'field', 'Field Lead'),
     ($2, '00000000-0000-0000-0000-000000000002', 'office', 'Office User')`,
    [ids.field, ids.office],
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
  await service.createPreGuniteGate({ gateInstanceId: ids.gate, jobId: ids.job });
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

    const release = await service.execute(ids.gate, {
      type: 'release-gate', actor: fieldActor, at: '2026-07-29T14:10:00.000Z',
    }, context('release-gate-1'));
    expect(release.events.map((event) => event.eventType)).toEqual([
      'gate.released', 'draw.eligible', 'customer_update.published',
    ]);

    const reloaded = await new GateService(db).getGate(ids.gate);
    expect(reloaded.status).toBe('released');
    expect([...reloaded.requirements.values()].every((item) => item.status === 'passed')).toBe(true);

    const draws = await db.query(`select draw_id from draw_eligibility where job_id = $1`, [ids.job]);
    expect(draws.rows).toHaveLength(1);
    const projections = await service.getCustomerMilestones(ids.job);
    expect(projections).toHaveLength(1);
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
    const proof = evidence('approved-plan-on-site', 'measurement');
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
});
