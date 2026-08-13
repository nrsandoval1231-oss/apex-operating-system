import { z } from 'zod';
import { idSchemas } from './ids.js';
import { ConstructionPhaseKeySchema, CustomerMilestoneKeySchema } from './project.js';

/**
 * Operational read model for the Apex OS project list and Today feed.
 *
 * A projection over `jobs`, `leads`, `proposal_versions`, `projects`, and
 * `gate_instances`. Nothing here invents a fact the database does not already
 * hold: every optional field is nullable rather than defaulted, and `project` is
 * null on a job that has not been opened as a construction project yet.
 */

/**
 * Job lifecycle values accepted by both the `jobs` table and canonical contracts.
 */
export const JobLifecycleStatusSchema = z.enum([
  'active',
  'on-hold',
  'complete',
  'closed',
  'cancelled',
]);
export type JobLifecycleStatus = z.infer<typeof JobLifecycleStatusSchema>;

export const GateInstanceStatusSchema = z.enum([
  'not-started',
  'in-progress',
  'blocked',
  /** Signed by its first authority, waiting on the countersign that releases it. */
  'awaiting-countersign',
  'released',
]);
export type GateInstanceStatus = z.infer<typeof GateInstanceStatusSchema>;

export const JobSummaryGateSchema = z.strictObject({
  gateInstanceId: idSchemas.gate,
  definitionKey: z.string().min(1).max(120),
  definitionVersion: z.number().int().positive(),
  title: z.string().min(1).max(200),
  phase: z.string().min(1).max(120),
  status: GateInstanceStatusSchema,
  customerMilestone: z.string().min(1).max(120).nullable(),
});
export type JobSummaryGate = z.infer<typeof JobSummaryGateSchema>;

/**
 * The §9.3 project facts carried on the summary. Null on a job that has no
 * project record yet — a signed job is not automatically a job under
 * construction, and the feed must not imply it is.
 */
export const JobSummaryProjectSchema = z.strictObject({
  currentPhaseKey: ConstructionPhaseKeySchema,
  currentPhaseTitle: z.string().min(1).max(200),
  currentPhaseSequence: z.number().int().min(1).max(11),
  customerMilestone: CustomerMilestoneKeySchema,
  superintendentUserId: idSchemas.user.nullable(),
  superintendentName: z.string().min(1).max(200).nullable(),
  targetCompletionStart: z.string().date().nullable(),
  targetCompletionEnd: z.string().date().nullable(),
  riskNote: z.string().max(2000).nullable(),
});
export type JobSummaryProject = z.infer<typeof JobSummaryProjectSchema>;

/** Immutable operational facts checked when a completed job is archived. */
export const JobCloseoutSchema = z.strictObject({
  finalPhaseComplete: z.boolean(),
  gates: z.strictObject({
    released: z.number().int().nonnegative(),
    required: z.number().int().nonnegative(),
    complete: z.boolean(),
  }),
  inspections: z.strictObject({
    cleared: z.number().int().nonnegative(),
    required: z.number().int().nonnegative(),
    complete: z.boolean(),
  }),
  draws: z.strictObject({
    invoiced: z.number().int().nonnegative(),
    required: z.number().int().nonnegative(),
    complete: z.boolean(),
  }),
  customerHandoverComplete: z.boolean(),
  ready: z.boolean(),
  closedAt: z.string().datetime({ offset: true }).nullable(),
  closedByUserId: idSchemas.user.nullable(),
  closedByName: z.string().min(1).max(200).nullable(),
});
export type JobCloseout = z.infer<typeof JobCloseoutSchema>;

export const JobSummarySchema = z.strictObject({
  jobId: idSchemas.job,
  leadId: idSchemas.lead,
  status: JobLifecycleStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  /** Read from the lead's accepted payload; null when the payload carries no usable name. */
  customerName: z.string().min(1).max(200).nullable(),
  /** Read from the lead's accepted payload; null when the payload carries no usable address. */
  addressLine: z.string().min(1).max(300).nullable(),
  /** Signed proposal total. Null until a proposal version is signed and bound. */
  contractCents: z.number().int().nonnegative().nullable(),
  /**
   * The job's approved Designer takeoff revision. Null until one is approved.
   * A Gate cannot open without it. There is at most one per job, enforced by a
   * unique index rather than by convention.
   */
  approvedTakeoffRevisionId: idSchemas.revision.nullable(),
  /** Stable identity of the signed proposal retained with historical records. */
  proposalId: idSchemas.proposal.nullable(),
  /** Most recent unreleased Gate, else the most recent released Gate, else null. */
  currentGate: JobSummaryGateSchema.nullable(),
  /** §9.3 project record. Null until the job is opened as a construction project. */
  project: JobSummaryProjectSchema.nullable(),
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

export const JobSummaryListSchema = z.array(JobSummarySchema);

/**
 * One row of a job's Gate plan: the template, and this job's instance of it when
 * one exists. A null `gateInstanceId` means the Gate has not been opened — never
 * that it was skipped or passed.
 */
export const JobGatePlanEntrySchema = z.strictObject({
  definitionKey: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  sequence: z.number().int().positive().nullable(),
  phaseKey: ConstructionPhaseKeySchema.nullable(),
  /** Set on the four draw-bearing Gates only. */
  drawCode: z.string().min(1).max(80).nullable(),
  requiresCountersign: z.boolean(),
  gateInstanceId: idSchemas.gate.nullable(),
  status: GateInstanceStatusSchema.nullable(),
});
export type JobGatePlanEntry = z.infer<typeof JobGatePlanEntrySchema>;
export const JobGatePlanSchema = z.array(JobGatePlanEntrySchema);

const MAX_NAME = 200;
const MAX_ADDRESS = 300;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length === 0 ? null : trimmed;
};

const firstText = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const text = asText(source[key]);
    if (text !== null) return text;
  }
  return null;
};

const clamp = (value: string, limit: number): string =>
  value.length <= limit ? value : value.slice(0, limit).trimEnd();

const NAME_KEYS = ['customerName', 'customer_name', 'fullName', 'full_name', 'name'] as const;
const FIRST_NAME_KEYS = ['firstName', 'first_name', 'givenName', 'given_name'] as const;
const LAST_NAME_KEYS = ['lastName', 'last_name', 'familyName', 'family_name', 'surname'] as const;
const STREET_KEYS = [
  'addressLine1', 'address_line_1', 'address1', 'address_1',
  'streetAddress', 'street_address', 'street',
  'propertyAddress', 'property_address',
] as const;
const CITY_KEYS = ['city', 'locality', 'town'] as const;
const REGION_KEYS = ['state', 'region', 'province'] as const;
const POSTAL_KEYS = ['postalCode', 'postal_code', 'zip', 'zipCode', 'zip_code'] as const;

/**
 * Extract a display name and address from a website lead's accepted payload.
 *
 * The payload is free-form JSON supplied by the n8n intake, so this reads a
 * fixed list of known key spellings and returns null rather than guessing.
 * Pure and total: any input, including malformed ones, yields nulls.
 */
export const readLeadIdentity = (payload: unknown): {
  customerName: string | null;
  addressLine: string | null;
} => {
  const source = asRecord(payload);
  if (!source) return { customerName: null, addressLine: null };

  let customerName = firstText(source, NAME_KEYS);
  if (customerName === null) {
    const first = firstText(source, FIRST_NAME_KEYS);
    const last = firstText(source, LAST_NAME_KEYS);
    const joined = [first, last].filter((part): part is string => part !== null).join(' ');
    customerName = joined.length === 0 ? null : joined;
  }

  // The address may be flat on the payload or nested under an `address` object.
  const nested = asRecord(source['address']) ?? asRecord(source['property']) ?? {};
  const street =
    firstText(source, STREET_KEYS)
    ?? firstText(nested, STREET_KEYS)
    ?? asText(source['address'])
    ?? firstText(nested, ['line1', 'line_1']);
  const city = firstText(source, CITY_KEYS) ?? firstText(nested, CITY_KEYS);
  const region = firstText(source, REGION_KEYS) ?? firstText(nested, REGION_KEYS);
  const postal = firstText(source, POSTAL_KEYS) ?? firstText(nested, POSTAL_KEYS);

  const locality = [city, region].filter((part): part is string => part !== null).join(', ');
  const addressParts = [street, [locality, postal].filter((part): part is string => part !== null && part.length > 0).join(' ')]
    .filter((part): part is string => part !== null && part.length > 0);
  const addressLine = addressParts.length === 0 ? null : addressParts.join(', ');

  return {
    customerName: customerName === null ? null : clamp(customerName, MAX_NAME),
    addressLine: addressLine === null ? null : clamp(addressLine, MAX_ADDRESS),
  };
};
