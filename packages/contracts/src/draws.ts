import { z } from 'zod';
import { idSchemas } from './ids.js';

/**
 * The draw schedule — PRD §9.8.
 *
 * Authority: docs/decisions/construction-model.md §2, taken from Apex's actual
 * contract and confirmed 2026-07-31. This is contract behaviour, not a modelling
 * choice.
 *
 * Note on Draw 1: it releases on **excavation verified**, not on rebar
 * completion, so it funds the steel that goes in next. It is the only draw that
 * pays ahead of verified work. That is what the contract says; do not "correct"
 * it.
 */

export const DRAW_CODES = ['deposit', 'draw-1', 'draw-2', 'draw-3', 'draw-final'] as const;
export const DrawCodeSchema = z.enum(DRAW_CODES);
export type DrawCode = z.infer<typeof DrawCodeSchema>;

export interface DrawTemplate {
  readonly code: DrawCode;
  readonly sequence: number;
  readonly label: string;
  /** Basis points of the contract total. Integers, because money is not a float. */
  readonly percentBasisPoints: number;
  /** What releases it: contract signing, or a named Gate passing. */
  readonly releaseCondition: 'contract-signed' | 'gate';
  readonly gateDefinitionKey: string | null;
  /** What the draw covers, in Apex's own words from the contract. */
  readonly covers: string;
}

export const DRAW_SCHEDULE_TEMPLATE: readonly DrawTemplate[] = [
  {
    code: 'deposit', sequence: 1, label: 'Deposit', percentBasisPoints: 1000,
    releaseCondition: 'contract-signed', gateDefinitionKey: null,
    covers: 'Architectural design, engineering plans, permit submission fees',
  },
  {
    code: 'draw-1', sequence: 2, label: 'Draw 1', percentBasisPoints: 3000,
    releaseCondition: 'gate', gateDefinitionKey: 'excavation',
    covers: 'Heavy machinery rental, dirt hauling, initial steel rebar installation',
  },
  {
    code: 'draw-2', sequence: 3, label: 'Draw 2', percentBasisPoints: 3000,
    releaseCondition: 'gate', gateDefinitionKey: 'shell',
    covers: 'Structural plumbing, structural electrical rough-in, concrete shell shoot',
  },
  {
    code: 'draw-3', sequence: 4, label: 'Draw 3', percentBasisPoints: 2000,
    releaseCondition: 'gate', gateDefinitionKey: 'deck-tile',
    covers: 'Waterline tile, coping stones, patio decking',
  },
  {
    code: 'draw-final', sequence: 5, label: 'Final Draw', percentBasisPoints: 1000,
    releaseCondition: 'gate', gateDefinitionKey: 'final',
    covers: 'Plaster or pebble coat, water fill, mechanical equipment start-up',
  },
] as const;

/** The schedule must account for the whole contract and nothing more. */
export const TOTAL_BASIS_POINTS = 10_000;

export const DrawStatusSchema = z.enum([
  /** Not earned yet. */
  'scheduled',
  /** Its release condition is satisfied and it may be billed. */
  'eligible',
  /** A human confirmed an invoice exists. Apex OS never invoices on its own. */
  'invoiced',
  'paid',
]);
export type DrawStatus = z.infer<typeof DrawStatusSchema>;

export const JobDrawSchema = z.strictObject({
  drawId: idSchemas.draw,
  jobId: idSchemas.job,
  drawCode: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  sequence: z.number().int().positive().nullable(),
  percentBasisPoints: z.number().int().positive().max(TOTAL_BASIS_POINTS).nullable(),
  /** Null when the job has no signed contract value to divide. */
  amountCents: z.number().int().nonnegative().nullable(),
  releaseCondition: z.enum(['contract-signed', 'gate']),
  gateDefinitionKey: z.string().min(1).max(120).nullable(),
  status: DrawStatusSchema,
  eligibleAt: z.string().datetime({ offset: true }).nullable(),
  sourceGateInstanceId: idSchemas.gate.nullable(),
  /** The accounting system's identifier. Apex OS does not own it. */
  invoiceReference: z.string().min(1).max(160).nullable(),
  invoicedAt: z.string().datetime({ offset: true }).nullable(),
  dueDate: z.string().date().nullable(),
  paidAt: z.string().datetime({ offset: true }).nullable(),
  paidCents: z.number().int().nonnegative().nullable(),
});
export type JobDraw = z.infer<typeof JobDrawSchema>;

/**
 * The job's draw schedule and where it stands.
 *
 * `collectedCents` is what Apex recorded as paid — not a general-ledger figure.
 * QuickBooks remains the financial authority (PRD §9.8, §11.3).
 */
export const DrawScheduleSchema = z.strictObject({
  jobId: idSchemas.job,
  contractCents: z.number().int().nonnegative().nullable(),
  draws: z.array(JobDrawSchema),
  eligibleUnbilledCents: z.number().int().nonnegative(),
  invoicedCents: z.number().int().nonnegative(),
  collectedCents: z.number().int().nonnegative(),
  remainingCents: z.number().int().nullable(),
});
export type DrawSchedule = z.infer<typeof DrawScheduleSchema>;
