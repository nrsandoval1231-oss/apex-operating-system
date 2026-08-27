/**
 * Resize and section-drag rules.
 *
 * These decide what a wall drag or a floor drag is allowed to produce. Every
 * clamp here is the difference between a drag that can only make buildable
 * pools and one that can hand the geometry engine an impossible profile.
 */

import { describe, expect, it } from 'vitest';
import { fitProfileToLength, resizePool, resolveSectionDrag } from './poolResize.ts';
import { STANDARD_MODEL } from './standardModel.ts';

const profile = STANDARD_MODEL.pool.profile; // 10 / 14 / 6 on a 30 ft pool

describe('fitting the profile to a new length', () => {
  it('absorbs growth and shrinkage in the deep flat first', () => {
    expect(fitProfileToLength(profile, 36).deepRun).toBe(12);
    expect(fitProfileToLength(profile, 26).deepRun).toBe(2);
  });

  it('gives up the transition next, and the shallow flat last', () => {
    // 20 ft: deep flat gone, transition cut from 14 to 10.
    expect(fitProfileToLength(profile, 20)).toMatchObject({
      shallowRun: 10, transitionRun: 10, deepRun: 0,
    });
    // 6 ft below even the shallow flat: shallow takes what is left.
    expect(fitProfileToLength(profile, 6)).toMatchObject({
      shallowRun: 6, transitionRun: 0, deepRun: 0,
    });
  });

  it('always sums to the length it was fitted to', () => {
    for (const L of [10, 17.5, 24, 30, 41, 80]) {
      const p = fitProfileToLength(profile, L);
      expect(p.shallowRun + p.transitionRun + p.deepRun).toBeCloseTo(L, 6);
    }
  });
});

describe('resizing by wall drag', () => {
  it('snaps to the half foot and keeps the profile summing to the length', () => {
    const next = resizePool(STANDARD_MODEL, 'deep', 34.26);
    expect(next.pool.lengthFt).toBe(34.5);
    const p = next.pool.profile;
    expect(p.shallowRun + p.transitionRun + p.deepRun).toBeCloseTo(34.5, 6);
  });

  it('refuses to make a pool absurdly small or large', () => {
    expect(resizePool(STANDARD_MODEL, 'deep', 2).pool.lengthFt).toBe(10);
    expect(resizePool(STANDARD_MODEL, 'deep', 500).pool.lengthFt).toBe(80);
    expect(resizePool(STANDARD_MODEL, 'bottom', 1).pool.widthFt).toBe(8);
  });

  it('will not drag the pool narrower than an inset spa', () => {
    const withInset = {
      ...STANDARD_MODEL,
      spa: { ...STANDARD_MODEL.spa!, insetIntoPool: true },
    };
    // 6 ft spa + 2 ft of pool beside it.
    expect(resizePool(withInset, 'bottom', 5).pool.widthFt).toBe(8);
    const narrowSpa = {
      ...withInset,
      spa: { ...withInset.spa!, widthFt: 8 },
    };
    expect(resizePool(narrowSpa, 'bottom', 5).pool.widthFt).toBe(10);
  });

  it('ignores a non-finite target rather than corrupting the job', () => {
    expect(resizePool(STANDARD_MODEL, 'deep', Number.NaN)).toBe(STANDARD_MODEL);
  });
});

describe('dragging the section', () => {
  it('moves the shallow floor, snapped to 3", never below the deep floor', () => {
    expect(resolveSectionDrag(profile, 30, 'shallow-floor', 0, 4.1).shallowDepth).toBe(4);
    expect(resolveSectionDrag(profile, 30, 'shallow-floor', 0, 9).shallowDepth).toBe(6);
    expect(resolveSectionDrag(profile, 30, 'shallow-floor', 0, 0.2).shallowDepth).toBe(1);
  });

  it('moves the deep floor, never above the shallow floor', () => {
    expect(resolveSectionDrag(profile, 30, 'deep-floor', 0, 8.13).deepDepth).toBe(8.25);
    expect(resolveSectionDrag(profile, 30, 'deep-floor', 0, 2).deepDepth).toBe(3.5);
  });

  it('drags the breakover without moving the deep-floor station', () => {
    const next = resolveSectionDrag(profile, 30, 'breakover', 13.3, 0);
    expect(next.shallowRun).toBe(13.5);
    expect(next.shallowRun + next.transitionRun).toBe(24);
  });

  it('drags the deep-floor station and lets the deep run absorb it', () => {
    const next = resolveSectionDrag(profile, 30, 'deep-start', 27.7, 0);
    expect(next).toMatchObject({ shallowRun: 10, transitionRun: 17.5, deepRun: 2.5 });
  });

  it('keeps the stations in order at the extremes', () => {
    const left = resolveSectionDrag(profile, 30, 'breakover', -5, 0);
    expect(left.shallowRun).toBe(0);
    const right = resolveSectionDrag(profile, 30, 'deep-start', 99, 0);
    expect(right.deepRun).toBe(0);
    expect(right.transitionRun).toBe(20);
  });
});
