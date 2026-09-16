import { describe, expect, it } from 'vitest';
import { computeGeometry } from './geometry.ts';
import { runTakeoff } from './index.ts';
import { computeExcavation } from './excavation.ts';
import { parseJob, serializeJob } from './jobFile.ts';
import {
  averageFloorDepthUnder,
  depthAtStation,
  floorDepthUnder,
  sportsPoolProfile,
} from './profile.ts';
import { renderPlanView } from './planView.ts';
import { renderSectionView } from './sectionView.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const job: Job = {
  ...STANDARD_MODEL,
  name: 'Sports pool 3-5-3',
  spa: undefined,
  pool: {
    ...STANDARD_MODEL.pool,
    lengthFt: 40,
    profile: sportsPoolProfile(40),
    steps: [],
    seats: [],
  },
};

describe('sports pool 3-5-3 profile', () => {
  it('has shallow flats at both ends and a five-foot middle', () => {
    expect(depthAtStation(job.pool.profile, 0)).toBe(3);
    expect(depthAtStation(job.pool.profile, 8)).toBe(3);
    expect(depthAtStation(job.pool.profile, 20)).toBe(5);
    expect(depthAtStation(job.pool.profile, 32)).toBe(3);
    expect(depthAtStation(job.pool.profile, 40)).toBe(3);
  });

  it('integrates the 3-5-3 section exactly and symmetrically', () => {
    const geometry = computeGeometry(job);
    // 8x3 + 8x4 + 8x5 + 8x4 + 8x3 = 152 sf.
    expect(geometry.poolSectionArea.value).toBeCloseTo(152, 8);
    expect(geometry.poolGrossVolumeCf.value).toBeCloseTo(152 * job.pool.widthFt, 8);
    expect(averageFloorDepthUnder(job.pool.profile, 4, 16))
      .toBeCloseTo(averageFloorDepthUnder(job.pool.profile, 24, 36), 8);
  });

  it('finds the deepest point anywhere under an object, including either slope', () => {
    expect(floorDepthUnder(job.pool.profile, 10, 15)).toBeCloseTo(4.75, 8);
    expect(floorDepthUnder(job.pool.profile, 25, 30)).toBeCloseTo(4.75, 8);
  });

  it('gives mirrored objects on both slopes identical displacement', () => {
    const seat = { ...STANDARD_MODEL.pool.seats[0]!, surfaceDepthIn: 24, surfaceWidthIn: 48 };
    const left = computeGeometry({
      ...job,
      pool: { ...job.pool, seats: [{ ...seat, position: { xFt: 8, yFt: 0 } }] },
    });
    const right = computeGeometry({
      ...job,
      pool: { ...job.pool, seats: [{ ...seat, position: { xFt: 28, yFt: 0 } }] },
    });
    expect(left.seatDisplacement[0]!.value).toBeCloseTo(right.seatDisplacement[0]!.value, 8);
  });

  it('uses the same station segments for layered excavation', () => {
    const geometry = computeGeometry(job);
    const excavation = computeExcavation(
      job,
      geometry.segments,
      geometry.totalVolumeCf.value,
      geometry.totalWettedArea.value,
    );
    expect(excavation.totalBankCy.value).toBeGreaterThan(0);
    expect(geometry.segments).toHaveLength(5);
  });

  it('draws and labels both shallow ends and the deep middle', () => {
    const section = renderSectionView(job).svg;
    const plan = renderPlanView(job).svg;
    expect(section).toContain(`3'-0\"`);
    expect(section).toContain(`5'-0\"`);
    expect(section).toContain('middle deep');
    expect(plan.match(/3'-0\" deep/g)).toHaveLength(2);
    expect(plan).toContain(`5'-0\" deep`);
  });

  it('round-trips stations through the saved job format', () => {
    const parsed = parseJob(serializeJob(job));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.job.pool.profile).toEqual(job.pool.profile);
    expect(computeGeometry(parsed.job).poolGrossVolumeCf.value)
      .toBe(computeGeometry(job).poolGrossVolumeCf.value);
  });
});

describe('legacy profile migration', () => {
  it('converts the old three-run record without changing quantities', () => {
    const legacyFile = JSON.parse(serializeJob(STANDARD_MODEL)) as { apexDesignerJob: number };
    legacyFile.apexDesignerJob = 2;
    const parsed = parseJob(JSON.stringify(legacyFile));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.job.pool.profile.kind).toBe('linear-stations');
    expect(computeGeometry(parsed.job).poolGrossVolumeCf.value)
      .toBeCloseTo(computeGeometry(STANDARD_MODEL).poolGrossVolumeCf.value, 8);
    const before = runTakeoff(STANDARD_MODEL);
    const after = runTakeoff(parsed.job);
    expect(after.geometry.totalVolumeGal.value).toBeCloseTo(before.geometry.totalVolumeGal.value, 8);
    expect(after.geometry.totalWettedArea.value).toBeCloseTo(before.geometry.totalWettedArea.value, 8);
    expect(after.excavation.totalBankCy.value).toBeCloseTo(before.excavation.totalBankCy.value, 8);
  });
});
