import { describe, expect, it } from 'vitest';
import { DailyBriefSchema, createCanonicalId, type ActionCard } from '@apex/contracts';
import { BRIEF_NOT_COVERED, buildDailyBrief, type PreviousBrief } from './brief.js';

const jobId = createCanonicalId('job');

const card = (overrides: Partial<ActionCard> = {}): ActionCard => ({
  cardId: 'gate.blocked:' + jobId + ':shell',
  kind: 'gate.blocked',
  group: 'needs-you',
  urgency: 'urgent',
  jobId,
  customerName: 'Whitaker Oasis',
  location: '4502 19th St, Lubbock, TX',
  title: 'Clear the block on Shell',
  reason: 'A requirement failed its evaluation and the Gate cannot release.',
  dueLabel: 'Blocking work',
  amountCents: null,
  actionLabel: 'Open the Gate',
  actionHref: `/projects/${jobId}`,
  ...overrides,
});

const build = (cards: readonly ActionCard[], previous: PreviousBrief | null = null) =>
  buildDailyBrief({
    briefId: createCanonicalId('brief'),
    briefDate: '2026-08-02',
    generatedAt: '2026-08-02T06:00:00.000Z',
    cards,
    previous,
  });

const previousWith = (
  items: readonly { cardId: string; standingDays: number }[],
  titles: Record<string, { title: string; customerName: string | null }> = {},
): PreviousBrief => ({ briefDate: '2026-08-01', items, titles });

describe('the brief as a view over the cards', () => {
  it('satisfies the published contract', () => {
    expect(DailyBriefSchema.safeParse(build([card()])).success).toBe(true);
  });

  it('sorts cards into the same three sections as the feed', () => {
    const brief = build([
      card(),
      card({ cardId: 'a', group: 'running', urgency: 'routine' }),
      card({ cardId: 'b', group: 'this-week', urgency: 'routine' }),
    ]);
    expect([brief.needsYou.length, brief.running.length, brief.thisWeek.length]).toEqual([1, 1, 1]);
  });

  it('invents nothing when there are no cards', () => {
    const brief = build([]);
    expect([brief.needsYou, brief.running, brief.thisWeek, brief.newSinceLast]).toEqual([[], [], [], []]);
    expect(brief.readyToBillCents).toBe(0);
  });
});

describe('the first brief', () => {
  it('calls nothing new, because there is nothing to be new against', () => {
    const brief = build([card()]);
    expect(brief.previousBriefDate).toBeNull();
    expect(brief.newSinceLast).toEqual([]);
    expect(brief.cleared).toEqual([]);
  });

  it('starts every card at one standing day', () => {
    expect(build([card()]).needsYou[0]?.standingDays).toBe(1);
  });
});

describe('what changed since yesterday', () => {
  it('ages a card that was already there', () => {
    const brief = build([card()], previousWith([{ cardId: card().cardId, standingDays: 3 }]));
    expect(brief.needsYou[0]?.standingDays).toBe(4);
    expect(brief.newSinceLast).toEqual([]);
  });

  it('marks a card the previous brief did not carry as new', () => {
    const brief = build([card()], previousWith([{ cardId: 'something-else', standingDays: 1 }]));
    expect(brief.newSinceLast.map((item) => item.card.cardId)).toEqual([card().cardId]);
    expect(brief.newSinceLast[0]?.standingDays).toBe(1);
  });

  it('names what has cleared, using the title the previous brief recorded', () => {
    const brief = build([], previousWith(
      [{ cardId: 'gone', standingDays: 2 }],
      { gone: { title: 'Countersign Pre-gunite', customerName: 'Whitaker Oasis' } },
    ));
    expect(brief.cleared).toEqual([
      { cardId: 'gone', title: 'Countersign Pre-gunite', customerName: 'Whitaker Oasis' },
    ]);
  });

  it('still names a cleared card whose title was not recorded', () => {
    const brief = build([], previousWith([{ cardId: 'gone', standingDays: 1 }]));
    expect(brief.cleared[0]).toMatchObject({ cardId: 'gone', customerName: null });
    expect(brief.cleared[0]?.title.length).toBeGreaterThan(0);
  });

  it('records which brief it was compared against', () => {
    expect(build([card()], previousWith([])).previousBriefDate).toBe('2026-08-01');
  });
});

describe('money on the brief', () => {
  it('totals the draws a gate has made billable', () => {
    const brief = build([
      card({ cardId: 'd1', kind: 'draw.uninvoiced', title: 'Bill the Draw 1', amountCents: 4_561_251 }),
      card({ cardId: 'd2', kind: 'draw.uninvoiced', title: 'Bill the Deposit', amountCents: 1_520_417 }),
    ]);
    expect(brief.readyToBillCents).toBe(6_081_668);
  });

  it('counts a draw with no amount as nothing rather than guessing', () => {
    const brief = build([
      card({ cardId: 'd1', kind: 'draw.uninvoiced', amountCents: null }),
      card({ cardId: 'd2', kind: 'draw.uninvoiced', amountCents: 1_520_417 }),
    ]);
    expect(brief.readyToBillCents).toBe(1_520_417);
  });

  it('ignores money on cards that are not draws', () => {
    expect(build([card({ amountCents: 999_999 })]).readyToBillCents).toBe(0);
  });
});

describe('honesty about coverage', () => {
  it('names the PRD sections nothing can answer yet', () => {
    const brief = build([]);
    expect(brief.notCovered).toEqual([...BRIEF_NOT_COVERED]);
    expect(brief.notCovered).toContain('Inspections requiring action');
    expect(brief.notCovered).toContain('Schedule conflicts');
  });

  it('says so even on a morning with nothing outstanding', () => {
    expect(build([]).notCovered.length).toBeGreaterThan(0);
  });
});
