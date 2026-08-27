import { describe, expect, it } from 'vitest';
import { runTakeoff } from './index.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

describe('global blocking-failure rollup', () => {
  it('propagates a hydraulic code failure to the takeoff result', () => {
    const job: Job = {
      ...STANDARD_MODEL,
      equipment: undefined,
      hydraulics: {
        ...STANDARD_MODEL.hydraulics!,
        turnoverHours: 3,
        runs: STANDARD_MODEL.hydraulics!.runs.map((run) =>
          run.role === 'return-branch'
            ? { ...run, size: '1.5' as const, flowBasis: 'full-system' as const }
            : run,
        ),
      },
    };

    const result = runTakeoff(job);
    expect(result.hydraulics!.runs.some((run) => run.checks.some((check) => check.status === 'fail'))).toBe(true);
    expect(result.hasCodeFailure).toBe(true);
    // Named, not just flagged: the sheet points the reader at a section, and
    // pointing at the amendment table here would send them to all-green rows.
    expect(result.codeFailureAreas).toEqual(['hydraulics']);
  });

  it('propagates a governing gas-capacity failure to the takeoff result', () => {
    const job: Job = {
      ...STANDARD_MODEL,
      hydraulics: undefined,
      equipment: {
        ...STANDARD_MODEL.equipment!,
        gas: {
          ...STANDARD_MODEL.equipment!.gas!,
          meterCapacityCfh: 100,
        },
      },
    };

    const result = runTakeoff(job);
    expect(result.equipment!.gas!.meterCheck.status).toBe('fail');
    expect(result.hasCodeFailure).toBe(true);
    expect(result.codeFailureAreas).toEqual(['gas']);
    // The bug this replaced: the sheet announced a failed City of Lubbock
    // amendment check whenever anything blocked, including this.
    expect(result.codeFailureAreas).not.toContain('amendments');
  });

  it('reports no failing area on a configuration that passes everything', () => {
    const result = runTakeoff({ ...STANDARD_MODEL, equipment: undefined, hydraulics: undefined });
    expect(result.codeFailureAreas).toEqual([]);
    expect(result.hasCodeFailure).toBe(false);
  });
});
