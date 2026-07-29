import { describe, expect, it } from 'vitest';
import {
  ApprovedTakeoffRevisionSchema,
  ApexEventSchema,
  CANONICAL_EVENT_TYPES,
  CustomerMilestoneProjectionSchema,
  EvidenceRecordSchema,
  createCanonicalId,
  idSchemas,
} from './index.js';

const actorId = createCanonicalId('user');
const leadId = createCanonicalId('lead');
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
  it.each(['lead', 'job', 'event', 'revision', 'gate', 'evidence', 'user', 'draw', 'customer_update'] as const)(
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
  jobId,
  revisionNumber: 1,
  status: 'approved' as const,
  engineVersion: 'designer-0.1.0',
  jobInputSha256: 'a'.repeat(64),
  calcLedgerSha256: 'b'.repeat(64),
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
  it('accepts an approved revision only when every authoritative quantity preserves Calc provenance', () => {
    const approved = ApprovedTakeoffRevisionSchema.parse(approvedRevisionFixture());

    expect(approved.status).toBe('approved');
    expect(approved.quantities[0]?.calcId).toBe('geom.total.volumeGal');
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

describe('event vocabulary', () => {
  it('has one stable, duplicate-free canonical vocabulary', () => {
    expect(new Set(CANONICAL_EVENT_TYPES).size).toBe(CANONICAL_EVENT_TYPES.length);
    expect(CANONICAL_EVENT_TYPES).toContain('gate.released');
    expect(CANONICAL_EVENT_TYPES).toContain('draw.eligible');
    expect(CANONICAL_EVENT_TYPES).toContain('customer_update.published');
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
