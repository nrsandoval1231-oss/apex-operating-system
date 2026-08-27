/**
 * Placement geometry.
 *
 * This is the arithmetic behind the move tool. A pointer is tested against the
 * rectangle these functions produce and the drawing is rendered from the same
 * one, so an error here shows up as an object that does not sit where it was
 * dropped — which reads as the tool being broken rather than as a bug in a
 * formula.
 */

import { describe, expect, it } from 'vitest';
import {
  alongFromPoint,
  clampAlong,
  nearestWall,
  overlaps,
  placementRect,
  resolveDrag,
  wallLengthFt,
} from './placement.ts';

const L = 30;
const W = 15;

describe('which way a wall runs', () => {
  it('end walls run across the width, side walls along the length', () => {
    expect(wallLengthFt('shallow', L, W)).toBe(W);
    expect(wallLengthFt('deep', L, W)).toBe(W);
    expect(wallLengthFt('top', L, W)).toBe(L);
    expect(wallLengthFt('bottom', L, W)).toBe(L);
  });
});

describe('the rectangle an object occupies', () => {
  it('projects inward from the wall it is on', () => {
    expect(placementRect({ wall: 'shallow', alongFt: 4 }, 6, 5, L, W))
      .toEqual({ x: 0, y: 4, widthFt: 5, heightFt: 6 });
    // From the deep wall, inward means back toward the shallow end, so the
    // rectangle starts at L minus its own projection rather than at L.
    expect(placementRect({ wall: 'deep', alongFt: 4 }, 6, 5, L, W))
      .toEqual({ x: 25, y: 4, widthFt: 5, heightFt: 6 });
    expect(placementRect({ wall: 'bottom', alongFt: 10 }, 6, 2, L, W))
      .toEqual({ x: 10, y: 13, widthFt: 6, heightFt: 2 });
  });

  it('projects outward for a spa, which is added to the pool rather than cut from it', () => {
    expect(placementRect({ wall: 'deep', alongFt: 4 }, 6, 6, L, W, true))
      .toEqual({ x: 30, y: 4, widthFt: 6, heightFt: 6 });
    expect(placementRect({ wall: 'top', alongFt: 8 }, 6, 6, L, W, true))
      .toEqual({ x: 8, y: -6, widthFt: 6, heightFt: 6 });
  });

  it('clamps the position so an object cannot slide off its own wall', () => {
    // 6 ft object on a 15 ft wall: the far edge cannot pass 9 ft.
    expect(placementRect({ wall: 'shallow', alongFt: 99 }, 6, 5, L, W).y).toBe(9);
    expect(placementRect({ wall: 'shallow', alongFt: -99 }, 6, 5, L, W).y).toBe(0);
  });
});

describe('clamping', () => {
  it('keeps an object between the corners', () => {
    expect(clampAlong(-5, 6, 'bottom', L, W)).toBe(0);
    expect(clampAlong(40, 6, 'bottom', L, W)).toBe(24);
    expect(clampAlong(12, 6, 'bottom', L, W)).toBe(12);
  });

  it('pins an object wider than its wall at zero rather than going negative', () => {
    // A 20 ft bench on a 15 ft end wall does not fit. Pinning it at 0 draws it
    // overhanging, which is true; a negative position would slide it somewhere
    // it appears to fit and hide the problem.
    expect(clampAlong(5, 20, 'shallow', L, W)).toBe(0);
  });

  it('treats a non-finite position as the corner rather than producing NaN', () => {
    expect(clampAlong(Number.NaN, 6, 'bottom', L, W)).toBe(0);
  });
});

describe('turning a pointer into a position', () => {
  it('reads the axis the wall runs along', () => {
    expect(alongFromPoint('shallow', 3, 7)).toBe(7);
    expect(alongFromPoint('deep', 3, 7)).toBe(7);
    expect(alongFromPoint('top', 3, 7)).toBe(3);
    expect(alongFromPoint('bottom', 3, 7)).toBe(3);
  });

  it('picks the wall a point is nearest, so a drag can turn a corner', () => {
    expect(nearestWall(1, 7, L, W)).toBe('shallow');
    expect(nearestWall(29, 7, L, W)).toBe('deep');
    expect(nearestWall(15, 1, L, W)).toBe('top');
    expect(nearestWall(15, 14, L, W)).toBe('bottom');
  });
});

describe('resolving a drag', () => {
  const base = {
    grabOffsetFt: 2,
    spanFt: 4,
    poolLengthFt: L,
    poolWidthFt: W,
  };

  it('slides along the wall it is already on', () => {
    const next = resolveDrag({
      ...base,
      current: { wall: 'bottom', alongFt: 18 },
      pointXFt: 10,
      pointYFt: 14.5,
    });
    // Grabbed 2 ft in from the near edge, so the edge lands 2 ft behind the
    // pointer. The object must not jump its own offset to the cursor.
    expect(next).toEqual({ wall: 'bottom', alongFt: 8 });
  });

  it('keeps the object on its wall near a corner rather than flickering', () => {
    // Pointer is slightly nearer the deep wall, but not by the margin.
    const next = resolveDrag({
      ...base,
      current: { wall: 'bottom', alongFt: 24 },
      pointXFt: 28.5,
      pointYFt: 13,
    });
    expect(next.wall).toBe('bottom');
  });

  it('crosses to another wall once the pointer is clearly nearer it', () => {
    const next = resolveDrag({
      ...base,
      current: { wall: 'bottom', alongFt: 24 },
      pointXFt: 29.5,
      pointYFt: 6,
    });
    expect(next.wall).toBe('deep');
  });

  it('centres on the pointer when it turns a corner', () => {
    // "Along" changes axis at a corner, so the old grab offset is meaningless.
    // Centring is the least surprising thing to do: a 4 ft object dropped at
    // y = 6 spans 4..8.
    const next = resolveDrag({
      ...base,
      current: { wall: 'bottom', alongFt: 24 },
      pointXFt: 29.5,
      pointYFt: 6,
    });
    expect(next).toEqual({ wall: 'deep', alongFt: 4 });
  });

  it('never returns a position that runs off the wall', () => {
    const past = resolveDrag({
      ...base,
      current: { wall: 'bottom', alongFt: 20 },
      pointXFt: 999,
      pointYFt: 14.5,
    });
    expect(past.alongFt).toBe(L - base.spanFt);
    const before = resolveDrag({
      ...base,
      current: { wall: 'bottom', alongFt: 4 },
      pointXFt: -999,
      pointYFt: 14.5,
    });
    expect(before.alongFt).toBe(0);
  });

  it('snaps to the half inch, because nobody builds to a pixel', () => {
    const next = resolveDrag({
      ...base,
      current: { wall: 'bottom', alongFt: 10 },
      pointXFt: 12.3456789,
      pointYFt: 14.5,
    });
    expect(next.alongFt * 24).toBe(Math.round(next.alongFt * 24));
  });
});

describe('overlap', () => {
  it('detects two objects sharing space', () => {
    const a = { x: 0, y: 0, widthFt: 5, heightFt: 5 };
    expect(overlaps(a, { x: 4, y: 4, widthFt: 5, heightFt: 5 })).toBe(true);
    expect(overlaps(a, { x: 6, y: 0, widthFt: 5, heightFt: 5 })).toBe(false);
  });

  it('does not count touching edges as overlapping', () => {
    // A bench built right up against the steps is buildable and common.
    const a = { x: 0, y: 0, widthFt: 5, heightFt: 5 };
    expect(overlaps(a, { x: 5, y: 0, widthFt: 5, heightFt: 5 })).toBe(false);
  });
});
