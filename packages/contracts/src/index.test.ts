import { describe, expect, it } from 'vitest';
import {
  ApprovedTakeoffRevisionSchema,
  ApexEventSchema,
  CANONICAL_EVENT_TYPES,
  CustomerMilestoneProjectionSchema,
  EvidenceRecordSchema,
  JobSchema,
  ProposalVersionSchema,
  calculateQuantityPayloadSha256,
  serializeQuantityPayload,
  createCanonicalId,
  idSchemas,
} from './index.js';

const actorId = createCanonicalId('user');
const leadId = createCanonicalId('lead');
const proposalId = createCanonicalId('proposal');
const proposalVersionId = createCanonicalId('proposal_version');
const jobId = createCanonicalId('job');
const gateInstanceId = createCanonicalId('gate');
const eventId = createCanonicalId('event');

const baseEvent = {
  schemaVersion: 1 as const,
  eventId,
  occurredAt: '2026-07-29T12:00:00.000Z',
  recordedAt: '2026-07-29T12:00:00.000Z',
  actor: { kind: 'user' as const, userId: actorId, role: 'field' as const },
  leadId,
  jobId,
  correlationId: createCanonicalId('event'),
  idempotencyKey: 'test:canonical-event:0001',
};

describe('canonical identifiers', () => {
  it.each(['lead', 'proposal', 'proposal_version', 'job', 'event', 'revision', 'gate', 'evidence', 'user', 'draw', 'customer_update'] as const)(
    'mints and validates %s IDs',
    (kind) => {
      const id = createCanonicalId(kind);
      expect(idSchemas[kind].parse(id)).toBe(id);
      expect(id).toMatch(new RegExp(`^${kind}_[0-9A-HJKMNP-TV-Z]{26}$`));
    },
  );

  it('refuses a valid ULID carried under the wrong identity namespace', () => {
    expect(idSchemas.job.safeParse(createCanonicalId('lead')).success).toBe(false);
  });
});

const approvedRevisionFixture = () => ({
  revisionId: createCanonicalId('revision'),
  leadId,
  jobId,
  revisionNumber: 1,
  status: 'approved' as const,
  engineVersion: 'designer-0.1.0',
  jobInputSha256: 'a'.repeat(64),
  calcLedgerSha256: 'b'.repeat(64),
  quantityPayloadSha256: '64a55c9b111bcacea62601aa6a93626a8b0717063ff402d3bb3be62bca99c50d',
  quantityModelVersion: 'designer-quantity-v1',
  createdAt: '2026-07-29T12:00:00.000Z',
  createdBy: actorId,
  approvedAt: '2026-07-29T12:05:00.000Z',
  approvedBy: actorId,
  blockingIssues: [],
  quantities: [
    {
      code: 'pool.water-volume',
      value: 12881,
      unit: 'gal',
      calcId: 'geom.total.volumeGal',
    },
  ],
  calcLedger: [
    {
      id: 'geom.total.volumeGal',
      label: 'Total water volume',
      formula: 'V_gal = V_cf x 7.48052',
      inputs: [
        { symbol: 'V_cf', label: 'Total water volume', value: 1721.94, unit: 'cf' },
        { symbol: 'k', label: 'US gallons per cubic foot', value: 7.48052, unit: 'gal/cf' },
      ],
      value: 12881,
      unit: 'gal',
      notes: ['Root input for downstream quantity calculations.'],
    },
  ],
});

describe('approved Designer quantity revisions', () => {
  it('allows approved Designer authority to belong to a Lead before a Job exists', () => {
    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...approvedRevisionFixture(),
      leadId,
      jobId: null,
    }).success).toBe(true);
  });

  it('uses one domain-separated, order-sensitive canonical quantity serialization', () => {
    const quantities = approvedRevisionFixture().quantities;
    expect(serializeQuantityPayload(quantities)).toBe(
      '{"schema":"apex-approved-quantity-payload-v1","quantities":[["pool.water-volume",12881,"gal","geom.total.volumeGal"]]}',
    );
    expect(calculateQuantityPayloadSha256(quantities)).toBe(
      '64a55c9b111bcacea62601aa6a93626a8b0717063ff402d3bb3be62bca99c50d',
    );
  });

  it('refuses non-finite and negative values before canonical serialization', () => {
    const quantity = approvedRevisionFixture().quantities[0]!;
    expect(() => calculateQuantityPayloadSha256([{ ...quantity, value: Number.POSITIVE_INFINITY }])).toThrow(
      /finite non-negative/i,
    );
    expect(() => calculateQuantityPayloadSha256([{ ...quantity, value: -1 }])).toThrow(/finite non-negative/i);
  });

  it('accepts an approved revision only when every authoritative quantity preserves Calc provenance', () => {
    const approved = ApprovedTakeoffRevisionSchema.parse(approvedRevisionFixture());

    expect(approved.status).toBe('approved');
    expect(approved.quantities[0]?.calcId).toBe('geom.total.volumeGal');
  });

  it('rejects an approved revision whose stored quantity digest does not match its ordered facts', () => {
    const revision = approvedRevisionFixture();
    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantityPayloadSha256: 'c'.repeat(64),
    }).success).toBe(false);
  });

  it('detects reordered, omitted, and provenance-consistent substituted quantity facts', () => {
    const base = approvedRevisionFixture();
    const secondQuantity = {
      code: 'pool.waterline-perimeter' as const,
      value: 100,
      unit: 'ft',
      calcId: 'geom.total.waterlinePerimeter',
    };
    const secondCalc = {
      id: secondQuantity.calcId,
      label: 'Total waterline perimeter',
      formula: 'P = P_pool + P_spa',
      inputs: [],
      value: secondQuantity.value,
      unit: secondQuantity.unit,
    };
    const quantities = [...base.quantities, secondQuantity];
    const revision = {
      ...base,
      quantities,
      calcLedger: [...base.calcLedger, secondCalc],
      quantityPayloadSha256: calculateQuantityPayloadSha256(quantities),
    };
    expect(ApprovedTakeoffRevisionSchema.safeParse(revision).success).toBe(true);
    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: [...revision.quantities].reverse(),
    }).success).toBe(false);
    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: revision.quantities.slice(0, 1),
    }).success).toBe(false);
    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: [revision.quantities[0]!, { ...secondQuantity, value: 101 }],
      calcLedger: [base.calcLedger[0]!, { ...secondCalc, value: 101 }],
    }).success).toBe(false);
  });

  it('rejects duplicate authoritative quantity codes', () => {
    const revision = approvedRevisionFixture();
    const duplicate = revision.quantities[0]!;

    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: [duplicate, { ...duplicate }],
    }).success).toBe(false);
  });

  it('rejects an authoritative quantity that is not backed by its referenced Calc ledger entry', () => {
    const revision = approvedRevisionFixture();

    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: [{ ...revision.quantities[0]!, calcId: 'geom.unrecorded.value' }],
    }).success).toBe(false);
  });

  it('rejects quantity codes outside the canonical Designer vocabulary', () => {
    const revision = approvedRevisionFixture();

    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: [{ ...revision.quantities[0]!, code: 'proposal.magic-number' }],
    }).success).toBe(false);
  });

  it('rejects an authoritative quantity whose unit does not match its canonical code', () => {
    const revision = approvedRevisionFixture();

    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: [{ ...revision.quantities[0]!, unit: 'sf' }],
    }).success).toBe(false);
  });

  it('rejects an authoritative value that differs from its referenced Calc result', () => {
    const revision = approvedRevisionFixture();

    expect(ApprovedTakeoffRevisionSchema.safeParse({
      ...revision,
      quantities: [{ ...revision.quantities[0]!, value: 99999 }],
    }).success).toBe(false);
  });
});

const issuedProposalVersionFixture = () => ({
  proposalVersionId,
  proposalId,
  leadId,
  jobId: null,
  versionNumber: 1,
  status: 'issued' as const,
  takeoffRevisionId: approvedRevisionFixture().revisionId,
  quantityPayloadSha256: approvedRevisionFixture().quantityPayloadSha256,
  quantityModelVersion: approvedRevisionFixture().quantityModelVersion,
  pricingLibraryVersion: 'proposal-pricing-v1',
  proposalPayloadSha256: 'd'.repeat(64),
  proposalPayload: { status: 'issued', totals: { totalCents: 15204173 } },
  totalCents: 15204173,
  createdAt: '2026-07-29T12:00:00.000Z',
  createdBy: actorId,
  issuedAt: '2026-07-29T12:05:00.000Z',
  issuedBy: actorId,
  signedAt: null,
});

describe('durable Proposal versions', () => {
  it('accepts an issued Proposal version owned by a Lead before a Job exists', () => {
    const issued = ProposalVersionSchema.parse(issuedProposalVersionFixture());
    expect(issued.leadId).toBe(leadId);
    expect(issued.jobId).toBeNull();
  });

  it('rejects a signed Proposal version until it is bound to the minted Job', () => {
    expect(ProposalVersionSchema.safeParse({
      ...issuedProposalVersionFixture(),
      status: 'signed',
      signedAt: '2026-07-29T12:10:00.000Z',
      jobId: null,
    }).success).toBe(false);
  });

  it('accepts a signed Proposal version once it is bound to a Job', () => {
    expect(ProposalVersionSchema.safeParse({
      ...issuedProposalVersionFixture(),
      status: 'signed',
      signedAt: '2026-07-29T12:10:00.000Z',
      jobId,
    }).success).toBe(true);
  });

  it('emits proposal.signed event only when Job ID is minted and bound', () => {
    const signedEvent = ApexEventSchema.parse({
      ...baseEvent,
      eventType: 'proposal.signed',
      leadId,
      jobId,
      payload: {
        proposalVersionId,
        signedAt: '2026-07-29T12:10:00.000Z',
      },
    });
    expect(signedEvent.eventType).toBe('proposal.signed');
    expect(signedEvent.jobId).toBe(jobId);
    expect(signedEvent.leadId).toBe(leadId);
    expect(signedEvent.payload).toMatchObject({ proposalVersionId });
  });

  it('rejects proposal.signed event without a Job ID', () => {
    expect(ApexEventSchema.safeParse({
      ...baseEvent,
      eventType: 'proposal.signed',
      leadId,
      jobId: undefined,
      payload: {
        proposalVersionId,
        signedAt: '2026-07-29T12:10:00.000Z',
      },
    }).success).toBe(false);
  });
});

describe('Job contract', () => {
  it('accepts a Job bound to the signed Proposal version', () => {
    const job = JobSchema.parse({
      jobId,
      leadId,
      signedProposalVersionId: proposalVersionId,
      status: 'active',
      currentTakeoffRevisionId: null,
      createdFromLeadId: leadId,
      createdAt: '2026-07-29T12:10:00.000Z',
      createdBy: actorId,
      closedAt: null,
      closedBy: null,
      reconciliationComplete: null,
    });
    expect(job.signedProposalVersionId).toBe(proposalVersionId);
    expect(job.leadId).toBe(leadId);
  });

  it('rejects a closed Job without closure metadata or reconciliation', () => {
    expect(JobSchema.safeParse({
      jobId,
      leadId,
      signedProposalVersionId: proposalVersionId,
      status: 'closed',
      currentTakeoffRevisionId: null,
      createdFromLeadId: leadId,
      createdAt: '2026-07-29T12:10:00.000Z',
      createdBy: actorId,
      closedAt: null,
      closedBy: null,
      reconciliationComplete: null,
    }).success).toBe(false);
  });

  it('accepts a fully closed Job and pins its approved revision pointer', () => {
    const revision = approvedRevisionFixture();
    const job = JobSchema.parse({
      jobId,
      leadId,
      signedProposalVersionId: proposalVersionId,
      status: 'closed',
      currentTakeoffRevisionId: revision.revisionId,
      createdFromLeadId: leadId,
      createdAt: '2026-07-29T12:10:00.000Z',
      createdBy: actorId,
      closedAt: '2026-07-30T08:00:00.000Z',
      closedBy: actorId,
      reconciliationComplete: true,
    });
    expect(job.status).toBe('closed');
    expect(job.currentTakeoffRevisionId).toBe(revision.revisionId);
  });
});

describe('event vocabulary', () => {
  it('has one stable, duplicate-free canonical vocabulary', () => {
    expect(new Set(CANONICAL_EVENT_TYPES).size).toBe(CANONICAL_EVENT_TYPES.length);
    expect(CANONICAL_EVENT_TYPES).toContain('gate.released');
    expect(CANONICAL_EVENT_TYPES).toContain('draw.eligible');
    expect(CANONICAL_EVENT_TYPES).toContain('customer_update.published');
  });

  it('pins both Calc and ordered quantity digests in the takeoff approval event', () => {
    const parsed = ApexEventSchema.parse({
      ...baseEvent,
      eventType: 'takeoff_revision.approved',
      payload: {
        revisionId: createCanonicalId('revision'),
        approvedBy: actorId,
        calcLedgerSha256: 'b'.repeat(64),
        quantityPayloadSha256: 'c'.repeat(64),
      },
    });
    expect(parsed.payload).toMatchObject({
      calcLedgerSha256: 'b'.repeat(64),
      quantityPayloadSha256: 'c'.repeat(64),
    });
  });

  it('parses a Gate release with the authority and revision linkage needed for audit', () => {
    const parsed = ApexEventSchema.parse({
      ...baseEvent,
      eventType: 'gate.released',
      payload: {
        gateInstanceId,
        definitionVersion: 1,
        takeoffRevisionId: createCanonicalId('revision'),
        releasedBy: actorId,
        releasedByRole: 'field',
        evidenceIds: [createCanonicalId('evidence')],
      },
    });
    expect(parsed.eventType).toBe('gate.released');
  });

  it('pins canonical proposal and Job binding identifiers in creation and signing events', () => {
    const createdEvent = ApexEventSchema.parse({
      ...baseEvent,
      eventType: 'job.created',
      leadId,
      jobId,
      payload: {
        createdFromLeadId: leadId,
        signedProposalVersionId: proposalVersionId,
      },
    });
    expect(createdEvent.payload).toMatchObject({
      createdFromLeadId: leadId,
      signedProposalVersionId: proposalVersionId,
    });

    const signedEvent = ApexEventSchema.parse({
      ...baseEvent,
      eventType: 'proposal.signed',
      leadId,
      jobId,
      payload: {
        proposalVersionId,
        signedAt: '2026-07-29T12:10:00.000Z',
      },
    });
    expect(signedEvent.payload).toMatchObject({ proposalVersionId });
  });

  it('rejects an event payload that does not match its event type', () => {
    const parsed = ApexEventSchema.safeParse({
      ...baseEvent,
      eventType: 'gate.released',
      payload: { gateInstanceId },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('evidence and customer projection boundaries', () => {
  it('keeps evidence metadata separate from requirement pass/fail state', () => {
    const evidence = {
      evidenceId: createCanonicalId('evidence'),
      jobId,
      gateInstanceId,
      requirementKey: 'pre-gunite.steel-spacing',
      kind: 'photo',
      storageKey: `${jobId}/pre-gunite/steel.jpg`,
      sha256: 'a'.repeat(64),
      capturedAt: '2026-07-29T12:00:00.000Z',
      capturedBy: actorId,
      mimeType: 'image/jpeg',
      byteSize: 128000,
    };
    expect(EvidenceRecordSchema.parse(evidence).evidenceId).toBe(evidence.evidenceId);
    expect(EvidenceRecordSchema.safeParse({ ...evidence, passed: true }).success).toBe(false);
  });

  it('customer milestone projection refuses internal notes, margins, and evidence storage keys', () => {
    const publicMilestone = {
      projectionId: createCanonicalId('customer_update'),
      jobId,
      milestone: 'pre-gunite-released',
      title: 'Pre-gunite inspection complete',
      summary: 'Your project is cleared for the next construction phase.',
      publishedAt: '2026-07-29T12:00:00.000Z',
    };
    expect(CustomerMilestoneProjectionSchema.parse(publicMilestone).milestone).toBe('pre-gunite-released');
    expect(CustomerMilestoneProjectionSchema.safeParse({ ...publicMilestone, internalMargin: 0.23 }).success).toBe(false);
    expect(CustomerMilestoneProjectionSchema.safeParse({ ...publicMilestone, storageKey: 'private/path.jpg' }).success).toBe(false);
  });
});
