import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, type AuthoritativeQuantity, type DesignerTakeoffSubmission } from '@apex/contracts';
import { MEASURED_LINE_DEFINITIONS, type DirectPriceInput } from '@apex/pricing-engine';
import { GateService } from './index.js';

const ids = { lead: createCanonicalId('lead'), office: createCanonicalId('user') };
const facts: AuthoritativeQuantity[] = [
  ['pool.water-volume', 15000, 'gal'], ['excavation.bank-volume', 100, 'BCY'],
  ['excavation.spoil-haul-volume', 110, 'LCY'], ['shell.gunite-ordered-volume', 40, 'cy'],
  ['shell.reinforcing-steel-weight', 1200, 'lb'], ['shell.forming-perimeter', 100, 'ft'],
  ['finishes.plaster-net-area', 900, 'sf'], ['finishes.plaster-ordered-area', 920, 'sf'],
  ['finishes.tile-net-length', 100, 'lf'], ['finishes.tile-ordered-area', 55, 'sf'],
  ['finishes.coping-ordered-length', 106, 'lf'], ['yard.deck-area', 360, 'sf'],
  ['plumbing.developed-run-length', 750, 'lf'], ['utilities.bonding-conductor-length', 220, 'lf'],
].map(([code, value, unit]) => ({ code: code as AuthoritativeQuantity['code'], value: value as number,
  unit: unit as string, calcId: `calc.${String(code).replaceAll('-', '.')}` }));
const submission: DesignerTakeoffSubmission = {
  engineVersion: 'designer-test', quantityModelVersion: 'designer-quantity-v4',
  jobModel: { shape: 'rectangle', revision: 8 }, quantities: facts,
  calcLedger: facts.map((fact) => ({ id: fact.calcId, label: fact.code, formula: 'fixture', inputs: [], value: fact.value, unit: fact.unit })),
  supersedeExisting: false,
};
const direct: DirectPriceInput[] = ([300, 500, 600, 900, 1100, 1200, 1300] as const).map((code) => ({
  code, name: `Direct ${code}`, scopeStatus: 'not-applicable' as const, amountCents: null,
  basis: 'Explicitly excluded from this scope.',
}));
const measured = MEASURED_LINE_DEFINITIONS.map(([id]) => ({ id, amountCents: 100_00, basis: 'Approved fixture estimate.' }));
const actor = { kind: 'user', userId: ids.office, role: 'office' } as const;

let db: PGlite;
let service: GateService;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(`insert into app_users (user_id, auth_user_id, role, display_name)
    values ($1, '00000000-0000-0000-0000-000000000002', 'office', 'Office')`, [ids.office]);
  await db.query(`insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
    values ($1, 'test', 'proposal-slice', 'proposal-slice-key', '{"customerName":"Test Customer","streetAddress":"1 Test Way"}')`, [ids.lead]);
  service = new GateService(db);
});

describe('proposal lifecycle and Finish estimate', () => {
  it('persists valid takeoff and draft while returning structured missing-price blockers', async () => {
    const result = await service.finishEstimate({ leadId: ids.lead, actor, submission,
      directLines: [], measuredLines: [], feeRateBps: 3000, idempotencyKey: 'finish-blocked-1' });
    expect(result.proposal.status).toBe('draft');
    expect(result.proposal.takeoffRevisionId).toBe(result.takeoff.revisionId);
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'missing-direct-price' }));
    expect((await db.query('select * from takeoff_revisions')).rows).toHaveLength(1);
    expect((await db.query('select * from proposal_versions')).rows).toHaveLength(1);
    expect(result.proposal.proposalPayload).not.toHaveProperty('lines');
    expect(JSON.stringify(result.proposal.proposalPayload)).not.toMatch(/unitCost|confidence|margin/i);
  });

  it('is idempotent per opportunity and design revision', async () => {
    const input = { leadId: ids.lead, actor, submission, directLines: direct, measuredLines: measured,
      feeRateBps: 3000, idempotencyKey: 'finish-complete-1' } as const;
    const first = await service.finishEstimate(input);
    const retry = await service.finishEstimate({ ...input, idempotencyKey: 'finish-complete-retry' });
    expect(retry.proposal.proposalVersionId).toBe(first.proposal.proposalVersionId);
    expect(retry.takeoff.revisionId).toBe(first.takeoff.revisionId);
    expect((await db.query('select * from proposal_versions')).rows).toHaveLength(1);
    await expect(service.finishEstimate({ ...input, submission: {
      ...submission,
      quantities: submission.quantities.map((fact, index) => index === 0 ? { ...fact, value: fact.value + 1 } : fact),
      calcLedger: submission.calcLedger.map((entry, index) => index === 0 ? { ...entry, value: entry.value + 1 } : entry),
    }, idempotencyKey: 'finish-collision-retry' })).rejects.toThrow(/different canonical quantities/i);
  });

  it('issues a pinned immutable version and rejects a stale expected revision', async () => {
    const finished = await service.finishEstimate({ leadId: ids.lead, actor, submission,
      directLines: direct, measuredLines: measured, feeRateBps: 3000, idempotencyKey: 'finish-issue-1' });
    expect(finished.proposal.status).toBe('issued');
    expect(finished.proposal).toMatchObject({
      takeoffRevisionId: finished.takeoff.revisionId,
      quantityPayloadSha256: finished.takeoff.quantityPayloadSha256,
      quantityModelVersion: finished.takeoff.quantityModelVersion,
    });
    await expect(db.query(`update proposal_versions set total_cents = total_cents + 1
      where proposal_version_id = $1`, [finished.proposal.proposalVersionId])).rejects.toThrow(/immutable/i);
    await expect(service.issueProposal({ proposalVersionId: finished.proposal.proposalVersionId,
      expectedVersionNumber: 2, expectedDraftRevision: 1, actor, idempotencyKey: 'stale-issue-1' })).rejects.toThrow(/stale/i);
  });

  it('updates only a draft with an optimistic draft revision before issue', async () => {
    const blocked = await service.finishEstimate({ leadId: ids.lead, actor, submission,
      directLines: [], measuredLines: [], feeRateBps: 3000, idempotencyKey: 'finish-update-1' });
    const updated = await service.updateProposalDraft({
      proposalVersionId: blocked.proposal.proposalVersionId, expectedVersionNumber: 1,
      expectedDraftRevision: 1, directLines: direct, measuredLines: measured, feeRateBps: 3000, actor,
      idempotencyKey: 'update-draft-1',
    });
    expect(updated.draftRevision).toBe(2);
    await expect(service.updateProposalDraft({
      proposalVersionId: blocked.proposal.proposalVersionId, expectedVersionNumber: 1,
      expectedDraftRevision: 1, directLines: direct, measuredLines: measured, feeRateBps: 3000, actor,
      idempotencyKey: 'update-draft-stale',
    })).rejects.toThrow(/stale/i);
    expect((await service.issueProposal({ proposalVersionId: updated.proposalVersionId,
      expectedVersionNumber: 1, expectedDraftRevision: 2, actor,
      idempotencyKey: 'issue-updated-1' })).status).toBe('issued');
  });

  it('issues once under retries and concurrent callers', async () => {
    const blocked = await service.finishEstimate({ leadId: ids.lead, actor, submission,
      directLines: [], measuredLines: [], feeRateBps: 3000, idempotencyKey: 'finish-issue-retry-1' });
    const complete = await service.updateProposalDraft({ proposalVersionId: blocked.proposal.proposalVersionId,
      expectedVersionNumber: 1, expectedDraftRevision: 1, directLines: direct, measuredLines: measured,
      feeRateBps: 3000, actor, idempotencyKey: 'update-issue-retry-1' });
    const input = { proposalVersionId: complete.proposalVersionId, expectedVersionNumber: 1,
      expectedDraftRevision: 2, actor } as const;
    const results = await Promise.all([
      service.issueProposal({ ...input, idempotencyKey: 'issue-retry-one-1' }),
      service.issueProposal({ ...input, idempotencyKey: 'issue-retry-two-1' }),
    ]);
    const retry = await service.issueProposal({ ...input, idempotencyKey: 'issue-retry-one-1' });
    expect(results.map((result) => result.status)).toEqual(['issued', 'issued']);
    expect(retry.status).toBe('issued');
    expect((await db.query(`select event_type from events
      where lead_id = $1 and event_type = 'proposal.issued'`, [ids.lead])).rows).toHaveLength(1);
  });

  it('permits only the one-time matching Job bind when signing an issued version', async () => {
    const finished = await service.finishEstimate({ leadId: ids.lead, actor, submission,
      directLines: direct, measuredLines: measured, feeRateBps: 3000, idempotencyKey: 'finish-bind-1' });
    const otherLead = createCanonicalId('lead');
    const otherJob = createCanonicalId('job');
    const job = createCanonicalId('job');
    await db.query(`insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
      values ($1, 'test', $2, $3, '{}')`, [otherLead, 'other-proposal', 'other-proposal-key']);
    await db.query(`insert into jobs (job_id, lead_id, signed_proposal_version, status)
      values ($1, $2, 1, 'active'), ($3, $4, 1, 'active')`, [job, ids.lead, otherJob, otherLead]);
    await expect(db.query(`update proposal_versions set status = 'signed', job_id = $1,
      signed_at = now(), total_cents = total_cents + 1 where proposal_version_id = $2`,
    [job, finished.proposal.proposalVersionId])).rejects.toThrow(/immutable/i);
    await db.query(`update proposal_versions set status = 'signed', job_id = $1, signed_at = now()
      where proposal_version_id = $2`, [job, finished.proposal.proposalVersionId]);
    await expect(db.query(`update proposal_versions set job_id = $1 where proposal_version_id = $2`,
      [otherJob, finished.proposal.proposalVersionId])).rejects.toThrow(/immutable|must match/i);
  });

  it('lists/gets versions and signs idempotently, minting exactly one Job and project', async () => {
    const finished = await service.finishEstimate({ leadId: ids.lead, actor, submission,
      directLines: direct, measuredLines: measured, feeRateBps: 3000, idempotencyKey: 'finish-sign-1' });
    expect((await service.listProposalVersions(ids.lead))).toHaveLength(1);
    expect((await service.getProposalVersion(finished.proposal.proposalVersionId))?.proposalVersionId)
      .toBe(finished.proposal.proposalVersionId);
    await expect(service.signProposal({ proposalVersionId: finished.proposal.proposalVersionId,
      expectedVersionNumber: 1, expectedDraftRevision: 1, actor,
      customerAcceptanceConfirmed: false, idempotencyKey: 'sign-unconfirmed-1' })).rejects.toThrow(/customer accepted/i);
    await expect(service.signProposal({ proposalVersionId: finished.proposal.proposalVersionId,
      expectedVersionNumber: 1, expectedDraftRevision: 1, actor, customerAcceptanceConfirmed: false,
      idempotencyKey: 'sign-unverified-1' })).rejects.toThrow(/customer accepted/i);
    const first = await service.signProposal({ proposalVersionId: finished.proposal.proposalVersionId,
      expectedVersionNumber: 1, expectedDraftRevision: 1, actor, customerAcceptanceConfirmed: true, idempotencyKey: 'sign-once-1' });
    const retry = await service.signProposal({ proposalVersionId: finished.proposal.proposalVersionId,
      expectedVersionNumber: 1, expectedDraftRevision: 1, actor, customerAcceptanceConfirmed: true, idempotencyKey: 'sign-retry-1' });
    expect(retry.jobId).toBe(first.jobId);
    expect((await db.query('select * from jobs')).rows).toHaveLength(1);
    expect((await db.query('select * from projects')).rows).toHaveLength(1);
  });
});
