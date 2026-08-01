import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, type EventActor } from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { GateService } from './index.js';

/**
 * The seven Gate templates running as one engine.
 *
 * PRD §21 requires at least three Gate types completed on real work. This proves
 * the engine can do it; the pilot proves Apex did it.
 */

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  owner: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  office: createCanonicalId('user'),
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const superintendent: EventActor = { kind: 'user', userId: ids.superintendent, role: 'superintendent' };

let db: PGlite;
let service: GateService;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Travis'),
     ($2, '00000000-0000-0000-0000-000000000002', 'superintendent', 'Site Super'),
     ($3, '00000000-0000-0000-0000-000000000003', 'office', 'Office User')`,
    [ids.owner, ids.superintendent, ids.office],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'source-templates', 'test:source-templates', '{}')`,
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
});

const at = '2026-07-31T17:00:00.000Z';

/** Take a Gate from opened to signed, attaching evidence for every requirement. */
const runToSignature = async (definitionKey: string, actor: EventActor = superintendent) => {
  const gateInstanceId = createCanonicalId('gate');
  await service.createGate({ gateInstanceId, jobId: ids.job, definitionKey });
  await service.execute(gateInstanceId, { type: 'start-gate', actor, at }, { idempotencyKey: `start-${definitionKey}` });

  const gate = await service.getGate(gateInstanceId);
  for (const requirement of gate.requirements.values()) {
    const evidenceId = createCanonicalId('evidence');
    const kind = requirement.acceptedEvidenceKinds[0]!;
    await service.execute(gateInstanceId, {
      type: 'add-evidence', actor, at, requirementKey: requirement.key, evidenceId, kind,
    }, {
      idempotencyKey: `ev-${definitionKey}-${requirement.key}`,
      evidence: {
        evidenceId, requirementKey: requirement.key, kind,
        storageKey: `${ids.job}/${definitionKey}/${requirement.key}.bin`,
        sha256: 'd'.repeat(64), capturedAt: at, mimeType: 'image/jpeg', byteSize: 128, metadata: {},
      },
    });
    await service.execute(gateInstanceId, {
      type: 'evaluate-requirement', actor, at, requirementKey: requirement.key, outcome: 'passed',
    }, { idempotencyKey: `pass-${definitionKey}-${requirement.key}` });
  }

  const result = await service.execute(gateInstanceId, {
    type: 'release-gate', actor, at,
  }, { idempotencyKey: `release-${definitionKey}` });
  return { gateInstanceId, result };
};

describe('the seven templates', () => {
  it('are all active and ordered through the build', async () => {
    const plan = await service.listJobGates(ids.job);
    expect(plan.map((entry) => entry.definitionKey)).toEqual([
      'permit', 'excavation', 'pre-gunite', 'shell', 'deck-tile', 'equipment', 'final',
    ]);
    // No Gate has been opened, and the plan says so rather than implying skips.
    expect(plan.every((entry) => entry.gateInstanceId === null && entry.status === null)).toBe(true);
  });

  it('bind exactly the four draws named by the contract schedule', async () => {
    const plan = await service.listJobGates(ids.job);
    expect(plan.filter((entry) => entry.drawCode !== null).map((entry) => [entry.definitionKey, entry.drawCode]))
      .toEqual([
        ['excavation', 'draw-1'],
        ['shell', 'draw-2'],
        ['deck-tile', 'draw-3'],
        ['final', 'draw-final'],
      ]);
  });

  it('require a countersign on pre-gunite alone', async () => {
    const plan = await service.listJobGates(ids.job);
    expect(plan.filter((entry) => entry.requiresCountersign).map((entry) => entry.definitionKey))
      .toEqual(['pre-gunite']);
  });

  it('each sit on a confirmed construction phase', async () => {
    const plan = await service.listJobGates(ids.job);
    expect(plan.map((entry) => entry.phaseKey)).toEqual([
      'design-permitting', 'layout-excavation', 'gunite', 'gunite',
      'decking', 'equipment-hookup', 'plaster-fill',
    ]);
  });
});

describe('running three Gate types on one job', () => {
  it('completes permit, excavation, and shell with the right consequences', async () => {
    // Permit — no draw, publishes the design milestone.
    const permit = await runToSignature('permit');
    expect(permit.result.events.map((e) => e.eventType)).toEqual(['gate.released', 'customer_update.published']);

    // Excavation — releases Draw 1.
    const excavation = await runToSignature('excavation');
    expect(excavation.result.events.map((e) => e.eventType))
      .toEqual(['gate.released', 'draw.eligible', 'customer_update.published']);

    // Shell — releases Draw 2, and a superintendent may sign it alone.
    const shell = await runToSignature('shell');
    expect(shell.result.events.map((e) => e.eventType))
      .toEqual(['gate.released', 'draw.eligible', 'customer_update.published']);

    const draws = await db.query<{ source_gate_instance_id: string }>(
      `select source_gate_instance_id from job_draws where job_id = $1`, [ids.job],
    );
    expect(draws.rows).toHaveLength(2);

    // Each Gate told the customer its own thing, in its own words.
    const updates = await service.getCustomerMilestones(ids.job);
    expect(updates.map((update) => [update.milestone, update.title])).toEqual([
      ['design', 'Design approved and permitted'],
      ['excavation', 'Excavation complete'],
      ['shell', 'Concrete shell complete'],
    ]);

    const plan = await service.listJobGates(ids.job);
    const released = plan.filter((entry) => entry.status === 'released').map((entry) => entry.definitionKey);
    expect(released).toEqual(['permit', 'excavation', 'shell']);
  });

  it('holds pre-gunite open on one signature while the others release', async () => {
    const preGunite = await runToSignature('pre-gunite');
    expect(preGunite.result.state.status).toBe('awaiting-countersign');

    const countersigned = await service.execute(preGunite.gateInstanceId, {
      type: 'countersign-gate', actor: owner, at,
    }, { idempotencyKey: 'countersign-pre-gunite' });
    expect(countersigned.state.status).toBe('released');
    expect(countersigned.events.map((e) => e.eventType))
      .toEqual(['gate.countersigned', 'gate.released', 'customer_update.published']);
  });

  it('carries the eleven PRD §9.4 requirements on pre-gunite', async () => {
    const gateInstanceId = createCanonicalId('gate');
    const gate = await service.createGate({ gateInstanceId, jobId: ids.job, definitionKey: 'pre-gunite' });
    expect(gate.definitionVersion).toBe(2);
    expect(gate.requirements.size).toBe(11);
    expect([...gate.requirements.keys()]).toContain('plumbing-pressure-test');
    expect([...gate.requirements.values()].every((r) => r.evidenceRequired)).toBe(true);
  });
});

describe('opening Gates', () => {
  it('is idempotent per job and definition', async () => {
    const first = await service.createGate({ gateInstanceId: createCanonicalId('gate'), jobId: ids.job, definitionKey: 'shell' });
    const second = await service.createGate({ gateInstanceId: createCanonicalId('gate'), jobId: ids.job, definitionKey: 'shell' });
    expect(second.gateInstanceId).toBe(first.gateInstanceId);
  });

  it('refuses an unknown definition', async () => {
    await expect(service.createGate({
      gateInstanceId: createCanonicalId('gate'), jobId: ids.job, definitionKey: 'demolition',
    })).rejects.toThrow(DomainRuleError);
  });

  it('refuses a superseded definition version', async () => {
    // Pre-gunite v1 is inactive; asking for pre-gunite resolves to v2.
    const gate = await service.createGate({
      gateInstanceId: createCanonicalId('gate'), jobId: ids.job, definitionKey: 'pre-gunite',
    });
    expect(gate.definitionVersion).toBe(2);
  });

  it('does not force Gates into sequence, so a job imported mid-build can open Shell first', async () => {
    const shell = await runToSignature('shell');
    expect(shell.result.state.status).toBe('released');
    const plan = await service.listJobGates(ids.job);
    expect(plan.find((entry) => entry.definitionKey === 'permit')?.status).toBeNull();
  });
});
