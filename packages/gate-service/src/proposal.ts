import { createHash } from 'node:crypto';
import type { Database, Queryable } from '@apex/database';
import {
  ApprovedTakeoffRevisionSchema,
  DesignerTakeoffSubmissionSchema,
  ProposalVersionSchema,
  calculateQuantityPayloadSha256,
  createCanonicalId,
  readLeadIdentity,
  type ApprovedTakeoffRevision,
  type DesignerTakeoffSubmission,
  type EventActor,
  type LeadId,
  type ProposalVersion,
  type ProposalId,
  type ProposalVersionId,
} from '@apex/contracts';
import { DomainRuleError, RoleRefusalError } from '@apex/domain';
import {
  priceApprovedTakeoff,
  type DirectPriceInput,
  type MeasuredPriceInput,
  type PricingBlocker,
} from '@apex/pricing-engine';

const canonicalJson = (value: unknown): string => {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (node && typeof node === 'object') return Object.fromEntries(
      Object.keys(node as Record<string, unknown>).sort()
        .map((key) => [key, visit((node as Record<string, unknown>)[key])]),
    );
    return node;
  };
  return JSON.stringify(visit(value));
};
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const commandKey = (value: string): string => {
  if (value.trim().length < 8) throw new Error('Command idempotency keys must contain at least 8 characters.');
  return `proposal:${sha256(value)}`;
};

const requireEstimator = (actor: EventActor): Extract<EventActor, { kind: 'user' }> => {
  if (actor.kind !== 'user' || !['admin', 'office'].includes(actor.role)) {
    throw new RoleRefusalError('Admin or office authority is required for Proposal pricing.');
  }
  return actor;
};

const scopeLines = (lines: readonly { name: string; code: number; amountCents: number | null; scopeStatus?: 'quoted' | 'not-applicable' | 'unresolved' }[]) =>
  lines.map((line) => ({
    name: line.name,
    resolved: line.scopeStatus === 'not-applicable' ? false : line.amountCents !== null,
    code: line.code,
    ...(line.scopeStatus ? { scopeStatus: line.scopeStatus } : {}),
  }));

interface ProposalRow {
  proposal_version_id: string;
  proposal_id: string;
  lead_id: string;
  job_id: string | null;
  version_number: number;
  draft_revision: number;
  status: string;
  takeoff_revision_id: string;
  quantity_payload_sha256: string;
  quantity_model_version: string;
  pricing_library_version: string;
  proposal_payload_sha256: string;
  proposal_payload: Record<string, unknown>;
  total_cents: string | number;
  created_at: string | Date;
  created_by: string;
  issued_at: string | Date | null;
  issued_by: string | null;
  signed_at: string | Date | null;
}

const proposalFromRow = (row: ProposalRow): ProposalVersion => {
  // Parse the immutable 0008 envelope, then attach 0032's optimistic draft
  // revision. This remains compatible with a rolling deployment where an API
  // process still has the pre-0032 contract module loaded.
  const proposal = ProposalVersionSchema.parse({
    proposalVersionId: row.proposal_version_id, proposalId: row.proposal_id, leadId: row.lead_id,
    jobId: row.job_id, versionNumber: row.version_number, status: row.status,
    takeoffRevisionId: row.takeoff_revision_id, quantityPayloadSha256: row.quantity_payload_sha256,
    quantityModelVersion: row.quantity_model_version, pricingLibraryVersion: row.pricing_library_version,
    proposalPayloadSha256: row.proposal_payload_sha256, proposalPayload: row.proposal_payload,
    totalCents: Number(row.total_cents), createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
    issuedAt: row.issued_at === null ? null : new Date(row.issued_at).toISOString(),
    issuedBy: row.issued_by,
    signedAt: row.signed_at === null ? null : new Date(row.signed_at).toISOString(),
  });
  return { ...proposal, draftRevision: row.draft_revision };
};

interface TakeoffRow {
  revision_id: string; lead_id: string; job_id: string | null; revision_number: number; status: string;
  engine_version: string; job_input_sha256: string; calc_ledger_sha256: string;
  quantity_payload_sha256: string; quantity_model_version: string; created_at: string | Date;
  created_by: string; approved_at: string | Date; approved_by: string;
  blocking_issues: unknown; quantities: unknown; calc_ledger: unknown;
}

const takeoffFromRow = (row: TakeoffRow): ApprovedTakeoffRevision => ApprovedTakeoffRevisionSchema.parse({
  revisionId: row.revision_id, leadId: row.lead_id, jobId: row.job_id,
  revisionNumber: row.revision_number, status: row.status, engineVersion: row.engine_version,
  jobInputSha256: row.job_input_sha256, calcLedgerSha256: row.calc_ledger_sha256,
  quantityPayloadSha256: row.quantity_payload_sha256, quantityModelVersion: row.quantity_model_version,
  createdAt: new Date(row.created_at).toISOString(), createdBy: row.created_by,
  approvedAt: new Date(row.approved_at).toISOString(), approvedBy: row.approved_by,
  blockingIssues: row.blocking_issues, quantities: row.quantities, calcLedger: row.calc_ledger,
});

const proposalSelect = `select proposal_version_id, proposal_id, lead_id, job_id, version_number, draft_revision,
  status, takeoff_revision_id, quantity_payload_sha256, quantity_model_version,
  pricing_library_version, proposal_payload_sha256, proposal_payload, total_cents::text,
  created_at, created_by, issued_at, issued_by, signed_at from proposal_versions`;
const takeoffSelect = `select revision_id, lead_id, job_id, revision_number, status, engine_version,
  job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantity_model_version,
  created_at, created_by, approved_at, approved_by, blocking_issues, quantities, calc_ledger
  from takeoff_revisions`;

export interface FinishEstimateResult {
  readonly takeoff: ApprovedTakeoffRevision;
  readonly proposal: ProposalVersion;
  readonly blockers: readonly PricingBlocker[];
  readonly workbook: {
    readonly revisionId: string;
    readonly quantityPayloadSha256: string;
    readonly quantityModelVersion: string;
    readonly orderList: ApprovedTakeoffRevision['quantities'];
  };
}

export class ProposalService {
  constructor(private readonly db: Database) {}

  async getProposalVersion(id: ProposalVersionId, client: Queryable = this.db): Promise<ProposalVersion | null> {
    const result = await client.query<ProposalRow>(`${proposalSelect} where proposal_version_id = $1`, [id]);
    return result.rows[0] ? proposalFromRow(result.rows[0]) : null;
  }

  async listProposalVersions(leadId: LeadId): Promise<readonly ProposalVersion[]> {
    const result = await this.db.query<ProposalRow>(
      `${proposalSelect} where lead_id = $1 order by version_number desc`, [leadId],
    );
    return result.rows.map(proposalFromRow);
  }

  private async getTakeoff(id: string, client: Queryable = this.db): Promise<ApprovedTakeoffRevision> {
    const result = await client.query<TakeoffRow>(`${takeoffSelect} where revision_id = $1`, [id]);
    if (!result.rows[0]) throw new Error(`Unknown takeoff revision: ${id}.`);
    return takeoffFromRow(result.rows[0]);
  }

  private async result(takeoffId: string, proposalId: ProposalVersionId): Promise<FinishEstimateResult> {
    const takeoff = await this.getTakeoff(takeoffId);
    const proposal = await this.getProposalVersion(proposalId);
    if (!proposal) throw new Error('Finish estimate result references a missing Proposal version.');
    const raw = proposal.proposalPayload.blockers;
    const blockers = Array.isArray(raw) ? raw as PricingBlocker[] : [];
    return { takeoff, proposal, blockers, workbook: {
      revisionId: takeoff.revisionId, quantityPayloadSha256: takeoff.quantityPayloadSha256,
      quantityModelVersion: takeoff.quantityModelVersion, orderList: takeoff.quantities,
    } };
  }

  async finishEstimate(input: {
    readonly leadId: LeadId;
    readonly actor: EventActor;
    readonly submission: DesignerTakeoffSubmission;
    readonly directLines: readonly DirectPriceInput[];
    readonly measuredLines: readonly MeasuredPriceInput[];
    readonly feeRateBps: number;
    readonly idempotencyKey: string;
  }): Promise<FinishEstimateResult> {
    const actor = requireEstimator(input.actor);
    const submission = DesignerTakeoffSubmissionSchema.parse(input.submission);
    const finishKey = commandKey(input.idempotencyKey);
    const lead = await this.db.query<{ accepted_payload: unknown }>(
      'select accepted_payload from leads where lead_id = $1', [input.leadId],
    );
    if (!lead.rows[0]) throw new DomainRuleError(`Unknown opportunity: ${input.leadId}.`);
    const acceptedPayload = lead.rows[0].accepted_payload;
    const jobInputSha256 = sha256(canonicalJson(submission.jobModel));
    const prior = await this.db.query<{ takeoff_revision_id: string; proposal_version_id: string }>(
      'select takeoff_revision_id, proposal_version_id from finish_estimate_runs where lead_id = $1 and job_input_sha256 = $2',
      [input.leadId, jobInputSha256],
    );
    if (prior.rows[0]) {
      const priorTakeoff = await this.getTakeoff(prior.rows[0].takeoff_revision_id);
      const incomingDigest = calculateQuantityPayloadSha256(submission.quantities);
      if (priorTakeoff.quantityPayloadSha256 !== incomingDigest
          || priorTakeoff.quantityModelVersion !== submission.quantityModelVersion) {
        throw new DomainRuleError('This design revision key was already used with different canonical quantities.');
      }
      const proposalVersionId = prior.rows[0].proposal_version_id as ProposalVersionId;
      const existing = await this.result(prior.rows[0].takeoff_revision_id, proposalVersionId);
      /*
       * Issued and signed versions stay put: a retry of a finished estimate
       * must not open another draft. A draft is the empty handoff Designer
       * writes before anyone has typed a price. Returning that draft here
       * throws away the prices on this call, so the estimate page shows
       * "needs price" until a second click updates the draft itself.
       */
      if (existing.proposal.status !== 'draft') return existing;
      const updated = await this.updateProposalDraft({
        proposalVersionId,
        expectedVersionNumber: existing.proposal.versionNumber,
        expectedDraftRevision: existing.proposal.draftRevision,
        directLines: input.directLines,
        measuredLines: input.measuredLines,
        feeRateBps: input.feeRateBps,
        actor,
        idempotencyKey: input.idempotencyKey,
      });
      const rawBlockers = updated.proposalPayload.blockers;
      const blockers = Array.isArray(rawBlockers) ? rawBlockers as PricingBlocker[] : [];
      if (blockers.length === 0) {
        await this.issueProposal({
          proposalVersionId: updated.proposalVersionId,
          expectedVersionNumber: updated.versionNumber,
          expectedDraftRevision: updated.draftRevision,
          actor,
          idempotencyKey: input.idempotencyKey,
        });
      }
      return this.result(prior.rows[0].takeoff_revision_id, proposalVersionId);
    }

    const calcLedgerSha256 = sha256(JSON.stringify(submission.calcLedger));
    const quantityPayloadSha256 = calculateQuantityPayloadSha256(submission.quantities);
    const now = new Date().toISOString();
    const revisionId = createCanonicalId('revision');
    const proposalVersionId = createCanonicalId('proposal_version');
    let proposalId: ProposalId = createCanonicalId('proposal');
    let revisionNumber = 1;
    let versionNumber = 1;

    await this.db.transaction(async (tx) => {
      const current = await tx.query<{ revision_id: string; revision_number: number }>(
        `select revision_id, revision_number from takeoff_revisions
         where lead_id = $1 and status = 'approved'`, [input.leadId],
      );
      if (current.rows[0] && !submission.supersedeExisting) {
        throw new DomainRuleError('This opportunity already has an approved takeoff; supersedeExisting is required.');
      }
      revisionNumber = (current.rows[0]?.revision_number ?? 0) + 1;
      if (current.rows[0]) await tx.query(
        `update takeoff_revisions set status = 'superseded' where revision_id = $1`, [current.rows[0].revision_id],
      );
      await tx.query(
        `insert into takeoff_revisions
          (revision_id, lead_id, job_id, revision_number, status, engine_version,
           quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256,
           quantities, calc_ledger, blocking_issues, created_by, approved_at, approved_by)
         values ($1, $2, null, $3, 'approved', $4, $5, $6, $7, $8,
           $9::jsonb, $10::jsonb, '[]'::jsonb, $11, $12, $11)`,
        [revisionId, input.leadId, revisionNumber, submission.engineVersion,
          submission.quantityModelVersion, jobInputSha256, calcLedgerSha256, quantityPayloadSha256,
          JSON.stringify(submission.quantities), JSON.stringify(submission.calcLedger), actor.userId, now],
      );
      if (current.rows[0]) await tx.query(
        'update takeoff_revisions set superseded_by_revision_id = $1 where revision_id = $2',
        [revisionId, current.rows[0].revision_id],
      );

      const storedTakeoff = await this.getTakeoff(revisionId, tx);
      const priced = priceApprovedTakeoff({ revision: storedTakeoff,
        directLines: input.directLines, measuredLines: input.measuredLines, feeRateBps: input.feeRateBps });
      const existingProposal = await tx.query<{ proposal_id: string; current_version: number }>(
        'select proposal_id, current_version from proposals where lead_id = $1', [input.leadId],
      );
      if (existingProposal.rows[0]) {
        proposalId = existingProposal.rows[0].proposal_id as ProposalId;
        versionNumber = existingProposal.rows[0].current_version + 1;
        await tx.query('update proposals set current_version = $1, updated_at = $2 where proposal_id = $3',
          [versionNumber, now, proposalId]);
      } else {
        await tx.query('insert into proposals (proposal_id, lead_id, current_version) values ($1, $2, 1)',
          [proposalId, input.leadId]);
      }
      const identity = readLeadIdentity(acceptedPayload);
      const payload = {
        schemaVersion: 1,
        status: priced.canIssue ? 'issued' : 'draft',
        customer: { name: identity.customerName, address: identity.addressLine },
        takeoff: { revisionId, quantityPayloadSha256, quantityModelVersion: submission.quantityModelVersion },
        pricingLibraryVersion: priced.pricingLibraryVersion,
        scope: scopeLines(priced.lines),
        totalCents: priced.canIssue ? priced.totalCents : null,
        blockers: priced.blockers,
        email: priced.canIssue ? {
          subject: `Apex proposal for ${identity.addressLine ?? identity.customerName ?? 'your pool project'}`,
          body: 'Your Apex pool proposal is ready for review. Please review the attached proposal and contact us with questions.',
        } : null,
      };
      const payloadJson = canonicalJson(payload);
      await tx.query(
        `insert into proposal_versions
          (proposal_version_id, proposal_id, lead_id, version_number, status, takeoff_revision_id,
           quantity_payload_sha256, quantity_model_version, pricing_library_version,
           proposal_payload_sha256, proposal_payload, total_cents, created_by, issued_at, issued_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13,
           case when $5 = 'issued' then $14::timestamptz else null end,
           case when $5 = 'issued' then $13 else null end)`,
        [proposalVersionId, proposalId, input.leadId, versionNumber,
          priced.canIssue ? 'issued' : 'draft', revisionId, quantityPayloadSha256,
          submission.quantityModelVersion, priced.pricingLibraryVersion, sha256(payloadJson), payloadJson,
          priced.totalCents, actor.userId, now],
      );
      await tx.query(
        `insert into finish_estimate_runs
          (lead_id, job_input_sha256, takeoff_revision_id, proposal_version_id)
         values ($1, $2, $3, $4)`, [input.leadId, jobInputSha256, revisionId, proposalVersionId],
      );
      await tx.query(`update leads set status = 'proposal', updated_at = $1 where lead_id = $2`, [now, input.leadId]);
      const draftedEventId = createCanonicalId('event');
      await tx.query(`insert into events
        (event_id, schema_version, event_type, occurred_at, actor, lead_id,
         correlation_id, idempotency_key, payload)
        values ($1, 1, 'proposal.drafted', $2, $3::jsonb, $4, $1, $5,
          jsonb_build_object('proposalVersion', $6::int, 'takeoffRevisionId', $7::text))`,
        [draftedEventId, now, JSON.stringify(actor), input.leadId,
          `${finishKey}:proposal.drafted`, versionNumber, revisionId]);
      if (priced.canIssue) {
        const issuedEventId = createCanonicalId('event');
        await tx.query(`insert into events
          (event_id, schema_version, event_type, occurred_at, actor, lead_id,
           correlation_id, causation_event_id, idempotency_key, payload)
          values ($1, 1, 'proposal.issued', $2, $3::jsonb, $4, $1, $5, $6,
            jsonb_build_object('proposalVersion', $7::int, 'proposalVersionId', $8::text,
              'issuedBy', $9::text, 'totalCents', $10::bigint))`,
          [issuedEventId, now, JSON.stringify(actor), input.leadId, draftedEventId,
            `${finishKey}:proposal.issued`, versionNumber, proposalVersionId, actor.userId, priced.totalCents]);
      }
    });
    return this.result(revisionId, proposalVersionId);
  }

  async issueProposal(input: {
    readonly proposalVersionId: ProposalVersionId;
    readonly expectedVersionNumber: number;
    readonly expectedDraftRevision: number;
    readonly actor: EventActor;
    readonly idempotencyKey: string;
  }): Promise<ProposalVersion> {
    const actor = requireEstimator(input.actor);
    const issueKey = commandKey(input.idempotencyKey);
    const proposal = await this.getProposalVersion(input.proposalVersionId);
    if (!proposal) throw new DomainRuleError(`Unknown Proposal version: ${input.proposalVersionId}.`);
    if (proposal.versionNumber !== input.expectedVersionNumber || proposal.draftRevision !== input.expectedDraftRevision) throw new DomainRuleError(
      `Stale Proposal revision: expected version ${input.expectedVersionNumber} draft ${input.expectedDraftRevision}.`,
    );
    if (proposal.status === 'issued' || proposal.status === 'signed') return proposal;
    const blockers = proposal.proposalPayload.blockers;
    if (Array.isArray(blockers) && blockers.length > 0) throw new DomainRuleError('Proposal has unresolved pricing blockers.');
    const now = new Date().toISOString();
    const payloadJson = canonicalJson({ ...proposal.proposalPayload, status: 'issued' });
    await this.db.transaction(async (tx) => {
      // Lock and re-check inside the transaction. Two callers can both read a
      // draft before either conditional update commits; only the winner may
      // append the canonical issued event.
      const locked = await tx.query<{ status: string }>(
        `select status from proposal_versions where proposal_version_id = $1 for update`,
        [input.proposalVersionId],
      );
      if (!locked.rows[0]) throw new Error('Proposal disappeared while issuing.');
      if (locked.rows[0].status !== 'draft') return;
      const updated = await tx.query(`update proposal_versions set status = 'issued', issued_at = $1, issued_by = $2,
        proposal_payload = $3::jsonb, proposal_payload_sha256 = $4
        where proposal_version_id = $5 and status = 'draft'
          and version_number = $6 and draft_revision = $7`,
      [now, actor.userId, payloadJson, sha256(payloadJson), input.proposalVersionId,
        input.expectedVersionNumber, input.expectedDraftRevision]);
      if (updated.affectedRows !== 1) throw new DomainRuleError(
        'Stale Proposal revision. Reload before issuing.',
      );
      const eventId = createCanonicalId('event');
      await tx.query(`insert into events
        (event_id, schema_version, event_type, occurred_at, actor, lead_id,
         correlation_id, idempotency_key, payload)
        values ($1, 1, 'proposal.issued', $2, $3::jsonb, $4, $1, $5,
          jsonb_build_object('proposalVersion', $6::int, 'proposalVersionId', $7::text,
            'issuedBy', $8::text, 'totalCents', $9::bigint))`,
        [eventId, now, JSON.stringify(actor), proposal.leadId, `${issueKey}:proposal.issued`,
          proposal.versionNumber, proposal.proposalVersionId, actor.userId, proposal.totalCents]);
    });
    const issued = await this.getProposalVersion(input.proposalVersionId);
    if (!issued) throw new Error('Issued Proposal disappeared.');
    return issued;
  }

  async updateProposalDraft(input: {
    readonly proposalVersionId: ProposalVersionId;
    readonly expectedVersionNumber: number;
    readonly expectedDraftRevision: number;
    readonly directLines: readonly DirectPriceInput[];
    readonly measuredLines: readonly MeasuredPriceInput[];
    readonly feeRateBps: number;
    readonly actor: EventActor;
    readonly idempotencyKey: string;
  }): Promise<ProposalVersion> {
    requireEstimator(input.actor);
    commandKey(input.idempotencyKey);
    const proposal = await this.getProposalVersion(input.proposalVersionId);
    if (!proposal) throw new DomainRuleError(`Unknown Proposal version: ${input.proposalVersionId}.`);
    if (proposal.status !== 'draft') throw new DomainRuleError('Issued and signed Proposal versions are immutable.');
    if (proposal.versionNumber !== input.expectedVersionNumber || proposal.draftRevision !== input.expectedDraftRevision) {
      throw new DomainRuleError('Stale Proposal draft revision. Reload before updating.');
    }
    const takeoff = await this.getTakeoff(proposal.takeoffRevisionId);
    const priced = priceApprovedTakeoff({ revision: takeoff, directLines: input.directLines,
      measuredLines: input.measuredLines, feeRateBps: input.feeRateBps });
    const oldCustomer = proposal.proposalPayload.customer;
    const customer = oldCustomer && typeof oldCustomer === 'object'
      ? oldCustomer as { name?: unknown; address?: unknown }
      : {};
    const payload = {
      schemaVersion: 1, status: 'draft',
      customer: { name: typeof customer.name === 'string' ? customer.name : null,
        address: typeof customer.address === 'string' ? customer.address : null },
      takeoff: { revisionId: takeoff.revisionId, quantityPayloadSha256: takeoff.quantityPayloadSha256,
        quantityModelVersion: takeoff.quantityModelVersion },
      pricingLibraryVersion: priced.pricingLibraryVersion,
      scope: scopeLines(priced.lines),
      totalCents: priced.canIssue ? priced.totalCents : null,
      blockers: priced.blockers,
      email: priced.canIssue ? {
        subject: `Apex proposal for ${typeof customer.address === 'string' ? customer.address : typeof customer.name === 'string' ? customer.name : 'your pool project'}`,
        body: 'Your Apex pool proposal is ready for review. Please review the attached proposal and contact us with questions.',
      } : null,
    };
    const payloadJson = canonicalJson(payload);
    const updated = await this.db.query(
      `update proposal_versions set draft_revision = draft_revision + 1,
         pricing_library_version = $1, proposal_payload_sha256 = $2,
         proposal_payload = $3::jsonb, total_cents = $4
       where proposal_version_id = $5 and status = 'draft'
         and version_number = $6 and draft_revision = $7`,
      [priced.pricingLibraryVersion, sha256(payloadJson), payloadJson, priced.totalCents,
        input.proposalVersionId, input.expectedVersionNumber, input.expectedDraftRevision],
    );
    if (updated.affectedRows === 0) throw new DomainRuleError('Stale Proposal draft revision. Reload before updating.');
    const stored = await this.getProposalVersion(input.proposalVersionId);
    if (!stored) throw new Error('Updated Proposal disappeared.');
    if (stored.draftRevision !== input.expectedDraftRevision + 1) {
      throw new DomainRuleError('Stale Proposal draft revision. Reload before updating.');
    }
    return stored;
  }

  async signProposal(input: {
    readonly proposalVersionId: ProposalVersionId;
    readonly expectedVersionNumber: number;
    readonly expectedDraftRevision: number;
    readonly actor: EventActor;
    readonly customerAcceptanceConfirmed: boolean;
    readonly idempotencyKey: string;
    /** Used by the demo seed so a removed-and-recreated job keeps one id. */
    readonly jobId?: string;
  }): Promise<{ readonly proposal: ProposalVersion; readonly jobId: string; readonly projectId: string }> {
    const actor = requireEstimator(input.actor);
    if (!input.customerAcceptanceConfirmed) {
      throw new DomainRuleError('Confirm that the customer accepted this exact issued Proposal before recording it as signed.');
    }
    const baseKey = commandKey(input.idempotencyKey);
    const current = await this.getProposalVersion(input.proposalVersionId);
    if (!current) throw new DomainRuleError(`Unknown Proposal version: ${input.proposalVersionId}.`);
    if (current.versionNumber !== input.expectedVersionNumber || current.draftRevision !== input.expectedDraftRevision) {
      throw new DomainRuleError('Stale Proposal revision.');
    }
    if (current.status === 'signed' && current.jobId) return { proposal: current, jobId: current.jobId, projectId: current.jobId };
    if (current.status !== 'issued') throw new DomainRuleError('Only an issued Proposal can be signed.');

    const existing = await this.db.query<{ job_id: string }>('select job_id from jobs where lead_id = $1', [current.leadId]);
    if (existing.rows[0]) throw new DomainRuleError('This opportunity is already bound to a Job.');
    const requestedJobId = input.jobId;
    if (requestedJobId !== undefined && !/^job_[0-9A-HJKMNP-TV-Z]{26}$/.test(requestedJobId)) {
      throw new DomainRuleError('Job id is not canonical.');
    }
    const jobId = requestedJobId ?? createCanonicalId('job');
    const now = new Date().toISOString();
    await this.db.transaction(async (tx) => {
      await tx.query(`insert into jobs (job_id, lead_id, signed_proposal_version, status)
        values ($1, $2, $3, 'active')`, [jobId, current.leadId, current.versionNumber]);
      const createdEventId = createCanonicalId('event');
      await tx.query(`insert into events
        (event_id, schema_version, event_type, occurred_at, actor, lead_id, job_id,
         correlation_id, idempotency_key, payload)
        values ($1, 1, 'job.created', $2, $3::jsonb, $4, $5, $1, $6,
          jsonb_build_object('createdFromLeadId', $4::text, 'signedProposalVersionId', $7::text))`,
        [createdEventId, now, JSON.stringify(actor), current.leadId, jobId,
          `${baseKey}:job.created`, current.proposalVersionId]);
      await tx.query(`update proposal_versions set status = 'signed', signed_at = $1, job_id = $2
        where proposal_version_id = $3 and status = 'issued'`, [now, jobId, current.proposalVersionId]);
      const signedEventId = createCanonicalId('event');
      await tx.query(`insert into events
        (event_id, schema_version, event_type, occurred_at, actor, lead_id, job_id,
         correlation_id, causation_event_id, idempotency_key, payload)
        values ($1, 1, 'proposal.signed', $2, $3::jsonb, $4, $5, $1, $6, $7,
          jsonb_build_object('proposalVersionId', $8::text, 'signedAt', $2::timestamptz))`,
        [signedEventId, now, JSON.stringify(actor), current.leadId, jobId, createdEventId,
          `${baseKey}:proposal.signed`, current.proposalVersionId]);
      await tx.query('update takeoff_revisions set job_id = $1 where revision_id = $2',
        [jobId, current.takeoffRevisionId]);
      await tx.query('update jobs set current_takeoff_revision_id = $1 where job_id = $2',
        [current.takeoffRevisionId, jobId]);
      await tx.query(`insert into projects (job_id, current_phase_key, created_by)
        values ($1, 'design-permitting', $2)`, [jobId, actor.userId]);
      const projectEventId = createCanonicalId('event');
      await tx.query(`insert into events
        (event_id, schema_version, event_type, occurred_at, actor, lead_id, job_id,
         correlation_id, idempotency_key, payload)
        values ($1, 1, 'project.created', $2, $3::jsonb, $4, $5, $1, $6,
          jsonb_build_object('initialPhaseKey', 'design-permitting', 'superintendentUserId', null))`,
        [projectEventId, now, JSON.stringify(actor), current.leadId, jobId, `${baseKey}:project.created`]);
      await tx.query(`insert into project_phase_transitions
        (job_id, from_phase_key, to_phase_key, occurred_at, actor_user_id, reason, source_event_id)
        values ($1, null, 'design-permitting', $2, $3, null, $4)`,
        [jobId, now, actor.userId, projectEventId]);
      await tx.query(`update leads set status = 'signed', updated_at = $1 where lead_id = $2`, [now, current.leadId]);
    });
    const proposal = await this.getProposalVersion(input.proposalVersionId);
    if (!proposal) throw new Error('Signed Proposal disappeared.');
    return { proposal, jobId, projectId: jobId };
  }
}
