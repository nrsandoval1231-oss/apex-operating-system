import { z } from 'zod';
import { idSchemas } from './ids.js';

export const AppRoleSchema = z.enum(['admin', 'office', 'field', 'customer']);
export type AppRole = z.infer<typeof AppRoleSchema>;

export const EvidenceKindSchema = z.enum(['photo', 'video', 'document', 'measurement', 'inspection']);

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
