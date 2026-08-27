/**
 * Sheet rotation.
 *
 * The load-bearing test in this file is the round trip: the transform string the
 * renderer emits and the inverse the drag handler uses are checked against each
 * other by actually applying the SVG transform, not by asserting each one
 * separately against a number someone worked out by hand. Two hand-derived
 * matrices that disagree is exactly the bug that would present as "the object
 * jumps somewhere else when the plan is rotated", and it would be invisible in
 * any test that only looked at one of them.
 */

import { describe, expect, it } from 'vitest';
import {
  contentTransform,
  inverseContentPoint,
  normalizeTurns,
  rotatedExtentFt,
  rotatedSize,
  rotationDegrees,
  rotationLabel,
  swapsAxes,
  textTransform,
  type PointPx,
  type QuarterTurns,
  type SizePx,
} from './planRotation.ts';

const SIZE: SizePx = { widthPx: 800, heightPx: 500 };
const TURNS: readonly QuarterTurns[] = [0, 1, 2, 3];

/**
 * Apply an SVG transform list of the exact shape `contentTransform` produces.
 *
 * Deliberately a real parser over the emitted string rather than a second copy
 * of the matrix arithmetic: if the string is malformed, or the translate and
 * rotate land in the wrong order, this notices. A reimplementation would agree
 * with the bug.
 */
function applyTransform(transform: string, point: PointPx): PointPx {
  if (transform === '') return point;
  const ops = [...transform.matchAll(/(translate|rotate)\(([^)]*)\)/g)];
  // SVG composes left to right as matrices, which means the RIGHTMOST operation
  // is applied to the point first.
  return ops.reduceRight((p, [, op, argText]) => {
    const args = argText!.trim().split(/[\s,]+/).map(Number);
    if (op === 'translate') return { x: p.x + args[0]!, y: p.y + (args[1] ?? 0) };
    // rotate takes either one argument (about the origin) or three (about a
    // named centre, which is what the label counter-rotation uses).
    const [angle, cx = 0, cy = 0] = args as [number, number?, number?];
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  }, point);
}

const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6);

describe('counting turns', () => {
  it('folds any integer onto 0..3, so "rotate right" can add forever', () => {
    expect(normalizeTurns(0)).toBe(0);
    expect(normalizeTurns(4)).toBe(0);
    expect(normalizeTurns(7)).toBe(3);
    expect(normalizeTurns(-1)).toBe(3);
    expect(normalizeTurns(-8)).toBe(0);
  });

  it('collapses corrupt stored values to unrotated rather than throwing', () => {
    // This value comes back from localStorage, where anything can be written.
    // An unrotated plan is a recoverable state; a crash on load is not.
    expect(normalizeTurns(Number.NaN)).toBe(0);
    expect(normalizeTurns(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeTurns(1.7)).toBe(1);
  });

  it('reports degrees and which turns swap the axes', () => {
    expect(TURNS.map(rotationDegrees)).toEqual([0, 90, 180, 270]);
    expect(TURNS.map(swapsAxes)).toEqual([false, true, false, true]);
  });
});

describe('the sheet changes shape', () => {
  it('swaps width and height on the quarter turns and not on the half', () => {
    expect(rotatedSize(0, SIZE)).toEqual({ widthPx: 800, heightPx: 500 });
    expect(rotatedSize(1, SIZE)).toEqual({ widthPx: 500, heightPx: 800 });
    expect(rotatedSize(2, SIZE)).toEqual({ widthPx: 800, heightPx: 500 });
    expect(rotatedSize(3, SIZE)).toEqual({ widthPx: 500, heightPx: 800 });
  });

  it('swaps the foot extents too, which is what the print scale reads', () => {
    // A 48 ft drawing that will not fit landscape at any standard scale may fit
    // once turned. If this swap were missing, rotation would change the picture
    // and not the scale it prints at — which is most of the point of rotating.
    expect(rotatedExtentFt(1, 48, 26)).toEqual({ contentWidthFt: 26, contentHeightFt: 48 });
    expect(rotatedExtentFt(2, 48, 26)).toEqual({ contentWidthFt: 48, contentHeightFt: 26 });
  });
});

describe('the drawing lands on the sheet', () => {
  it('maps the content box onto the rotated box, corner at the origin', () => {
    for (const turns of TURNS) {
      const transform = contentTransform(turns, SIZE);
      const out = rotatedSize(turns, SIZE);
      const corners: PointPx[] = [
        { x: 0, y: 0 },
        { x: SIZE.widthPx, y: 0 },
        { x: SIZE.widthPx, y: SIZE.heightPx },
        { x: 0, y: SIZE.heightPx },
      ].map((corner) => applyTransform(transform, corner));

      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      near(Math.min(...xs), 0);
      near(Math.min(...ys), 0);
      near(Math.max(...xs), out.widthPx);
      near(Math.max(...ys), out.heightPx);
    }
  });

  it('emits nothing at all when the plan is not rotated', () => {
    // An unrotated sheet must produce byte-identical markup to before rotation
    // existed, or every drawing in the repository changes to add a feature
    // nobody used.
    expect(contentTransform(0, SIZE)).toBe('');
    expect(textTransform(0, { x: 10, y: 20 })).toBe('');
  });
});

describe('a drag maps through the inverse', () => {
  it('undoes the transform exactly, at every turn', () => {
    const samples: PointPx[] = [
      { x: 0, y: 0 },
      { x: 800, y: 500 },
      { x: 123.5, y: 47.25 },
      { x: 799.99, y: 0.01 },
      { x: 400, y: 250 },
    ];
    for (const turns of TURNS) {
      const transform = contentTransform(turns, SIZE);
      for (const point of samples) {
        // Forward: where the renderer puts this layout point on the rotated
        // sheet. Inverse: what the drag handler recovers from that position.
        const onSheet = applyTransform(transform, point);
        const back = inverseContentPoint(turns, onSheet, SIZE);
        near(back.x, point.x);
        near(back.y, point.y);
      }
    }
  });

  it('sends the sheet corner to the layout corner it came from', () => {
    // Spot-checks with the answer written out, so a sign error cannot hide
    // behind a round trip that is self-consistently wrong in both directions.
    expect(inverseContentPoint(1, { x: 0, y: 0 }, SIZE)).toEqual({ x: 0, y: 500 });
    expect(inverseContentPoint(2, { x: 0, y: 0 }, SIZE)).toEqual({ x: 800, y: 500 });
    expect(inverseContentPoint(3, { x: 0, y: 0 }, SIZE)).toEqual({ x: 800, y: 0 });
  });
});

describe('labels stay readable', () => {
  it('counter-rotates each label about its own anchor', () => {
    expect(textTransform(1, { x: 100, y: 40 })).toBe(' transform="rotate(-90 100 40)"');
    expect(textTransform(2, { x: 100, y: 40 })).toBe(' transform="rotate(-180 100 40)"');
    expect(textTransform(3, { x: 100, y: 40 })).toBe(' transform="rotate(-270 100 40)"');
  });

  it('leaves text horizontal at every turn, and leaves its anchor alone', () => {
    const anchor: PointPx = { x: 260, y: 130 };
    for (const turns of TURNS) {
      const group = contentTransform(turns, SIZE);
      const counter = textTransform(turns, anchor).replace(/^ transform="|"$/g, '');

      // The anchor must not move: the label has to stay where the drawing put
      // it, only turned. Rotating about the anchor is what guarantees that.
      const anchorOnSheet = applyTransform(group, anchor);
      const anchorWithCounter = applyTransform(group, applyTransform(counter, anchor));
      near(anchorWithCounter.x, anchorOnSheet.x);
      near(anchorWithCounter.y, anchorOnSheet.y);

      // A point one unit to the right of the anchor in text space must still be
      // one unit to the right on the sheet — that is what "horizontal" means,
      // and it is the assertion that would fail if the counter-rotation had the
      // wrong sign.
      const rightOfAnchor = { x: anchor.x + 1, y: anchor.y };
      const rightOnSheet = applyTransform(group, applyTransform(counter, rightOfAnchor));
      near(rightOnSheet.x - anchorWithCounter.x, 1);
      near(rightOnSheet.y - anchorWithCounter.y, 0);
    }
  });
});

describe('what the sheet is called', () => {
  it('names the rotation rather than showing a bare number', () => {
    expect(rotationLabel(0)).toBe('North up');
    expect(rotationLabel(1)).toBe('Rotated 90°');
    expect(rotationLabel(3)).toBe('Rotated 270°');
  });
});
