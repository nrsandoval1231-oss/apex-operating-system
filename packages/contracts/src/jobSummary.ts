import { z } from 'zod';
import { idSchemas } from './ids.js';

/**
 * Operational read model for the Apex OS project list and Today feed.
 *
 * This is a projection over `jobs`, `leads`, `proposal_versions`, and
 * `gate_instances`. It is deliberately NOT the §9.3 project record — phase,
 * customer milestone, superintendent, target window, and risk are added in the
 * project/phase model step. Nothing here invents a fact the database does not
 * already hold: every optional field is nullable rather than defaulted.
 */

/**
 * Job lifecycle values accepted by the `jobs` table check constraint.
 *
 * NOTE: `JobSchema` in ./records.ts admits only 'active' | 'on-hold' | 'closed'.
 * The database is the wider of the two. The summary follows the database so a
 * legitimately stored row can never fail to render; reconciling the two sets is
 * tracked as an open item rather than silently narrowed here.
 */
export const JobLifecycleStatusSchema = z.enum([
  'active',
  'on-hold',
  'complete',
  'closed',
  'cancelled',
]);
export type JobLifecycleStatus = z.infer<typeof JobLifecycleStatusSchema>;

export const GateInstanceStatusSchema = z.enum(['not-started', 'in-progress', 'blocked', 'released']);
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
  /** Approved takeoff backing the current Gate, when one exists. */
  approvedTakeoffRevisionId: idSchemas.revision.nullable(),
  /** Most recent unreleased Gate, else the most recent released Gate, else null. */
  currentGate: JobSummaryGateSchema.nullable(),
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

export const JobSummaryListSchema = z.array(JobSummarySchema);

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

  const addressParts = [street, [city, region].filter((part): part is string => part !== null).join(', ')]
    .filter((part): part is string => part !== null && part.length > 0);
  const addressLine = addressParts.length === 0 ? null : addressParts.join(', ');

  return {
    customerName: customerName === null ? null : clamp(customerName, MAX_NAME),
    addressLine: addressLine === null ? null : clamp(addressLine, MAX_ADDRESS),
  };
};
