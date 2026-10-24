import { z } from 'zod';
import { idSchemas } from './ids.js';
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, 'Invalid civil date');
export const TaskFieldsSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(240),
    detail: z.string().trim().max(4000).nullable(),
    assignedUserId: idSchemas.user.nullable(),
    dueDate: day.nullable(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    milestone: z.string().trim().max(240).nullable(),
    recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']),
  })
  .refine(
    (v) => v.recurrence === 'none' || v.dueDate !== null,
    'Recurring tasks require a due date',
  );
export const TaskCreateSchema = TaskFieldsSchema.safeExtend({
  jobId: idSchemas.job.nullable(),
});
export const TaskEditSchema = TaskFieldsSchema.safeExtend({
  expectedRevision: z.number().int().positive(),
});
export const TaskCompleteSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
});
export const TaskSchema = TaskCreateSchema.safeExtend({
  taskId: idSchemas.task,
  createdBy: idSchemas.user,
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  completedBy: idSchemas.user.nullable(),
  parentTaskId: idSchemas.task.nullable(),
});
export const TaskListSchema = z.array(TaskSchema);
export const TaskHistorySchema = z.array(
  z.strictObject({
    action: z.enum(['created', 'edited', 'completed']),
    actor: idSchemas.user,
    at: z.string().datetime(),
    snapshot: TaskSchema,
  }),
);
export const TaskAssigneesSchema = z.array(
  z.strictObject({ userId: idSchemas.user, displayName: z.string() }),
);
export type Task = z.infer<typeof TaskSchema>;
