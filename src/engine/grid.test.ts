/**
 * Free placement on the grid.
 *
 * The thing worth protecting here is that freedom did not cost symmetry. A spa
 * dragged near the middle of the pool must land exactly in the middle, not
 * nearly — "nearly centred" is the failure this whole module exists to prevent.
 */

import { describe, expect, it } from 'vitest';
import {
  GRID_FT,
  MAGNET_RANGE_FT,
  magnets,
  snapPoint,
  snapToGrid,
  snapWithMagnets,
  clampWithin,
} from './grid.ts';

const L = 30;
const W = 15;
const SPA = 6;

describe('the lattice', () => {
  it('rounds to the nearest six inches', () => {
    expect(snapToGrid(3.2)).toBe(3);
    expect(snapToGrid(3.3)).toBe(3.5);
    expect(snapToGrid(-0.2)).toBe(-0);
    expect(GRID_FT).toBe(0.5);
  });

  it('collapses a non-finite coordinate rather than propagating NaN', () => {
    // A drag that loses its coordinate mapping used to put objects at NaN, which
    // the clamp then turned into a silent jump to the corner.
    expect(snapToGrid(Number.NaN)).toBe(0);
    expect(snapPoint({ xFt: Number.NaN, yFt: 4 })).toEqual({ xFt: 0, yFt: 4 });
  });

  it('snaps both axes independently', () => {
    expect(snapPoint({ xFt: 4.24, yFt: -2.4 })).toEqual({ xFt: 4, yFt: -2.5 });
  });
});

describe('the positions symmetry cares about', () => {
  const all = magnets(SPA, SPA, L, W);

  it('offers the four outside corners, the four inside corners, four wall centres and the pool centre', () => {
    expect(all).toHaveLength(13);
    expect(all.map((m) => m.id)).toContain('pool-centre');
    expect(all.filter((m) => m.id.startsWith('corner-out-'))).toHaveLength(4);
    expect(all.filter((m) => m.id.startsWith('corner-in-'))).toHaveLength(4);
  });

  it('puts the pool centre where the object is actually centred', () => {
    const centre = all.find((m) => m.id === 'pool-centre')!;
    // Top-left anchor, so the object's own size comes off it.
    expect(centre.at).toEqual({ xFt: (L - SPA) / 2, yFt: (W - SPA) / 2 });
    // The check that matters: the object's midpoint equals the pool's midpoint.
    expect(centre.at.xFt + SPA / 2).toBe(L / 2);
    expect(centre.at.yFt + SPA / 2).toBe(W / 2);
  });

  it('tucks an outside corner clear of the water on both axes', () => {
    const corner = all.find((m) => m.id === 'corner-out-deep-yard')!;
    expect(corner.at).toEqual({ xFt: L, yFt: W });
  });

  it('sits a wall-centre magnet flush against that wall and centred on it', () => {
    const deep = all.find((m) => m.id === 'centre-deep')!;
    expect(deep.at.xFt).toBe(L);
    expect(deep.at.yFt + SPA / 2).toBe(W / 2);
  });
});

describe('where a drag lands', () => {
  it('lands exactly centred when dropped near the middle, not nearly centred', () => {
    // The whole point. Off by a few inches in both axes, and it still lands on
    // the exact centre rather than on the nearest lattice point.
    const near = { xFt: (L - SPA) / 2 + 0.4, yFt: (W - SPA) / 2 - 0.3 };
    const result = snapWithMagnets(near, SPA, SPA, L, W);
    expect(result.magnet?.id).toBe('pool-centre');
    expect(result.at).toEqual({ xFt: 12, yFt: 4.5 });
  });

  it('names the magnet, so the tool can say why it stopped there', () => {
    const result = snapWithMagnets({ xFt: L + 0.3, yFt: W - 0.2 }, SPA, SPA, L, W);
    expect(result.magnet?.id).toBe('corner-out-deep-yard');
    expect(result.magnet?.label).toBe('outside the deep/yard corner');
  });

  it('falls back to the grid once clear of every magnet', () => {
    const result = snapWithMagnets({ xFt: 7.3, yFt: -9.4 }, SPA, SPA, L, W);
    expect(result.magnet).toBeNull();
    expect(result.at).toEqual({ xFt: 7.5, yFt: -9.5 });
  });

  it('takes the nearest magnet when two are in range', () => {
    // Inside and outside the same corner are close together on a small pool, so
    // the tie has to be broken by distance rather than by declaration order.
    const nearInside = { xFt: 0.2, yFt: 0.2 };
    expect(snapWithMagnets(nearInside, SPA, SPA, L, W).magnet?.id).toBe('corner-in-shallow-house');
  });

  it('measures the magnet against the raw pointer, not the snapped one', () => {
    // Snapping first would quantise the distance and make a magnet either
    // unreachable or sticky depending on where it fell between lattice points.
    const justOutOfRange = { xFt: (L - SPA) / 2 + MAGNET_RANGE_FT + 0.05, yFt: (W - SPA) / 2 };
    expect(snapWithMagnets(justOutOfRange, SPA, SPA, L, W).magnet).toBeNull();
    const justInRange = { xFt: (L - SPA) / 2 + MAGNET_RANGE_FT - 0.05, yFt: (W - SPA) / 2 };
    expect(snapWithMagnets(justInRange, SPA, SPA, L, W).magnet?.id).toBe('pool-centre');
  });

  it('survives a lost coordinate mapping instead of placing at NaN', () => {
    expect(snapWithMagnets({ xFt: Number.NaN, yFt: 3 }, SPA, SPA, L, W))
      .toEqual({ at: { xFt: 0, yFt: 0 }, magnet: null });
  });

  it('lets a bubbler reach anywhere, including well outside the water', () => {
    // A bubbler used to be pinned to a wall. It belongs wherever the ledge is,
    // and a deck jet belongs out on the deck.
    const result = snapWithMagnets({ xFt: -6.2, yFt: 22.1 }, 1, 1, L, W);
    expect(result.magnet).toBeNull();
    expect(result.at).toEqual({ xFt: -6, yFt: 22 });
  });
});

describe('an inset spa stays in the water', () => {
  it('holds the object inside the pool on both axes', () => {
    expect(clampWithin({ xFt: -3, yFt: -4 }, SPA, SPA, L, W)).toEqual({ xFt: 0, yFt: 0 });
    expect(clampWithin({ xFt: 99, yFt: 99 }, SPA, SPA, L, W)).toEqual({ xFt: L - SPA, yFt: W - SPA });
    expect(clampWithin({ xFt: 7, yFt: 3 }, SPA, SPA, L, W)).toEqual({ xFt: 7, yFt: 3 });
  });

  it('is a correctness constraint, not a nicety', () => {
    // insetIntoPool tells the excavation engine the spa needs no cut outside the
    // pool envelope. Drawn on the deck while flagged inset, it would report
    // quantities for a pool nobody is building.
    const outOnTheDeck = clampWithin({ xFt: -10, yFt: W + 5 }, SPA, SPA, L, W);
    expect(outOnTheDeck.xFt).toBeGreaterThanOrEqual(0);
    expect(outOnTheDeck.yFt + SPA).toBeLessThanOrEqual(W);
  });

  it('pins to the origin when the object is larger than the pool', () => {
    // No valid position exists, so it goes to the corner and the drawing shows
    // it overhanging — the truth — rather than being placed somewhere it fits.
    expect(clampWithin({ xFt: 5, yFt: 5 }, 99, 99, L, W)).toEqual({ xFt: 0, yFt: 0 });
  });
});
