/**
 * The drawn deck.
 *
 * The number these functions produce is `yard.deck-area`, one of the seventeen
 * signed quantities, and it is what concrete gets ordered against. The tests
 * that matter here are the two the old constant-width formula got wrong: an
 * attached spa standing in the slab, and a slab that is not a uniform ring.
 */

import { describe, expect, it } from 'vitest';
import {
  assertDeckOutlineContainsPool,
  deckMargins,
  deckNetArea,
  deckOutlineFromBorder,
  DeckOutlineError,
  deckPerimeter,
  longestDeckRunFt,
  overlapArea,
  rectArea,
  type DeckRect,
} from './deck.ts';

const L = 30;
const W = 15;
const POOL: DeckRect = { xFt: 0, yFt: 0, widthFt: L, heightFt: W };

describe('a border is one shape a deck can be', () => {
  it('builds the slab a 4 ft border used to describe', () => {
    expect(deckOutlineFromBorder(L, W, 4)).toEqual({ xFt: -4, yFt: -4, widthFt: 38, heightFt: 23 });
  });

  it('reproduces the old formula exactly when nothing stands in it', () => {
    // (L + 2w)(W + 2w) - LW, the formula this replaces. A job with no attached
    // spa must not see its concrete order move just because the model changed.
    const outline = deckOutlineFromBorder(L, W, 4);
    expect(deckNetArea(outline, [POOL])).toBe((L + 8) * (W + 8) - L * W);
    expect(deckNetArea(outline, [POOL])).toBe(424);
  });
});

describe('what stands in the slab comes out of it', () => {
  it('subtracts an attached spa, which the old formula never did', () => {
    // The bug worth naming. A 6x6 spa attached outside the deep wall stood in
    // the deck band and was counted as concrete, so every job with an attached
    // spa over-ordered by the part of the spa inside the slab.
    //
    // Only 4 of the spa's 6 ft are inside a 4 ft border — it overhangs the slab
    // by 2 ft — so 24 sf comes out, not 36. That is the clipping doing its job,
    // and it is why this is subtracted per-rectangle rather than by footprint.
    const outline = deckOutlineFromBorder(L, W, 4);
    const spa: DeckRect = { xFt: L, yFt: 4.5, widthFt: 6, heightFt: 6 };
    expect(deckNetArea(outline, [POOL, spa])).toBe(424 - 24);
  });

  it('subtracts the whole spa once the slab is drawn past it', () => {
    // Draw the deck out to where a real one would go — around the spa rather
    // than stopping short of it — and the full 36 sf comes out.
    const outline: DeckRect = { xFt: -4, yFt: -4, widthFt: L + 6 + 8, heightFt: W + 8 };
    const spa: DeckRect = { xFt: L, yFt: 4.5, widthFt: 6, heightFt: 6 };
    expect(deckNetArea(outline, [POOL, spa])).toBe(rectArea(outline) - L * W - 36);
  });

  it('clips an obstruction to the slab instead of subtracting all of it', () => {
    // A spa hanging half outside the poured area only removes the half inside.
    // Taking the whole footprint would under-order, which is the expensive way
    // to be wrong.
    const outline: DeckRect = { xFt: 0, yFt: 0, widthFt: 10, heightFt: 10 };
    const halfOut: DeckRect = { xFt: 8, yFt: 0, widthFt: 4, heightFt: 10 };
    expect(overlapArea(outline, halfOut)).toBe(20);
    expect(deckNetArea(outline, [halfOut])).toBe(80);
  });

  it('ignores an obstruction that misses the slab entirely', () => {
    const outline: DeckRect = { xFt: 0, yFt: 0, widthFt: 10, heightFt: 10 };
    expect(deckNetArea(outline, [{ xFt: 40, yFt: 40, widthFt: 5, heightFt: 5 }])).toBe(100);
  });

  it('touching edges do not overlap', () => {
    const a: DeckRect = { xFt: 0, yFt: 0, widthFt: 10, heightFt: 10 };
    expect(overlapArea(a, { xFt: 10, yFt: 0, widthFt: 5, heightFt: 10 })).toBe(0);
  });

  it('never reports negative concrete', () => {
    // An outline smaller than what stands in it means zero deck, not a negative
    // order that would silently reduce a total somewhere downstream.
    const tiny: DeckRect = { xFt: 0, yFt: 0, widthFt: 5, heightFt: 5 };
    expect(deckNetArea(tiny, [POOL])).toBe(0);
    expect(rectArea({ xFt: 0, yFt: 0, widthFt: -4, heightFt: 10 })).toBe(0);
  });
});

describe('a slab has four margins, not one width', () => {
  it('measures each side from the water to the slab edge', () => {
    const wide: DeckRect = { xFt: -4, yFt: -4, widthFt: L + 4 + 14, heightFt: W + 8 };
    expect(deckMargins(wide, L, W)).toEqual({ leftFt: 4, topFt: 4, rightFt: 14, bottomFt: 4 });
  });

  it('drainage uses the longest run, not the entered width', () => {
    // The run the slope has to carry water across. A slab 4 ft on three sides
    // and 14 ft on the fourth used to report the fall for 4 ft, understating it
    // more than threefold — and fall is what decides whether a deck ponds.
    const wide: DeckRect = { xFt: -4, yFt: -4, widthFt: L + 4 + 14, heightFt: W + 8 };
    expect(longestDeckRunFt(wide, L, W)).toBe(14);
    expect(longestDeckRunFt(deckOutlineFromBorder(L, W, 4), L, W)).toBe(4);
  });

  it('measures the perimeter of the slab as drawn', () => {
    expect(deckPerimeter(deckOutlineFromBorder(L, W, 4))).toBe(2 * (38 + 23));
  });
});

describe('a slab that clips the water is refused', () => {
  it('accepts an outline that contains the pool', () => {
    expect(() => assertDeckOutlineContainsPool(deckOutlineFromBorder(L, W, 4), L, W)).not.toThrow();
    // Flush to the coping on every side is legal — a deck can start at the water.
    expect(() => assertDeckOutlineContainsPool({ xFt: 0, yFt: 0, widthFt: L, heightFt: W }, L, W)).not.toThrow();
  });

  it('refuses one that cuts through the pool, and says where', () => {
    expect(() => assertDeckOutlineContainsPool({ xFt: 5, yFt: -4, widthFt: 20, heightFt: 23 }, L, W))
      .toThrow(DeckOutlineError);
    expect(() => assertDeckOutlineContainsPool({ xFt: 5, yFt: -4, widthFt: 20, heightFt: 23 }, L, W))
      .toThrow(/Draw the slab around the water, not through it/);
  });

  it('refuses a zero, negative or non-finite outline', () => {
    expect(() => assertDeckOutlineContainsPool({ xFt: 0, yFt: 0, widthFt: 0, heightFt: 10 }, L, W))
      .toThrow(/positive width and height/);
    expect(() => assertDeckOutlineContainsPool({ xFt: 0, yFt: 0, widthFt: Number.NaN, heightFt: 10 }, L, W))
      .toThrow(/non-finite/);
  });
});
