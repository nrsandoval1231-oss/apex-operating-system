import { z } from 'zod';
import { ActionCardSchema } from './actionCard.js';
import { idSchemas } from './ids.js';

/**
 * The daily owner brief — PRD §9.14.
 *
 * A view over the action cards, never a second source of truth. Everything here
 * is drawn from the same derivation that feeds the Today screen, so the brief
 * and the feed can never disagree about what needs doing.
 *
 * The brief is generated once per day and then frozen. That is the whole
 * difference between it and the feed: Today is live and answers "what is true
 * now", the brief is a morning snapshot and answers "what changed since
 * yesterday". A brief that silently rewrote itself through the day could not
 * answer the second question at all.
 */

export const BriefItemSchema = z.strictObject({
  card: ActionCardSchema,
  /**
   * Days this card has been on a brief, counting today. 1 means it is new.
   * Kept as a count rather than prose so the UI decides how to say it.
   */
  standingDays: z.number().int().positive(),
});
export type BriefItem = z.infer<typeof BriefItemSchema>;

/**
 * Something that was on the previous brief and is not on this one.
 *
 * Only the card's identity and title survive: the card itself is gone, and
 * reconstructing one would mean inventing state that no longer exists.
 */
export const BriefClearedSchema = z.strictObject({
  cardId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  customerName: z.string().min(1).max(200).nullable(),
});
export type BriefCleared = z.infer<typeof BriefClearedSchema>;

export const DailyBriefSchema = z.strictObject({
  briefId: idSchemas.brief,
  /** The day this brief covers, YYYY-MM-DD. One brief per day. */
  briefDate: z.string().date(),
  generatedAt: z.string().datetime({ offset: true }),
  /** The date of the brief this one is compared against; null for the first. */
  previousBriefDate: z.string().date().nullable(),

  /** Needs a decision. The reason anyone opens this. */
  needsYou: z.array(BriefItemSchema),
  /** Progressing, wants a routine check. */
  running: z.array(BriefItemSchema),
  /** Scheduled or expected, not actionable yet. */
  thisWeek: z.array(BriefItemSchema),

  /** On this brief and not the last one. */
  newSinceLast: z.array(BriefItemSchema),
  /** Resolved since the last brief. */
  cleared: z.array(BriefClearedSchema),

  /** Money a passed Gate has made billable and nobody has invoiced. */
  readyToBillCents: z.number().int().nonnegative(),

  /**
   * What this brief cannot speak to yet, named explicitly.
   *
   * Inspections and schedule conflicts now arrive through the shared action
   * cards. Customer-decision deadlines and startup/curing checks still lack an
   * authoritative model, so the brief names those remaining gaps explicitly.
   */
  notCovered: z.array(z.string().min(1).max(200)),
});
export type DailyBrief = z.infer<typeof DailyBriefSchema>;
