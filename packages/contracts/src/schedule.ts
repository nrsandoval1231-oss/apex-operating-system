import { z } from 'zod';
import { idSchemas } from './ids.js';
import { ConstructionPhaseKeySchema } from './project.js';

/**
 * Subcontractor visits and crew conflicts — PRD §9.6.
 *
 * Dates, not times. Pool trades book by the day — a gunite crew is booked for
 * Tuesday, not 09:00–14:30 — and modelling hours would invent precision Apex
 * does not have and cannot honour.
 */

export const VisitStatusSchema = z.enum(['planned', 'confirmed', 'done', 'cancelled']);
export type VisitStatus = z.infer<typeof VisitStatusSchema>;

export const SubcontractorSchema = z.strictObject({
  subcontractorId: idSchemas.subcontractor,
  name: z.string().min(1).max(200),
  trade: z.string().min(1).max(120),
  contact: z.string().min(1).max(200).nullable(),
  active: z.boolean(),
});
export type Subcontractor = z.infer<typeof SubcontractorSchema>;

export const ScheduledVisitSchema = z.strictObject({
  visitId: idSchemas.visit,
  jobId: idSchemas.job,
  subcontractorId: idSchemas.subcontractor,
  subcontractorName: z.string().min(1).max(200),
  trade: z.string().min(1).max(120),
  phaseKey: ConstructionPhaseKeySchema,
  /** Inclusive range. A single-day visit has the same start and end. */
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  status: VisitStatusSchema,
  note: z.string().max(2000).nullable(),
  /** How many times this visit has already been moved. */
  rescheduleCount: z.number().int().nonnegative(),
});
export type ScheduledVisit = z.infer<typeof ScheduledVisitSchema>;

export const ScheduledVisitListSchema = z.array(ScheduledVisitSchema);

export const CalendarTaskTypeSchema = z.enum(['visit', 'gate', 'inspection']);
export type CalendarTaskType = z.infer<typeof CalendarTaskTypeSchema>;

/** Every dated or date-derived operational task, not only crew visits. */
export const CalendarEntrySchema = z.strictObject({
  taskId: z.string().min(1).max(200),
  taskType: CalendarTaskTypeSchema,
  title: z.string().min(1).max(200),
  visitId: idSchemas.visit.nullable(),
  gateInstanceId: idSchemas.gate.nullable(),
  inspectionKey: z.string().min(1).max(120).nullable(),
  jobId: idSchemas.job,
  customerName: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  subcontractorName: z.string().min(1).max(200).nullable(),
  trade: z.string().min(1).max(120).nullable(),
  phaseKey: ConstructionPhaseKeySchema.nullable(),
  startsOn: z.string().date().nullable(),
  endsOn: z.string().date().nullable(),
  status: z.string().min(1).max(60),
  conflict: z.boolean(),
  movable: z.boolean(),
});
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export const CalendarEntryListSchema = z.array(CalendarEntrySchema);

/**
 * The two things the system can prove are wrong.
 *
 * It does not guess at material lead times, weather, or crew capacity: those
 * are judgments Apex makes, and a warning the system cannot substantiate is
 * worse than silence.
 */
export const VisitConflictSchema = z.discriminatedUnion('kind', [
  /** The same crew booked on two jobs whose dates overlap. */
  z.strictObject({
    kind: z.literal('crew-double-booked'),
    visitId: idSchemas.visit,
    otherVisitId: idSchemas.visit,
    subcontractorName: z.string().min(1).max(200),
    otherJobId: idSchemas.job,
    otherJobName: z.string().min(1).max(200).nullable(),
    /** The days both bookings claim. */
    overlapStartsOn: z.string().date(),
    overlapEndsOn: z.string().date(),
  }),
  /** Work booked into a phase whose guarding Gate has not released. */
  z.strictObject({
    kind: z.literal('before-gate'),
    visitId: idSchemas.visit,
    phaseKey: ConstructionPhaseKeySchema,
    gateTitle: z.string().min(1).max(200),
    /** Null when the Gate has not even been opened. */
    gateStatus: z.string().min(1).max(60).nullable(),
  }),
]);
export type VisitConflict = z.infer<typeof VisitConflictSchema>;
