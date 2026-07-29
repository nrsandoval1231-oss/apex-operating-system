import { z } from 'zod';
import { idSchemas } from './ids.js';

export const AppRoleSchema = z.enum(['admin', 'office', 'field', 'customer']);
export type AppRole = z.infer<typeof AppRoleSchema>;

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
  requirements: z.array(GateRequirementDefinitionSchema).min(1),
  active: z.boolean(),
});
export type GateDefinition = z.infer<typeof GateDefinitionSchema>;

export const TakeoffRevisionSchema = z.strictObject({
  revisionId: idSchemas.revision,
  jobId: idSchemas.job,
  revisionNumber: z.number().int().positive(),
  status: z.enum(['draft', 'approved', 'superseded']),
  engineVersion: z.string().min(1).max(80),
  jobInputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  calcLedgerSha256: z.string().regex(/^[a-f0-9]{64}$/),
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
});
export type ApprovedTakeoffRevision = z.infer<typeof ApprovedTakeoffRevisionSchema>;

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
