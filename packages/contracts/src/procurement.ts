import { z } from 'zod';
import { idSchemas } from './ids.js';

export const PROCUREMENT_CODES = [
  'shell.gunite-ordered-volume',
  'shell.reinforcing-steel-weight',
  'finishes.tile-ordered-area',
  'finishes.coping-ordered-length',
] as const;
export const ProcurementCodeSchema = z.enum(PROCUREMENT_CODES);

export const ProcurementLineSchema = z.strictObject({
  lineId: idSchemas.material,
  jobId: idSchemas.job,
  revisionId: idSchemas.revision,
  quantityCode: ProcurementCodeSchema,
  requiredQuantity: z.number().nonnegative(),
  unit: z.string().min(1).max(40),
  orderedQuantity: z.number().nonnegative().nullable(),
  vendor: z.string().max(200).nullable(),
  orderReference: z.string().max(160).nullable(),
  neededBy: z.string().date().nullable(),
  expectedOn: z.string().date().nullable(),
  receivedQuantity: z.number().nonnegative(),
  outstandingQuantity: z.number().nonnegative(),
  revision: z.number().int().positive(),
  updatedBy: idSchemas.user,
  updatedByName: z.string().min(1).max(200).nullable(),
  updatedAt: z.string().datetime({ offset: true }),
  staleTakeoff: z.boolean(),
});
export type ProcurementLine = z.infer<typeof ProcurementLineSchema>;
export const ProcurementListSchema = z.array(ProcurementLineSchema);

export const ProcurementCreateSchema = z.strictObject({
  quantityCode: ProcurementCodeSchema,
  neededBy: z.string().date().nullable().optional(),
});
export const ProcurementUpdateSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  orderedQuantity: z.number().nonnegative().nullable(),
  vendor: z.string().trim().min(1).max(200).nullable(),
  orderReference: z.string().trim().min(1).max(160).nullable(),
  neededBy: z.string().date().nullable(),
  expectedOn: z.string().date().nullable(),
  receivedQuantity: z.number().nonnegative(),
}).superRefine((value, ctx) => {
  const ordering = value.orderedQuantity !== null;
  if (ordering !== (value.vendor !== null) || ordering !== (value.orderReference !== null)) {
    ctx.addIssue({ code: 'custom', message: 'Enter ordered quantity, vendor, and order reference together.' });
  }
  if (!ordering && value.expectedOn !== null) {
    ctx.addIssue({ code: 'custom', path: ['expectedOn'], message: 'Expected delivery requires a recorded order.' });
  }
});
export type ProcurementUpdate = z.infer<typeof ProcurementUpdateSchema>;
