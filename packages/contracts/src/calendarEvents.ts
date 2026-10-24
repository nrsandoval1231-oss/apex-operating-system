import { z } from 'zod';
import { idSchemas } from './ids.js';
import { CalendarEntrySchema } from './schedule.js';
import { TaskSchema } from './tasks.js';
export const CalendarCivilDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, 'Invalid civil date');
const fields = z
  .strictObject({
    title: z.string().trim().min(1).max(240),
    note: z.string().trim().max(4000).nullable(),
    eventType: z.enum([
      'meeting',
      'site-visit',
      'installation',
      'material-delivery',
      'crew',
      'milestone',
    ]),
    assignedUserId: idSchemas.user.nullable(),
    allDay: z.boolean(),
    startsOn: CalendarCivilDaySchema.nullable(),
    endsOn: CalendarCivilDaySchema.nullable(),
    startsAt: z.string().datetime().nullable(),
    endsAt: z.string().datetime().nullable(),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, 'Invalid timezone'),
  })
  .refine((v) => {
    if (v.allDay)
      return (
        v.startsOn !== null &&
        v.endsOn !== null &&
        v.startsAt === null &&
        v.endsAt === null &&
        v.endsOn >= v.startsOn &&
        Date.parse(v.endsOn) - Date.parse(v.startsOn) <= 366 * 86400000
      );
    return (
      v.startsOn === null &&
      v.endsOn === null &&
      v.startsAt !== null &&
      v.endsAt !== null &&
      Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
      Date.parse(v.endsAt) - Date.parse(v.startsAt) <= 366 * 86400000
    );
  }, 'Provide a valid interval of at most 366 days');
export const CalendarEventCreateSchema = fields.safeExtend({
  jobId: idSchemas.job.nullable(),
});
export const CalendarEventEditSchema = fields.safeExtend({
  expectedRevision: z.number().int().positive(),
});
export const CalendarEventCancelSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
});
export const CalendarEventSchema = CalendarEventCreateSchema.safeExtend({
  eventId: idSchemas.agenda,
  createdBy: idSchemas.user,
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  cancelledBy: idSchemas.user.nullable(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export const CalendarEventHistorySchema = z.array(
  z.strictObject({
    action: z.enum(['created', 'edited', 'cancelled']),
    actor: idSchemas.user,
    at: z.string().datetime(),
    snapshot: CalendarEventSchema,
  }),
);
export const WorkspaceCalendarEntrySchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('appointment'),
    id: z.string(),
    event: CalendarEventSchema,
  }),
  z.strictObject({
    source: z.literal('operational'),
    id: z.string(),
    entry: CalendarEntrySchema,
  }),
  z.strictObject({
    source: z.literal('task'),
    id: z.string(),
    task: TaskSchema,
  }),
]);
export const WorkspaceCalendarSchema = z.array(WorkspaceCalendarEntrySchema);
export type WorkspaceCalendarEntry = z.infer<
  typeof WorkspaceCalendarEntrySchema
>;
