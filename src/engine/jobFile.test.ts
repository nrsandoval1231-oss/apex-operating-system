/**
 * Job save / load.
 *
 * The file format is the one place a job can be corrupted between sessions, so
 * these tests are mostly about what survives a round trip and what is refused.
 */

import { describe, expect, it } from 'vitest';
import { JOB_FILE_VERSION, jobFileName, parseJob, serializeJob, validateJob } from './jobFile.ts';
import { runTakeoff } from './index.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const roundTrip = (job: Job): Job => {
  const r = parseJob(serializeJob(job));
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.job;
};

describe('round trip', () => {
  const back = roundTrip(STANDARD_MODEL);

  it('preserves the geometry', () => {
    expect(back.pool.lengthFt).toBe(30);
    expect(back.pool.widthFt).toBe(15);
    expect(back.pool.profile).toEqual(STANDARD_MODEL.pool.profile);
  });

  it('preserves steps and seats, including the leading-edge lengths', () => {
    expect(back.pool.steps).toEqual(STANDARD_MODEL.pool.steps);
    expect(back.pool.seats).toEqual(STANDARD_MODEL.pool.seats);
  });

  it('keeps Infinity on the bottom soil layer, which JSON would turn into null', () => {
    const bottom = back.excavation.soilLayers[back.excavation.soilLayers.length - 1]!;
    expect(bottom.thicknessFt).toBe(Infinity);
    // And the naive round trip really would have broken it.
    expect(JSON.parse(JSON.stringify({ t: Infinity })).t).toBeNull();
  });

  it('re-resolves the pump from the catalogue instead of embedding its curves', () => {
    expect(back.hydraulics?.pumpModel?.id).toBe('SP32900VSPX1');
    expect(back.hydraulics?.pumpModel?.curves?.length).toBe(5);
    // The file carries an id, not the curves. (headFt does appear in the file,
    // but as the filter/heater equipment losses, which are job inputs.)
    const text = serializeJob(STANDARD_MODEL);
    expect(text).toContain('"pumpModelId": "SP32900VSPX1"');
    expect(text).not.toContain('"curves"');
    expect(text).not.toContain('LITTS90095026');
    expect(text).toContain('"equipmentLosses"');
  });

  it('produces the same takeoff after a round trip', () => {
    const before = runTakeoff(STANDARD_MODEL);
    const after = runTakeoff(back);
    expect(after.geometry.totalVolumeGal.value).toBeCloseTo(before.geometry.totalVolumeGal.value, 6);
    expect(after.excavation.truckCount.value).toBe(before.excavation.truckCount.value);
    expect(after.hydraulics!.systemFlowGpm).toBeCloseTo(before.hydraulics!.systemFlowGpm, 6);
    expect(after.finishes!.copingPieces.value).toBe(before.finishes!.copingPieces.value);
  });

  it('writes a version so a future format change can be detected', () => {
    expect(JSON.parse(serializeJob(STANDARD_MODEL)).apexDesignerJob).toBe(JOB_FILE_VERSION);
  });

  it('names the file after the job', () => {
    expect(jobFileName(STANDARD_MODEL)).toMatch(/\.apex\.json$/);
    expect(jobFileName({ ...STANDARD_MODEL, name: 'Smith / 15x30 — deep' })).toBe('smith-15x30-deep.apex.json');
  });
});

describe('what it refuses to load', () => {
  it('refuses text that is not JSON', () => {
    const r = parseJob('not json at all');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/not valid json/i);
  });

  it('refuses a JSON file that is not one of ours', () => {
    const r = parseJob(JSON.stringify({ some: 'other file' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/refusing to guess/i);
  });

  it('refuses a file from a newer format rather than dropping fields', () => {
    const r = parseJob(JSON.stringify({ apexDesignerJob: JOB_FILE_VERSION + 5, job: {} }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/newer version/i);
  });

  it('refuses a job for another jurisdiction', () => {
    const errs = validateJob({ ...STANDARD_MODEL, jurisdiction: 'Dallas, TX' });
    expect(errs.join(' ')).toMatch(/scoped to Lubbock/i);
  });

  it('refuses a single-suction-outlet job at the door', () => {
    const bad: unknown = {
      ...STANDARD_MODEL,
      hydraulics: { ...STANDARD_MODEL.hydraulics!, mainDrains: { count: 1, separationFt: 0, onDifferentSurfaces: false } },
    };
    expect(validateJob(bad).join(' ')).toMatch(/dual suction outlets are mandatory/i);
  });

  it('refuses a soil layer with no swell factor, and says why there is no default', () => {
    const bad: unknown = {
      ...STANDARD_MODEL,
      excavation: {
        ...STANDARD_MODEL.excavation,
        soilLayers: [{ name: 'Caliche', topDepthFt: 0, thicknessFt: 10, compactionYield: 0.85 }],
      },
    };
    expect(validateJob(bad).join(' ')).toMatch(/swell has no default/i);
  });

  it('requires the foundation setback, since 307.2.2.2 needs it on every job', () => {
    const bad: unknown = { ...STANDARD_MODEL, site: { foundationDescription: 'house' } };
    expect(validateJob(bad).join(' ')).toMatch(/307\.2\.2\.2/);
  });

  it('collects every problem rather than stopping at the first', () => {
    const errs = validateJob({ jurisdiction: 'Lubbock, TX' });
    expect(errs.length).toBeGreaterThan(2);
  });

  it('accepts the standard model as valid', () => {
    expect(validateJob(STANDARD_MODEL)).toEqual([]);
  });
});

describe('loading a job whose pump this build does not know', () => {
  it('loads the job and warns, instead of failing or inventing a pump', () => {
    const text = serializeJob(STANDARD_MODEL).replace('"SP32900VSPX1"', '"SOME-OLD-MODEL"');
    const r = parseJob(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.job.hydraulics?.pumpModel).toBeUndefined();
      expect(r.warnings.join(' ')).toMatch(/not in this build's catalogue/i);
      // The rest of hydraulics still computes.
      const takeoff = runTakeoff(r.job);
      expect(takeoff.hydraulics!.flow.designFlow.value).toBeGreaterThan(0);
      expect(takeoff.hydraulics!.operatingPoint).toBeNull();
    }
  });
});
