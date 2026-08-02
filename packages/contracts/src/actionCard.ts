import { z } from 'zod';
import { idSchemas } from './ids.js';

/**
 * The action card — PRD §9.5 and §14.3.
 *
 * One derived surface, not a per-feature to-do list. The Today feed, the daily
 * brief (§9.14), and notifications (§15) are all views of these cards, so a card
 * exists once and says the same thing everywhere.
 *
 * Every card answers three questions: what to do, why it matters, and what
 * happens if it waits. A card that cannot answer all three is not worth the
 * owner's attention and should not be generated.
 */

/** PRD §9.5's three sections. */
export const CardGroupSchema = z.enum([
  /** Needs judgment or approval from a person. */
  'needs-you',
  /** Progressing, but wants a routine check or log. */
  'running',
  /** Scheduled or expected, not actionable right now. */
  'this-week',
]);
export type CardGroup = z.infer<typeof CardGroupSchema>;

/** Mirrors the §15 notification tiers so one card drives both surfaces. */
export const CardUrgencySchema = z.enum(['urgent', 'important', 'routine']);
export type CardUrgency = z.infer<typeof CardUrgencySchema>;

/**
 * What produced the card. Stable machine-readable kinds so the UI can route,
 * group, and later snooze by kind without parsing prose.
 */
export const CardKindSchema = z.enum([
  'gate.countersign',
  'gate.blocked',
  'gate.ready',
  'gate.in-progress',
  'gate.not-opened',
  'draw.uninvoiced',
  'draw.unscheduled',
  'takeoff.missing',
  'project.unopened',
  'project.unassigned',
  'project.overdue',
  'project.due-soon',
  'project.risk',
]);
export type CardKind = z.infer<typeof CardKindSchema>;

export const ActionCardSchema = z.strictObject({
  /**
   * Deterministic, derived from kind and subject rather than minted. The same
   * condition yields the same id on every refresh, so a card can be recognised
   * across loads — and later snoozed or acknowledged — without a database table.
   */
  cardId: z.string().min(1).max(200),
  kind: CardKindSchema,
  group: CardGroupSchema,
  urgency: CardUrgencySchema,
  jobId: idSchemas.job,
  /** Identifying context for the card header; null when the lead carried none. */
  customerName: z.string().min(1).max(200).nullable(),
  location: z.string().min(1).max(300).nullable(),
  /** The required action, in the imperative. */
  title: z.string().min(1).max(200),
  /** Why it matters and what happens if it waits. Never optional. */
  reason: z.string().min(1).max(500),
  /** Human-readable timing, e.g. "Held since 31 Jul". Null when nothing is due. */
  dueLabel: z.string().min(1).max(120).nullable(),
  /**
   * Money at stake, in cents, for cards that carry a figure. Null otherwise.
   *
   * Held as data rather than left inside the title, so anything that needs to
   * total it — the daily brief, the §16 "value of draws released but not
   * invoiced" metric — reads a number instead of parsing prose that a copy
   * change would silently break.
   */
  amountCents: z.number().int().nonnegative().nullable(),
  /** The smallest workflow that completes the action. */
  actionLabel: z.string().min(1).max(80),
  actionHref: z.string().min(1).max(300),
});
export type ActionCard = z.infer<typeof ActionCardSchema>;

export const ActionCardListSchema = z.array(ActionCardSchema);

export const CARD_GROUP_TITLE: Readonly<Record<CardGroup, string>> = {
  'needs-you': 'Things need you',
  running: 'Running',
  'this-week': 'This week',
};
