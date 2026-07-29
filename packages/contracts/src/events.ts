import { z } from 'zod';
import { idSchemas } from './ids.js';
import { AppRoleSchema, EvidenceKindSchema } from './records.js';

export const CANONICAL_EVENT_TYPES = [
  'lead.received',
  'proposal.drafted',
  'proposal.issued',
  'proposal.signed',
  'job.created',
  'takeoff_revision.created',
  'takeoff_revision.approved',
  'takeoff_revision.superseded',
  'gate.started',
  'evidence.added',
  'requirement.passed',
  'requirement.failed',
  'gate.blocked',
  'gate.released',
  'override.requested',
  'override.approved',
  'override.rejected',
  'draw.eligible',
  'quickbooks_sync.requested',
  'quickbooks_sync.succeeded',
  'quickbooks_sync.failed',
  'customer_update.published',
  'job.closed',
] as const;

export const EventActorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('user'), userId: idSchemas.user, role: AppRoleSchema }),
  z.strictObject({ kind: z.literal('system'), system: z.enum(['lead-engine', 'gate-api', 'quickbooks-adapter', 'customer-projection']) }),
]);
export type EventActor = z.infer<typeof EventActorSchema>;

const base = {
  schemaVersion: z.literal(1),
  eventId: idSchemas.event,
  occurredAt: z.string().datetime({ offset: true }),
  recordedAt: z.string().datetime({ offset: true }),
  actor: EventActorSchema,
  leadId: idSchemas.lead.optional(),
  correlationId: idSchemas.event,
  causationEventId: idSchemas.event.optional(),
  idempotencyKey: z.string().min(8).max(160),
};

const jobEvent = <Type extends (typeof CANONICAL_EVENT_TYPES)[number], Payload extends z.ZodType>(
  eventType: Type,
  payload: Payload,
) => z.strictObject({ ...base, jobId: idSchemas.job, eventType: z.literal(eventType), payload });

const leadEvent = <Type extends (typeof CANONICAL_EVENT_TYPES)[number], Payload extends z.ZodType>(
  eventType: Type,
  payload: Payload,
) => z.strictObject({ ...base, leadId: idSchemas.lead, jobId: idSchemas.job.optional(), eventType: z.literal(eventType), payload });

const gateRef = {
  gateInstanceId: idSchemas.gate,
  definitionVersion: z.number().int().positive(),
};
const requirementRef = { ...gateRef, requirementKey: z.string().min(1).max(120) };

export const ApexEventSchema = z.discriminatedUnion('eventType', [
  leadEvent('lead.received', z.strictObject({ source: z.string().min(1).max(80), acceptedPayloadVersion: z.number().int().positive() })),
  leadEvent('proposal.drafted', z.strictObject({ proposalVersion: z.number().int().positive(), takeoffRevisionId: idSchemas.revision.nullable() })),
  leadEvent('proposal.issued', z.strictObject({ proposalVersion: z.number().int().positive(), issuedBy: idSchemas.user, totalCents: z.number().int().nonnegative() })),
  leadEvent('proposal.signed', z.strictObject({ proposalVersion: z.number().int().positive(), signedAt: z.string().datetime({ offset: true }) })),
  jobEvent('job.created', z.strictObject({ createdFromLeadId: idSchemas.lead, signedProposalVersion: z.number().int().positive() })),
  jobEvent('takeoff_revision.created', z.strictObject({ revisionId: idSchemas.revision, revisionNumber: z.number().int().positive(), engineVersion: z.string().min(1) })),
  jobEvent('takeoff_revision.approved', z.strictObject({ revisionId: idSchemas.revision, approvedBy: idSchemas.user, calcLedgerSha256: z.string().regex(/^[a-f0-9]{64}$/) })),
  jobEvent('takeoff_revision.superseded', z.strictObject({ revisionId: idSchemas.revision, supersededByRevisionId: idSchemas.revision })),
  jobEvent('gate.started', z.strictObject({ ...gateRef, takeoffRevisionId: idSchemas.revision })),
  jobEvent('evidence.added', z.strictObject({ ...requirementRef, evidenceId: idSchemas.evidence, kind: EvidenceKindSchema })),
  jobEvent('requirement.passed', z.strictObject({ ...requirementRef, evaluatedBy: idSchemas.user, evidenceIds: z.array(idSchemas.evidence), note: z.string().max(2000).optional() })),
  jobEvent('requirement.failed', z.strictObject({ ...requirementRef, evaluatedBy: idSchemas.user, evidenceIds: z.array(idSchemas.evidence), reason: z.string().min(1).max(2000) })),
  jobEvent('gate.blocked', z.strictObject({ ...gateRef, blockedRequirementKeys: z.array(z.string().min(1)).min(1), reason: z.string().min(1).max(2000) })),
  jobEvent('gate.released', z.strictObject({ ...gateRef, takeoffRevisionId: idSchemas.revision, releasedBy: idSchemas.user, releasedByRole: z.enum(['admin', 'field']), evidenceIds: z.array(idSchemas.evidence) })),
  jobEvent('override.requested', z.strictObject({ ...requirementRef, requestedBy: idSchemas.user, reason: z.string().min(1).max(2000) })),
  jobEvent('override.approved', z.strictObject({ ...requirementRef, approvedBy: idSchemas.user, reason: z.string().min(1).max(2000) })),
  jobEvent('override.rejected', z.strictObject({ ...requirementRef, rejectedBy: idSchemas.user, reason: z.string().min(1).max(2000) })),
  jobEvent('draw.eligible', z.strictObject({ drawId: idSchemas.draw, sourceGateInstanceId: idSchemas.gate, amountCents: z.number().int().nonnegative().nullable() })),
  jobEvent('quickbooks_sync.requested', z.strictObject({ operation: z.enum(['customer', 'estimate', 'invoice', 'payment', 'cost']), externalId: z.string().max(160).nullable() })),
  jobEvent('quickbooks_sync.succeeded', z.strictObject({ operation: z.enum(['customer', 'estimate', 'invoice', 'payment', 'cost']), quickbooksId: z.string().min(1).max(160) })),
  jobEvent('quickbooks_sync.failed', z.strictObject({ operation: z.enum(['customer', 'estimate', 'invoice', 'payment', 'cost']), errorCode: z.string().min(1).max(120), retryable: z.boolean() })),
  jobEvent('customer_update.published', z.strictObject({ projectionId: idSchemas.customer_update, milestone: z.string().min(1).max(120), publishedBy: idSchemas.user })),
  jobEvent('job.closed', z.strictObject({ closedBy: idSchemas.user, reconciliationComplete: z.literal(true) })),
]);

export type ApexEvent = z.infer<typeof ApexEventSchema>;
export type ApexEventType = ApexEvent['eventType'];
