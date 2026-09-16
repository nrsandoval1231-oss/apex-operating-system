/**
 * The shallow-end ledge preset.
 *
 * The value of a preset is that it opens as buildable geometry. These check the
 * three things that would make it not: the ledge sitting on the spa, the stair
 * sitting on the ledge, and the stair running off the shallow flat onto the
 * slope.
 */
import { describe, expect, it } from 'vitest';
import {
  LUBBOCK_12X24, LUBBOCK_12X24_LEDGE,
  LUBBOCK_15X30, LUBBOCK_15X30_LEDGE,
  LUBBOCK_20X40, LUBBOCK_20X40_LEDGE,
  LUBBOCK_STANDARDS,
} from './jobs/lubbockStandards.ts';
import { seatFootprint, stepFootprint, overlaps } from './placement.ts';
import { runTakeoff } from './index.ts';
import { APEX_STANDARD_DETAIL } from './standardDetail.ts';
import type { Job } from './types.ts';

const CASES: readonly (readonly [string, Job, Job])[] = [
  ['12 x 24', LUBBOCK_12X24_LEDGE, LUBBOCK_12X24],
  ['15 x 30', LUBBOCK_15X30_LEDGE, LUBBOCK_15X30],
  ['20 x 40', LUBBOCK_20X40_LEDGE, LUBBOCK_20X40],
];

describe.each(CASES)('%s with a shallow-end ledge', (_name, job, base) => {
  const L = job.pool.lengthFt;
  const W = job.pool.widthFt;
  const ledge = seatFootprint(job.pool.seats[0]!, L, W);
  const stair = stepFootprint(job.pool.steps[0]!, L, W);

  it('starts the ledge clear of the inset spa', () => {
    // The spa is 6 x 6 in the shallow/house corner. A ledge starting at 0 would
    // be drawn straight through it.
    const spa = { x: 0, y: 0, widthFt: 6, heightFt: 6 };
    expect(overlaps(ledge, spa)).toBe(false);
  });

  it('reaches the far side of the pool', () => {
    expect(ledge.y + ledge.heightFt).toBeCloseTo(W, 6);
  });

  it('puts the stair flush on the ledge edge, not through it', () => {
    expect(overlaps(ledge, stair)).toBe(false);
    expect(stair.x).toBeCloseTo(ledge.x + ledge.widthFt, 6);
  });

  it('matches the stair width to the ledge', () => {
    expect(stair.heightFt).toBeCloseTo(ledge.heightFt, 6);
  });

  it('lands the bottom tread on the shallow flat, not on the slope', () => {
    // The 12 x 24 has only 8 ft of shallow run, so a fixed 5 ft ledge would put
    // the stair on the transition. The ledge depth is sized against the run.
    expect(stair.x + stair.widthFt).toBeLessThanOrEqual(job.pool.profile.shallowRun + 1e-6);
  });

  it('fails no check its own base preset does not already fail', () => {
    /*
     * Every preset opens with a hydraulics and gas stop, and that is by design:
     * pipe run lengths and the gas connected load are per-job measurements, so
     * the presets carry the standard model's placeholders and the sheet says so.
     *
     * The invariant worth protecting is therefore not "no failures" — it is that
     * adding the ledge introduces none. A ledge changes the stair width and the
     * displaced volume, and either could push a check over on its own.
     */
    const withLedge = runTakeoff(job, [APEX_STANDARD_DETAIL]);
    const without = runTakeoff(base, [APEX_STANDARD_DETAIL]);
    expect([...withLedge.codeFailureAreas].sort()).toEqual([...without.codeFailureAreas].sort());
  });

  it('sizes its own deck to its own pool', () => {
    /*
     * The presets used to inherit the 15 x 30 model's slab. On the 20 x 40 that
     * rectangle does not contain the pool, so once the deck gained a
     * containment check the largest preset threw instead of opening.
     */
    const outline = job.deck!.outline;
    expect(outline.xFt).toBeLessThanOrEqual(0);
    expect(outline.yFt).toBeLessThanOrEqual(0);
    expect(outline.xFt + outline.widthFt).toBeGreaterThanOrEqual(L);
    expect(outline.yFt + outline.heightFt).toBeGreaterThanOrEqual(W);
  });
});

describe('every preset opens', () => {
  /*
   * The test that was missing.
   *
   * The 20 x 40 preset threw for a while — it inherited a deck outline sized to
   * a different pool, and the containment check that arrived with the drawn deck
   * turned that from a cosmetic oddity into a refusal. Nothing noticed, because
   * every test opened the 15 x 30 and no test opened the large one.
   *
   * A preset that throws is worse than a preset that is wrong: the app shows an
   * engine error where a pool should be. This runs all six, every time.
   */
  it.each(LUBBOCK_STANDARDS.map((s) => [s.label, s.job] as const))(
    '%s runs a takeoff without throwing',
    (_label, job) => {
      expect(() => runTakeoff(job, [APEX_STANDARD_DETAIL])).not.toThrow();
    },
  );

  it.each(LUBBOCK_STANDARDS.map((s) => [s.label, s.job] as const))(
    '%s has a deck that contains its own pool',
    (_label, job) => {
      const o = job.deck!.outline;
      expect(o.xFt).toBeLessThanOrEqual(0);
      expect(o.yFt).toBeLessThanOrEqual(0);
      expect(o.xFt + o.widthFt).toBeGreaterThanOrEqual(job.pool.lengthFt);
      expect(o.yFt + o.heightFt).toBeGreaterThanOrEqual(job.pool.widthFt);
    },
  );

  it('offers all six: three sizes, each with and without the ledge', () => {
    expect(LUBBOCK_STANDARDS).toHaveLength(6);
    expect(LUBBOCK_STANDARDS.filter((s) => s.label.includes('ledge'))).toHaveLength(3);
  });
});
