import { z } from 'zod';
import { idSchemas } from './ids.js';
import { ConstructionPhaseKeySchema } from './project.js';

/**
 * Inspections — PRD §9.7.
 *
 * Jurisdiction is closed: single regime, City of Lubbock, 2021 ISPSC
 * (docs/decisions/construction-model.md). There is no jurisdiction dimension.
 *
 * The one number here that no code can derive is lead time. It is however long
 * the city actually takes, and every value is rounded up on purpose — see
 * `leadTimeBusinessDays`.
 */

export const InspectionStatusSchema = z.enum([
  /** Called in, no date yet. */
  'requested',
  /** The city has given a date. */
  'scheduled',
  'passed',
  'failed',
  /** Recorded as not applying to this pool, with a stated reason. */
  'waived',
]);
export type InspectionStatus = z.infer<typeof InspectionStatusSchema>;

export const InspectionRequesterSchema = z.enum(['apex', 'subcontractor', 'customer']);
export type InspectionRequester = z.infer<typeof InspectionRequesterSchema>;

export const InspectionTypeSchema = z.strictObject({
  inspectionKey: z.string().min(1).max(120),
  sequence: z.number().int().positive(),
  title: z.string().min(1).max(200),
  phaseKey: ConstructionPhaseKeySchema,
  requestedBy: InspectionRequesterSchema,
  /** Which trade, when it is not Apex. Null when Apex books it. */
  requesterTrade: z.string().min(1).max(120).nullable(),
  /**
   * Business days between requesting and the inspector arriving.
   *
   * Deliberately conservative. This drives the last-safe-request date and the
   * cost of error is one-directional: too long warns a day early, which is
   * harmless; too short warns a day late, which is a crew standing on a job
   * that cannot proceed.
   */
  leadTimeBusinessDays: z.number().int().nonnegative(),
  /** The Gate that cannot release until this inspection has passed. */
  blocksDefinitionKey: z.string().min(1).max(120),
  requestMethod: z.string().min(1).max(300),
  /** Why it exists, in the code's terms. */
  authority: z.string().min(1).max(300),
});
export type InspectionType = z.infer<typeof InspectionTypeSchema>;

/**
 * One inspection on one job, whether or not anything has been recorded yet.
 *
 * `inspectionId` is null when nothing has been recorded — the row does not
 * exist and the state is "not requested". That is a real state, not a gap.
 */
export const JobInspectionSchema = z.strictObject({
  inspectionId: idSchemas.inspection.nullable(),
  jobId: idSchemas.job,
  inspectionKey: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  phaseKey: ConstructionPhaseKeySchema,
  requestedBy: InspectionRequesterSchema,
  requesterTrade: z.string().min(1).max(120).nullable(),
  leadTimeBusinessDays: z.number().int().nonnegative(),
  blocksDefinitionKey: z.string().min(1).max(120),
  blocksGateTitle: z.string().min(1).max(200),
  requestMethod: z.string().min(1).max(300),
  authority: z.string().min(1).max(300),
  /** Null until something is recorded. */
  status: InspectionStatusSchema.nullable(),
  requestedOn: z.string().date().nullable(),
  scheduledFor: z.string().date().nullable(),
  resultOn: z.string().date().nullable(),
  resultNote: z.string().max(2000).nullable(),
  /** What has to be fixed. Present on a failure and kept after it passes. */
  corrections: z.string().max(2000).nullable(),
  /**
   * When the inspected work is actually needed. Either recorded by hand or
   * derived from the earliest live crew booking in the blocked Gate's phase.
   * Null when nothing is planned — in which case there is no deadline, and the
   * system says so rather than inventing urgency.
   */
  neededBy: z.string().date().nullable(),
  /** Where `neededBy` came from, so a date on screen can be explained. */
  neededBySource: z.enum(['recorded', 'crew-booking']).nullable(),
  /**
   * The last day this can still be requested and arrive in time. Null whenever
   * `neededBy` is null — an unknowable deadline is left unknown.
   */
  lastSafeRequestOn: z.string().date().nullable(),
  /** How many failures are on record. A re-inspection never erases the first. */
  failureCount: z.number().int().nonnegative(),
});
export type JobInspection = z.infer<typeof JobInspectionSchema>;
export const JobInspectionListSchema = z.array(JobInspectionSchema);

/** One recorded outcome. Append-only; a later pass never erases a failure. */
export const InspectionResultSchema = z.strictObject({
  outcome: z.enum(['passed', 'failed', 'waived']),
  occurredOn: z.string().date(),
  note: z.string().max(2000).nullable(),
  corrections: z.string().max(2000).nullable(),
  recordedAt: z.string().datetime({ offset: true }),
  recordedByName: z.string().min(1).max(200).nullable(),
});
export type InspectionResult = z.infer<typeof InspectionResultSchema>;
