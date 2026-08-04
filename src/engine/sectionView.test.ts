/**
 * Longitudinal section.
 *
 * The section exists to draw the one dimension a plan cannot: depth. So the
 * tests are mostly about whether what it draws traces back to the depth profile,
 * and whether it stops drawing things the job does not have.
 */

import { describe, expect, it } from 'vitest';
import { renderSectionView, sectionPrintScale } from './sectionView.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const section = renderSectionView(STANDARD_MODEL);

describe('depth, drawn rather than labelled', () => {
  it('dimensions both depths off the profile', () => {
    expect(section.svg).toContain(`3'-6"`);
    expect(section.svg).toContain(`6'-0"`);
  });

  it('dimensions each run of the profile, and the overall length', () => {
    expect(section.svg).toContain(`10'-0" shallow`);
    expect(section.svg).toContain(`14'-0" transition`);
    expect(section.svg).toContain(`6'-0" deep`);
    expect(section.svg).toContain(`30'-0"`);
  });

  it('gets deeper on the drawing when the job gets deeper', () => {
    const deeper: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 10 },
      },
    };
    // Same width target, so a deeper pool can only be drawn by making the sheet
    // taller. If this stops holding, the floor is being drawn off the bottom.
    expect(renderSectionView(deeper).heightPx).toBeGreaterThan(section.heightPx);
  });

  it('marks the breakover, and drops it on a pool with no transition', () => {
    expect(section.svg).toContain('BREAKOVER');
    const flat: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        profile: {
          ...STANDARD_MODEL.pool.profile,
          shallowRun: 30,
          transitionRun: 0,
          deepRun: 0,
          deepDepth: STANDARD_MODEL.pool.profile.shallowDepth,
        },
      },
    };
    expect(renderSectionView(flat).svg).not.toContain('BREAKOVER');
  });
});

describe('what the section refuses to draw', () => {
  it('draws an attached spa with its dam wall and spillover', () => {
    expect(section.svg).toContain('SPA');
    expect(section.svg).toContain('sec-spill');
    expect(section.svg).toContain('dam');
  });

  it('leaves an inset spa off, because it is not on this cut', () => {
    const inset: Job = {
      ...STANDARD_MODEL,
      spa: { ...STANDARD_MODEL.spa!, insetIntoPool: true },
    };
    // An inset spa sits inside the plan rectangle, so a centreline section
    // through the pool length does not pass through it. Drawing it anyway would
    // put a body of water on the sheet that is not where the drawing says.
    expect(renderSectionView(inset).svg).not.toContain('sec-spill');
  });

  it('draws no spa at all when the job has none', () => {
    const noSpa: Job = { ...STANDARD_MODEL, spa: undefined };
    const svg = renderSectionView(noSpa).svg;
    expect(svg).not.toContain('>SPA<');
    expect(svg).not.toContain('sec-spill');
  });

  it('draws one riser per tread from the job, not a generic stair', () => {
    const steps = STANDARD_MODEL.pool.steps;
    expect(steps.length).toBeGreaterThan(0);
    expect(section.svg).toContain(`${steps[0]!.treadCount} treads @ ${steps[0]!.treadRunIn}"`);
  });
});

describe('it prints at a scale someone can measure', () => {
  it('states a real architectural scale that fits 11x17', () => {
    const scale = sectionPrintScale(section);
    expect(scale.fits).toBe(true);
    expect(scale.label).toMatch(/= 1'-0"/);
  });

  it('drops to a smaller scale for a longer pool rather than overflowing', () => {
    const long: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        lengthFt: 90,
        profile: { ...STANDARD_MODEL.pool.profile, shallowRun: 40, transitionRun: 30, deepRun: 20 },
      },
    };
    const longScale = sectionPrintScale(renderSectionView(long));
    expect(longScale.inPerFt).toBeLessThan(sectionPrintScale(section).inPerFt);
  });
});
