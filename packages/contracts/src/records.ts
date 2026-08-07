import { z } from 'zod';
import { idSchemas } from './ids.js';
import { calculateQuantityPayloadSha256 } from './quantityDigest.js';

/**
 * `superintendent` was added 2026-07-31 for the confirmed authority model in
 * `docs/decisions/construction-model.md`: two roles pass Gates, and the four
 * draw-bearing Gates are the owner's alone. `admin` is the owner (Travis);
 * `superintendent` is PRD §5.2's Project Manager / Superintendent, which the
 * original four-role model had no seat for and was collapsing into `field`.
 */
export const AppRoleSchema = z.enum(['admin', 'office', 'superintendent', 'field', 'customer']);
export type AppRole = z.infer<typeof AppRoleSchema>;

/** Roles that see internal operational state. Customers are excluded by construction. */
export const STAFF_ROLES = ['admin', 'office', 'superintendent', 'field'] as const satisfies readonly AppRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Roles that may sign off a Gate release. Which of them may sign off *which* Gate is per-definition. */
export const GATE_RELEASE_ROLES = ['admin', 'superintendent', 'field'] as const satisfies readonly AppRole[];
export const GateReleaseRoleSchema = z.enum(GATE_RELEASE_ROLES);
export type GateReleaseRole = (typeof GATE_RELEASE_ROLES)[number];

export const EvidenceKindSchema = z.enum(['photo', 'video', 'document', 'measurement', 'inspection']);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceRecordSchema = z.strictObject({
  evidenceId: idSchemas.evidence,
  jobId: idSchemas.job,
  gateInstanceId: idSchemas.gate,
  requirementKey: z.string().min(1).max(120),
  kind: EvidenceKindSchema,
  storageKey: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.string().datetime({ offset: true }),
  capturedBy: idSchemas.user,
  mimeType: z.string().min(1).max(120),
  byteSize: z.number().int().positive().max(250_000_000),
  caption: z.string().max(1000).optional(),
  planRevisionId: idSchemas.revision.optional(),
  detailRevision: z.string().max(80).optional(),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const GateRequirementDefinitionSchema = z.strictObject({
  key: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/).max(120),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  evidenceRequired: z.boolean(),
  acceptedEvidenceKinds: z.array(EvidenceKindSchema).min(1),
  evaluatorRoles: z.array(AppRoleSchema).min(1),
  sequence: z.number().int().nonnegative(),
});

export const GateDefinitionSchema = z.strictObject({
  definitionKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.number().int().positive(),
  title: z.string().min(1).max(200),
  phase: z.string().min(1).max(120),
  drawCode: z.string().min(1).max(80).nullable(),
  customerMilestone: z.string().min(1).max(120).nullable(),
  /**
   * Who may release this Gate. Per-definition rather than global because the
   * confirmed authority model gives the owner the four draw-bearing Gates and
   * the superintendent the three that release no money.
   */
  releaseRoles: z.array(GateReleaseRoleSchema).min(1),
  /**
   * Roles that must countersign before the Gate releases. Empty for every Gate
   * but pre-gunite, where the owner countersigns because gunite cannot be undone.
   * The countersign blocks the release rather than confirming it afterwards.
   */
  countersignRoles: z.array(GateReleaseRoleSchema),
  requirements: z.array(GateRequirementDefinitionSchema).min(1),
  active: z.boolean(),
});
export type GateDefinition = z.infer<typeof GateDefinitionSchema>;

export const TakeoffRevisionSchema = z.strictObject({
  revisionId: idSchemas.revision,
  leadId: idSchemas.lead,
  jobId: idSchemas.job.nullable(),
  revisionNumber: z.number().int().positive(),
  status: z.enum(['draft', 'approved', 'superseded']),
  engineVersion: z.string().min(1).max(80),
  jobInputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  calcLedgerSha256: z.string().regex(/^[a-f0-9]{64}$/),
  quantityPayloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  quantityModelVersion: z.string().min(1).max(80),
  createdAt: z.string().datetime({ offset: true }),
  createdBy: idSchemas.user,
  approvedAt: z.string().datetime({ offset: true }).nullable(),
  approvedBy: idSchemas.user.nullable(),
});
export type TakeoffRevision = z.infer<typeof TakeoffRevisionSchema>;

export const CalcInputSchema = z.strictObject({
  symbol: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  value: z.number(),
  unit: z.string().min(1).max(40),
});

export const CalcLedgerEntrySchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*(?:[.-][a-zA-Z0-9]+)*$/).max(160),
  label: z.string().min(1).max(200),
  formula: z.string().min(1).max(1000),
  inputs: z.array(CalcInputSchema),
  value: z.number(),
  unit: z.string().min(1).max(40),
  source: z.string().min(1).max(500).optional(),
  notes: z.array(z.string().min(1).max(1000)).optional(),
});
export type CalcLedgerEntry = z.infer<typeof CalcLedgerEntrySchema>;

export const CANONICAL_QUANTITY_CODES = [
  'pool.water-volume',
  'pool.wetted-area',
  'pool.waterline-perimeter',
  'excavation.bank-volume',
  'excavation.loose-volume',
  'excavation.spoil-haul-volume',
  'shell.gunite-ordered-volume',
  'shell.reinforcing-steel-weight',
  'shell.forming-perimeter',
  'finishes.plaster-net-area',
  'finishes.plaster-ordered-area',
  'finishes.tile-net-length',
  'finishes.tile-ordered-area',
  'finishes.coping-ordered-length',
  'yard.deck-area',
  'plumbing.developed-run-length',
  'utilities.bonding-conductor-length',
] as const;
export const AuthoritativeQuantityCodeSchema = z.enum(CANONICAL_QUANTITY_CODES);
export type AuthoritativeQuantityCode = z.infer<typeof AuthoritativeQuantityCodeSchema>;

export const AUTHORITATIVE_QUANTITY_UNITS: Readonly<Record<AuthoritativeQuantityCode, string>> = {
  'pool.water-volume': 'gal',
  'pool.wetted-area': 'sf',
  'pool.waterline-perimeter': 'ft',
  'excavation.bank-volume': 'BCY',
  'excavation.loose-volume': 'LCY',
  'excavation.spoil-haul-volume': 'LCY',
  'shell.gunite-ordered-volume': 'cy',
  'shell.reinforcing-steel-weight': 'lb',
  'shell.forming-perimeter': 'ft',
  'finishes.plaster-net-area': 'sf',
  'finishes.plaster-ordered-area': 'sf',
  'finishes.tile-net-length': 'lf',
  'finishes.tile-ordered-area': 'sf',
  'finishes.coping-ordered-length': 'lf',
  'yard.deck-area': 'sf',
  'plumbing.developed-run-length': 'lf',
  'utilities.bonding-conductor-length': 'lf',
};

export const AuthoritativeQuantitySchema = z.strictObject({
  code: AuthoritativeQuantityCodeSchema,
  value: z.number().nonnegative(),
  unit: z.string().min(1).max(40),
  calcId: CalcLedgerEntrySchema.shape.id,
});
export type AuthoritativeQuantity = z.infer<typeof AuthoritativeQuantitySchema>;

export const ApprovedTakeoffRevisionSchema = TakeoffRevisionSchema.extend({
  status: z.literal('approved'),
  approvedAt: z.string().datetime({ offset: true }),
  approvedBy: idSchemas.user,
  blockingIssues: z.array(z.never()).max(0),
  quantities: z.array(AuthoritativeQuantitySchema).min(1),
  calcLedger: z.array(CalcLedgerEntrySchema).min(1),
}).superRefine((revision, ctx) => {
  const seen = new Set<string>();
  const calcById = new Map(revision.calcLedger.map((entry) => [entry.id, entry] as const));
  revision.quantities.forEach((quantity, index) => {
    if (seen.has(quantity.code)) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantities', index, 'code'],
        message: `Duplicate authoritative quantity code: ${quantity.code}`,
      });
    }
    seen.add(quantity.code);
    const expectedUnit = AUTHORITATIVE_QUANTITY_UNITS[quantity.code];
    if (quantity.unit !== expectedUnit) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantities', index, 'unit'],
        message: `${quantity.code} must use ${expectedUnit}, received ${quantity.unit}`,
      });
    }
    const calcEntry = calcById.get(quantity.calcId);
    if (!calcEntry) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantities', index, 'calcId'],
        message: `Authoritative quantity references a missing Calc ledger entry: ${quantity.calcId}`,
      });
    } else if (calcEntry.value !== quantity.value || calcEntry.unit !== quantity.unit) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantities', index],
        message: `Authoritative quantity must equal its Calc result: ${quantity.calcId}`,
      });
    }
  });
  if (revision.quantityPayloadSha256 !== calculateQuantityPayloadSha256(revision.quantities)) {
    ctx.addIssue({
      code: 'custom',
      path: ['quantityPayloadSha256'],
      message: 'Quantity payload SHA-256 does not match the ordered authoritative quantity facts.',
    });
  }
});
export type ApprovedTakeoffRevision = z.infer<typeof ApprovedTakeoffRevisionSchema>;

/**
 * What Apex Designer hands over when a takeoff is approved.
 *
 * This is deliberately NOT `ApprovedTakeoffRevision`. The fields a submitter does
 * not get to assert are absent by construction rather than ignored on arrival:
 *
 * - **No digests.** `quantityPayloadSha256` and `calcLedgerSha256` are computed
 *   by the receiver from the bytes it actually received. A digest supplied by the
 *   caller is an assertion about evidence, not the evidence, and the entire point
 *   of the digest is that nobody has to take the sender's word for it.
 * - **No `revisionId`, `revisionNumber`, `approvedAt`, `approvedBy` or `status`.**
 *   Identity, ordering and authority are the receiver's to assign. A caller that
 *   could name its own approver could approve as somebody else.
 * - **`jobModel` is the Designer input, carried verbatim.** It is hashed into
 *   `jobInputSha256` on arrival, which is what makes that column mean "the input
 *   this system saw" rather than "a hash the sender chose".
 *
 * `quantities` and `calcLedger` are the exact shapes `exportDesignerQuantityPayload`
 * returns, so the export crosses the boundary without translation — the property
 * the cross-repository contract test exists to defend.
 */
export const DesignerTakeoffSubmissionSchema = z.strictObject({
  engineVersion: z.string().min(1).max(80),
  quantityModelVersion: z.string().min(1).max(80),
  jobModel: z.record(z.string(), z.unknown()),
  quantities: z.array(AuthoritativeQuantitySchema).min(1),
  calcLedger: z.array(CalcLedgerEntrySchema).min(1),
  /**
   * Replacing an existing approved revision must be asked for, never inferred.
   * A second approval is a different intention from a first one — it invalidates
   * pricing already derived from the revision it replaces — and the customer-link
   * rule applies here for the same reason: issuing twice is refused rather than
   * silently treated as a rotation.
   */
  supersedeExisting: z.boolean().default(false),
});
export type DesignerTakeoffSubmission = z.infer<typeof DesignerTakeoffSubmissionSchema>;

export const ProposalVersionSchema = z.strictObject({
  proposalVersionId: idSchemas.proposal_version,
  proposalId: idSchemas.proposal,
  leadId: idSchemas.lead,
  jobId: idSchemas.job.nullable(),
  versionNumber: z.number().int().positive(),
  status: z.enum(['draft', 'issued', 'signed']),
  takeoffRevisionId: idSchemas.revision,
  quantityPayloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  quantityModelVersion: z.string().min(1).max(80),
  pricingLibraryVersion: z.string().min(1).max(80),
  proposalPayloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  proposalPayload: z.record(z.string(), z.unknown()),
  totalCents: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
  createdBy: idSchemas.user,
  issuedAt: z.string().datetime({ offset: true }).nullable(),
  issuedBy: idSchemas.user.nullable(),
  signedAt: z.string().datetime({ offset: true }).nullable(),
}).superRefine((version, ctx) => {
  if (version.status === 'signed' && version.jobId === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['jobId'],
      message: 'A signed Proposal version must be bound to an existing Job.',
    });
  }
});
export type ProposalVersion = z.infer<typeof ProposalVersionSchema>;

export const JobSchema = z.strictObject({
  jobId: idSchemas.job,
  leadId: idSchemas.lead,
  signedProposalVersionId: idSchemas.proposal_version,
  status: z.enum(['active', 'on-hold', 'closed']),
  currentTakeoffRevisionId: idSchemas.revision.nullable(),
  createdFromLeadId: idSchemas.lead,
  createdAt: z.string().datetime({ offset: true }),
  createdBy: idSchemas.user,
  closedAt: z.string().datetime({ offset: true }).nullable(),
  closedBy: idSchemas.user.nullable(),
  reconciliationComplete: z.boolean().nullable(),
}).superRefine((job, ctx) => {
  if (job.status === 'closed' && (job.closedAt === null || job.closedBy === null || job.reconciliationComplete !== true)) {
    ctx.addIssue({
      code: 'custom',
      path: ['status'],
      message: 'A closed Job must record closedAt, closedBy, and a completed reconciliation.',
    });
  }
});
export type Job = z.infer<typeof JobSchema>;

export const CustomerMilestoneProjectionSchema = z.strictObject({
  projectionId: idSchemas.customer_update,
  jobId: idSchemas.job,
  milestone: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2000),
  publishedAt: z.string().datetime({ offset: true }),
  mediaUrl: z.string().url().optional(),
});
export type CustomerMilestoneProjection = z.infer<typeof CustomerMilestoneProjectionSchema>;
