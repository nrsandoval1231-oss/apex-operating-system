import { z } from 'zod';
import { idSchemas } from './ids.js';
export const WorkspacePrioritySchema = z.enum(['normal', 'high', 'urgent']);
export const WorkspaceProjectSchema = z.strictObject({
  jobId: idSchemas.job,
  proposalVersionId: idSchemas.proposal_version.nullable(),
  division: z
    .enum([
      'Designer Pools',
      'Concrete Coating',
      'Design & Renovation',
      'Pool Service',
    ])
    .nullable(),
  stageCatalog: z.literal('pools').nullable(),
  priority: WorkspacePrioritySchema,
  revision: z.number().int().nonnegative(),
  gates: z
    .strictObject({
      released: z.number().int().nonnegative(),
      required: z.number().int().nonnegative(),
    })
    .nullable(),
});
export const WorkspaceProjectListSchema = z.array(WorkspaceProjectSchema);
export type WorkspaceProject = z.infer<typeof WorkspaceProjectSchema>;
export const ProjectPriorityCommandSchema = z.strictObject({
  priority: WorkspacePrioritySchema,
  expectedRevision: z.number().int().nonnegative(),
});
export const ProjectNoteCommandSchema = z.strictObject({
  text: z.string().trim().min(1).max(4000),
});
export const ProjectNoteSchema = z.strictObject({
  noteId: idSchemas.note,
  jobId: idSchemas.job,
  text: z.string().min(1).max(4000),
  actor: idSchemas.user,
  at: z.string().datetime({ offset: true }),
});
export const ProjectNotesSchema = z.array(ProjectNoteSchema);
export const ProjectActivitySchema = z.array(
  z.strictObject({
    id: z.string(),
    source: z.enum([
      'note',
      'priority',
      'task',
      'appointment',
      'operational',
      'photo',
    ]),
    title: z.string(),
    actor: z.string().nullable(),
    at: z.string().datetime({ offset: true }),
  }),
);
