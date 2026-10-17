import { z } from 'zod';
import { idSchemas } from './ids.js';

export const LeadFollowupSchema = z.strictObject({
  followupId: z.number().int().positive(),
  leadId: idSchemas.lead,
  nextAction: z.string().trim().min(1).max(1000),
  dueDate: z.iso.date(),
  assignedUserId: idSchemas.user,
  assignedUserName: z.string().min(1),
  createdBy: idSchemas.user,
  createdAt: z.string().datetime({ offset: true }),
  completedBy: idSchemas.user.nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
});
export type LeadFollowup = z.infer<typeof LeadFollowupSchema>;

export const LeadFollowupTodayRowSchema = z.strictObject({
  leadId: idSchemas.lead,
  customerName: z.string().nullable(),
  addressLine: z.string().min(1).nullable(),
  leadStatus: z.enum(['accepted', 'qualified', 'proposal']),
  kind: z.enum(['overdue', 'due-today', 'missing-next-action']),
  dueDate: z.iso.date().nullable(),
  nextAction: z.string().nullable(),
  proposalState: z.literal('issued').nullable(),
  assignedUserName: z.string().nullable(),
});
export type LeadFollowupTodayRow = z.infer<typeof LeadFollowupTodayRowSchema>;
export const LeadFollowupTodayListSchema = z.array(LeadFollowupTodayRowSchema);

export const OpportunityWorkSchema = z.strictObject({
  leadId: idSchemas.lead,
  customerName: z.string().nullable(),
  addressLine: z.string().min(1).nullable(),
  leadStatus: z.enum(['accepted', 'qualified', 'proposal', 'signed', 'rejected']),
  proposalState: z.enum(['draft', 'issued', 'signed']).nullable(),
  assignees: z.array(z.strictObject({ userId: idSchemas.user, displayName: z.string().min(1) })),
  followups: z.array(LeadFollowupSchema),
});
export type OpportunityWork = z.infer<typeof OpportunityWorkSchema>;

export const ScheduleLeadFollowupSchema = z.strictObject({
  nextAction: z.string().trim().min(1).max(1000),
  dueDate: z.iso.date(),
  assignedUserId: idSchemas.user,
});
