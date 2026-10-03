import { z } from 'zod';
import { ApprovedTakeoffRevisionSchema, DesignerTakeoffSubmissionSchema, ProposalVersionSchema } from './records.js';

export const ProposalPricingBlockerSchema = z.strictObject({
  code: z.enum(['missing-direct-price', 'missing-measured-price', 'missing-canonical-quantity']),
  message: z.string().min(1),
  lineCode: z.number().int().optional(),
  quantityCode: z.string().optional(),
});
export type ProposalPricingBlocker = z.infer<typeof ProposalPricingBlockerSchema>;

export const DirectPriceInputSchema = z.strictObject({
  code: z.union([z.literal(300), z.literal(500), z.literal(600), z.literal(900),
    z.literal(1100), z.literal(1200), z.literal(1300)]),
  name: z.string().min(1).max(200),
  scopeStatus: z.enum(['quoted', 'not-applicable', 'unresolved']),
  amountCents: z.number().int().nonnegative().nullable(),
  basis: z.string().min(1).max(1000),
});

export const MeasuredPriceInputSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  amountCents: z.number().int().nonnegative().nullable(),
  basis: z.string().min(1).max(1000),
});

export const FinishEstimateCommandSchema = z.strictObject({
  submission: DesignerTakeoffSubmissionSchema,
  directLines: z.array(DirectPriceInputSchema),
  measuredLines: z.array(MeasuredPriceInputSchema),
  feeRateBps: z.number().int().min(0).max(10000),
});

export const FinishEstimateResultSchema = z.strictObject({
  takeoff: ApprovedTakeoffRevisionSchema,
  proposal: ProposalVersionSchema,
  blockers: z.array(ProposalPricingBlockerSchema),
  workbook: z.strictObject({
    revisionId: z.string(),
    quantityPayloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
    quantityModelVersion: z.string(),
    orderList: ApprovedTakeoffRevisionSchema.shape.quantities,
  }),
});
export type FinishEstimateResult = z.infer<typeof FinishEstimateResultSchema>;

export const CustomerProposalPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  status: z.enum(['draft', 'issued']),
  customer: z.strictObject({ name: z.string().nullable(), address: z.string().nullable() }),
  takeoff: z.strictObject({
    revisionId: z.string(), quantityPayloadSha256: z.string(), quantityModelVersion: z.string(),
  }),
  pricingLibraryVersion: z.string(),
  scope: z.array(z.strictObject({
    name: z.string(),
    resolved: z.boolean(),
    /**
     * Present on estimates finished after scope decisions were stored.
     * `not-applicable` is a decision to leave the line out, not a resolved price.
     */
    scopeStatus: z.enum(['quoted', 'not-applicable', 'unresolved']).optional(),
    code: z.number().int().optional(),
  })),
  totalCents: z.number().int().nonnegative().nullable(),
  blockers: z.array(ProposalPricingBlockerSchema),
  email: z.strictObject({ subject: z.string(), body: z.string() }).nullable(),
});
export type CustomerProposalPayload = z.infer<typeof CustomerProposalPayloadSchema>;
