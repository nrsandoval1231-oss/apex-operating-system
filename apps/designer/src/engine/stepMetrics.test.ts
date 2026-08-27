/**
 * Step and bench measurements.
 *
 * These print on the sheet and get read in the field, so the arithmetic is
 * pinned. Total rise in particular is summed from the risers rather than taken
 * from the water depth — the two are different measurements and the difference
 * is the freeboard.
 */

import { describe, expect, it } from 'vitest';
import { seatMetrics, stepMetrics } from './stepMetrics.ts';
import { STANDARD_MODEL } from './standardModel.ts';

const step = stepMetrics(STANDARD_MODEL.pool.steps[0]!);
const seat = seatMetrics(STANDARD_MODEL.pool.seats[0]!);

describe('stairs', () => {
  it('sums the risers to the full floor-to-deck rise', () => {
    // 8 + 10 + 10 + 10 + 10 = 48 in = 4 ft. The water is 3'-6" deep, and the
    // 6 in difference is the freeboard — so this must NOT equal floorDepthFt.
    expect(step.totalRiseFt).toBeCloseTo(4, 6);
    expect(step.totalRiseFt).not.toBeCloseTo(step.floorDepthFt, 6);
  });

  it('reports the tallest riser, which is what the code limit applies to', () => {
    expect(step.maxRiserIn).toBe(10);
  });

  it('measures how far the stair projects into the pool', () => {
    // 4 treads at 12 in.
    expect(step.totalRunFt).toBeCloseTo(4, 6);
  });

  it('gives tread area and leading edge for the finish takeoff', () => {
    // 12 in run x 72 in width x 4 treads = 1 x 6 x 4 = 24 sf.
    expect(step.treadAreaSf).toBeCloseTo(24, 6);
    expect(step.leadingEdgeFt).toBeCloseTo(24, 6);
  });

  it('keeps the risers bottom first, the order the code text uses', () => {
    expect(step.riserHeightsIn[0]).toBe(8);
  });

  it('does not invent a riser for a stair that has none', () => {
    const bare = stepMetrics({ ...STANDARD_MODEL.pool.steps[0]!, riserHeightsIn: [] });
    expect(bare.totalRiseFt).toBe(0);
    expect(bare.maxRiserIn).toBe(0);
  });
});

describe('benches', () => {
  it('reports how high the ledge stands off the floor', () => {
    // Floor at 4'-6", surface 18 in below the waterline: the ledge stands 3 ft.
    expect(seat.heightAboveFloorFt).toBeCloseTo(3, 6);
  });

  it('gives the surface area from its own dimensions', () => {
    // 16 in x 96 in = 1.333 x 8 = 10.67 sf.
    expect(seat.surfaceAreaSf).toBeCloseTo(10.667, 2);
  });
});
