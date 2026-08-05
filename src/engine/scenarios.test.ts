/**
 * Every scenario the switcher offers, opened.
 *
 * This is the test that was missing when the 20 x 40 preset threw: it inherited
 * a deck sized to a different pool, and once the deck gained a containment
 * check the app showed an engine error where a pool should be. Nothing noticed,
 * because the reference cases lived inline in App.tsx where no test could reach
 * them and the preset tests only ever opened the 15 x 30.
 *
 * The list is now imported rather than restated, so a scenario added to the app
 * is covered here by construction.
 */

import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './jobs/scenarios.ts';
import { runTakeoff } from './index.ts';
import { renderPlanView } from './planView.ts';
import { renderSectionView } from './sectionView.ts';
import { computeGeometry, GeometryInputError } from './geometry.ts';
import { ExcavationInputError } from './excavation.ts';

const CASES = SCENARIOS.map((s) => [s.tab, s] as const);

describe.each(CASES)('%s', (_tab, scenario) => {
  const { job, details, group } = scenario;

  it('runs a takeoff without an unhandled throw', () => {
    /*
     * Some reference scenarios are deliberate refusal cases, and refusing is
     * correct. What must not happen is an exception the sheet does not catch —
     * the app only handles GeometryInputError and ExcavationInputError, so
     * anything else reaches the user as "Engine error".
     */
    try {
      runTakeoff(job, details);
    } catch (e) {
      expect(
        e instanceof GeometryInputError || e instanceof ExcavationInputError,
        `${_tab} threw ${(e as Error).constructor.name}: ${(e as Error).message}`,
      ).toBe(true);
    }
  });

  it('draws a plan and a section', () => {
    // Both drawings run off the job alone and neither is allowed to fail on a
    // scenario the app will happily select.
    expect(renderPlanView(job).svg.startsWith('<svg')).toBe(true);
    expect(renderSectionView(job).svg.startsWith('<svg')).toBe(true);
  });

  it('carries a deck that contains its own pool', () => {
    // The exact shape of the 20 x 40 regression.
    if (!job.deck) return;
    const o = job.deck.outline;
    expect(o.xFt).toBeLessThanOrEqual(0);
    expect(o.yFt).toBeLessThanOrEqual(0);
    expect(o.xFt + o.widthFt).toBeGreaterThanOrEqual(job.pool.lengthFt);
    expect(o.yFt + o.heightFt).toBeGreaterThanOrEqual(job.pool.widthFt);
  });

  it('computes geometry, which every other module reads', () => {
    expect(() => computeGeometry(job)).not.toThrow();
  });

  if (group === 'standard') {
    it('is a usable starting point: quantities, not a refusal', () => {
      // A standard preset is what someone opens to start a real job. A
      // reference case may refuse; a standard one may not.
      const r = runTakeoff(job, details);
      expect(r.structure.outcome).toBe('quantities');
    });
  }
});

describe('the scenario list itself', () => {
  it('offers six standards and keeps the refusal cases separate', () => {
    expect(SCENARIOS.filter((s) => s.group === 'standard')).toHaveLength(6);
    expect(SCENARIOS.filter((s) => s.group === 'reference').length).toBeGreaterThan(0);
  });

  it('has no duplicate tab labels, which would make two buttons the same', () => {
    const tabs = SCENARIOS.map((s) => s.tab);
    expect(new Set(tabs).size).toBe(tabs.length);
  });
});
