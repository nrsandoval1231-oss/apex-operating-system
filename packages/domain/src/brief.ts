import {
  type ActionCard,
  type BriefCleared,
  type BriefId,
  type BriefItem,
  type DailyBrief,
} from '@apex/contracts';

/**
 * Building the daily brief — PRD §9.14.
 *
 * Pure. No clock, no database: the cards, the previous brief, and the date all
 * arrive as arguments. This is a projection of the action-card derivation and
 * adds no judgment of its own about what matters — if a card is not worth the
 * owner's attention it should not have been generated in the first place.
 */

/** What a previous brief has to carry for today's brief to diff against it. */
export interface PreviousBrief {
  readonly briefDate: string;
  /** Cards on that brief, with how many days each had already been standing. */
  readonly items: readonly { readonly cardId: string; readonly standingDays: number }[];
  /** Titles kept so a card that has since disappeared can still be named. */
  readonly titles: Readonly<Record<string, { title: string; customerName: string | null }>>;
}

export interface BuildBriefInput {
  readonly briefId: BriefId;
  readonly briefDate: string;
  readonly generatedAt: string;
  readonly cards: readonly ActionCard[];
  /** Null on the very first brief, when nothing can be called new or cleared. */
  readonly previous: PreviousBrief | null;
}

/**
 * Money a passed Gate has made billable that nobody has invoiced.
 *
 * Summed from the cards themselves, so the figure on the brief is by
 * construction the one on the feed. A draw with no amount contributes nothing
 * rather than a guess. This is not an accounting figure: PRD §9.8 keeps
 * QuickBooks as the financial authority.
 */
const readBillableCents = (cards: readonly ActionCard[]): number =>
  cards
    .filter((card) => card.kind === 'draw.uninvoiced')
    .reduce((sum, card) => sum + (card.amountCents ?? 0), 0);

/** Sections PRD §9.14 asks for that nothing in the system can answer yet. */
export const BRIEF_NOT_COVERED: readonly string[] = [
  'Inspections requiring action',
  'Schedule conflicts',
  'Customer decisions overdue',
  'Startup and curing checks',
];

export function buildDailyBrief(input: BuildBriefInput): DailyBrief {
  const standingByCard = new Map(
    (input.previous?.items ?? []).map((item) => [item.cardId, item.standingDays] as const),
  );

  const toItem = (card: ActionCard): BriefItem => ({
    card,
    // A card carried over gains a day; one that is not on the previous brief
    // starts at one, which is what "new" means here.
    standingDays: (standingByCard.get(card.cardId) ?? 0) + 1,
  });

  const items = input.cards.map(toItem);
  const inGroup = (group: ActionCard['group']) => items.filter((item) => item.card.group === group);

  // Nothing is "new" on a first brief: there is no previous state to be new
  // against, and calling every open item new would overstate the morning.
  const newSinceLast = input.previous === null
    ? []
    : items.filter((item) => !standingByCard.has(item.card.cardId));

  const present = new Set(input.cards.map((card) => card.cardId));
  const cleared: BriefCleared[] = (input.previous?.items ?? [])
    .filter((item) => !present.has(item.cardId))
    .map((item) => {
      const known = input.previous?.titles[item.cardId];
      return {
        cardId: item.cardId,
        title: known?.title ?? 'Resolved item',
        customerName: known?.customerName ?? null,
      };
    });

  return {
    briefId: input.briefId,
    briefDate: input.briefDate,
    generatedAt: input.generatedAt,
    previousBriefDate: input.previous?.briefDate ?? null,
    needsYou: inGroup('needs-you'),
    running: inGroup('running'),
    thisWeek: inGroup('this-week'),
    newSinceLast,
    cleared,
    readyToBillCents: readBillableCents(input.cards),
    notCovered: [...BRIEF_NOT_COVERED],
  };
}
