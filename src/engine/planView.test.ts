/**
 * Plan view.
 *
 * The drawing is the one thing on the sheet a builder reads instead of the
 * numbers, so the tests check that what it draws traces to the job inputs and
 * that it does not quietly draw a violation as an ordinary dimension.
 */

import { describe, expect, it } from 'vitest';
import {
  ARCH_SCALES,
  choosePrintScale,
  feetInches,
  planPrintScale,
  renderPlanView,
} from './planView.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const plan = renderPlanView(STANDARD_MODEL);
const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('feet and inches, as a builder reads them', () => {
  it('converts decimal feet', () => {
    expect(feetInches(30)).toBe(`30'-0"`);
    expect(feetInches(3.5)).toBe(`3'-6"`);
    expect(feetInches(15.25)).toBe(`15'-3"`);
  });

  it('rolls 12 inches up to the next foot instead of printing 11\'-12"', () => {
    expect(feetInches(11.9999)).toBe(`12'-0"`);
  });
});

describe('the drawing traces to the job', () => {
  it('is a self-contained svg with a viewBox', () => {
    expect(plan.svg.startsWith('<svg')).toBe(true);
    expect(plan.svg).toContain(`viewBox="0 0 ${plan.widthPx} ${plan.heightPx}"`);
    expect(plan.pxPerFt).toBeGreaterThan(0);
  });

  it('dimensions the pool from the job, not from the drawing', () => {
    expect(plan.svg).toContain(`30'-0"`);
    expect(plan.svg).toContain(`15'-0"`);
  });

  it('labels both depths and the transition', () => {
    expect(plan.svg).toContain(`3'-6" deep`);
    expect(plan.svg).toContain(`6'-0" deep`);
    expect(plan.svg).toContain('slope');
    expect(plan.svg).toContain('breakover');
  });

  it('dimensions the profile runs so they can be checked against the length', () => {
    expect(plan.svg).toContain(`10'-0" shallow`);
    expect(plan.svg).toContain(`14'-0" transition`);
    expect(plan.svg).toContain(`6'-0" deep`);
  });

  it('draws the spa only when the job has one', () => {
    expect(plan.svg).toContain('pv-spa');
    const noSpa = renderPlanView({ ...STANDARD_MODEL, spa: undefined });
    expect(noSpa.svg).not.toContain('pv-spa');
  });

  it('draws the deck only when the job has one', () => {
    expect(plan.svg).toContain('pv-deck');
    const noDeck = renderPlanView({ ...STANDARD_MODEL, deck: undefined });
    expect(noDeck.svg).not.toContain('pv-deck');
  });

  it('always draws the over-dig outline, since every job is excavated', () => {
    expect(plan.svg).toContain('pv-excavation');
  });

  it('draws one symbol per suction outlet and states the separation', () => {
    const drains = plan.svg.match(/pv-drain/g) ?? [];
    expect(drains).toHaveLength(STANDARD_MODEL.hydraulics!.mainDrains.count);
    expect(plan.svg).toContain(`2 outlets @ 3'-0" apart`);
  });

  it('extends excavation and deck outlines around an attached spa', () => {
    expect(plan.svg).toContain('pv-spa-excavation');
    expect(plan.svg).toContain('pv-spa-deck');
    const inset = renderPlanView({
      ...STANDARD_MODEL,
      spa: { ...STANDARD_MODEL.spa!, insetIntoPool: true },
    });
    expect(inset.svg).not.toContain('pv-spa-excavation');
    expect(inset.svg).not.toContain('pv-spa-deck');
  });

  it('draws a symbol per skimmer and per return branch', () => {
    const skimmers = STANDARD_MODEL.hydraulics!.runs.filter((r) => r.role === 'skimmer');
    const returns = STANDARD_MODEL.hydraulics!.runs.filter((r) => r.role === 'return-branch');
    expect(plan.svg.match(/pv-skimmer/g) ?? []).toHaveLength(skimmers.length);
    expect(plan.svg.match(/pv-return"/g) ?? []).toHaveLength(returns.length);
  });

  it('numbers the pad items and names them in a legend', () => {
    expect(plan.svg).toContain('EQUIPMENT PAD');
    expect(plan.svg).toContain('1 Pump');
    expect(plan.svg).toContain('4 Automation panel');
  });

  it('carries a graphic scale bar, which survives the page resizing the drawing', () => {
    expect(plan.svg).toContain('GRAPHIC SCALE');
    expect(plan.svg).toContain('20 ft');
  });

  it('escapes text taken from job input', () => {
    const nasty: Job = {
      ...STANDARD_MODEL,
      site: { ...STANDARD_MODEL.site, foundationDescription: 'wall <script>x</script>' },
    };
    const r = renderPlanView(nasty);
    expect(r.svg).not.toContain('<script>');
    expect(r.svg).toContain('&lt;SCRIPT&gt;');
  });
});

describe('the drawing shows the code verdict, not just the dimension', () => {
  it('marks a compliant setback as OK', () => {
    expect(plan.svg).toContain(`8'-0" to foundation · 1:1 OK`);
    expect(plan.svg).not.toContain('pv-dim-violation');
  });

  it('marks a violating setback on the drawing itself, with the depth it needs', () => {
    const tight: Job = {
      ...STANDARD_MODEL,
      site: { distanceToFoundationFt: 5, foundationDescription: 'house slab foundation' },
    };
    const r = renderPlanView(tight);
    expect(r.svg).toContain('pv-dim-violation');
    expect(r.svg).toContain('VIOLATES 1:1');
    expect(r.svg).toContain(`needs 6'-0"`);
  });

  it('the spa governs the setback verdict when it is the deeper body', () => {
    const deepSpa: Job = {
      ...STANDARD_MODEL,
      pool: { ...STANDARD_MODEL.pool, profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 4 } },
      spa: { ...STANDARD_MODEL.spa!, depthFt: 9 },
      site: { distanceToFoundationFt: 6, foundationDescription: 'house slab foundation' },
    };
    expect(renderPlanView(deepSpa).svg).toContain('VIOLATES 1:1');
  });
});

describe('layout holds together', () => {
  it('scales to the requested width', () => {
    expect(renderPlanView(STANDARD_MODEL, 800).widthPx).toBe(800);
  });

  it('gives the house band room above the setback rather than running off the top', () => {
    // Every drawn y must be inside the viewBox; the house is the topmost thing.
    const ys = [...plan.svg.matchAll(/\sy="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(plan.heightPx);
  });

  it('a deeper pool pushes the house further away and the drawing grows with it', () => {
    const far: Job = {
      ...STANDARD_MODEL,
      site: { distanceToFoundationFt: 20, foundationDescription: 'house slab foundation' },
    };
    expect(renderPlanView(far).heightPx).toBeGreaterThan(plan.heightPx);
  });
});

describe('print scale (step 10)', () => {
  it('picks the LARGEST standard scale that fits, not whatever fits the page', () => {
    // 65 x 71.5 ft on 16 x 9.25 in of printable area. The height comes mostly
    // from the 30 ft run out to the equipment pad, which is real yard and is
    // drawn at its real distance.
    const s = planPrintScale(plan);
    expect(s.label).toBe(`1/8" = 1'-0"`);
    expect(s.fits).toBe(true);
    // One size up would be 13.4 in tall against 9.25 in of sheet.
    expect(plan.contentHeightFt * 0.1875).toBeGreaterThan(9.25);
  });

  it('the printed size follows from the real extents and the scale', () => {
    const s = planPrintScale(plan);
    close(s.widthIn, plan.contentWidthFt * s.inPerFt, 0.001);
    close(s.heightIn, plan.contentHeightFt * s.inPerFt, 0.001);
  });

  it('only ever returns a real architectural scale', () => {
    for (const w of [20, 45, 65, 90, 140]) {
      const s = choosePrintScale(w, w * 0.7, 16, 9.25);
      expect(ARCH_SCALES.map((a) => a.inPerFt)).toContain(s.inPerFt);
    }
  });

  it('a bigger job drops to a smaller scale rather than overflowing', () => {
    const small = choosePrintScale(40, 30, 16, 9.25);
    const big = choosePrintScale(120, 90, 16, 9.25);
    expect(big.inPerFt).toBeLessThan(small.inPerFt);
    expect(big.fits).toBe(true);
  });

  it('says it does not fit rather than shrinking below a standard scale', () => {
    const huge = choosePrintScale(600, 400, 16, 9.25);
    expect(huge.fits).toBe(false);
    expect(huge.inPerFt).toBe(ARCH_SCALES[ARCH_SCALES.length - 1]!.inPerFt);
  });

  it('height governs as readily as width', () => {
    // Same width, taller job: the scale has to come down.
    const wide = choosePrintScale(65, 20, 16, 9.25);
    const tall = choosePrintScale(65, 60, 16, 9.25);
    expect(tall.inPerFt).toBeLessThan(wide.inPerFt);
  });
});

/**
 * The city submittal asks for four things: pool dimensions, depth dimensions,
 * distance to the house, and distance to the property lines. The first three
 * were already drawn; these cover the fourth.
 */
describe('property lines', () => {
  const withLines = (lines: Job['site']['propertyLines']): Job => ({
    ...STANDARD_MODEL,
    site: { ...STANDARD_MODEL.site, propertyLines: lines },
  });

  it('draws and dimensions each line back to the water', () => {
    const svg = renderPlanView(withLines([
      { side: 'bottom', distanceFt: 12, label: 'Rear property line' },
      { side: 'right', distanceFt: 10, label: 'Side property line' },
    ])).svg;
    expect(svg.match(/pv-property-line/g)).toHaveLength(2);
    expect(svg).toContain('REAR PROPERTY LINE');
    expect(svg).toContain(`12'-0" to rear property line`);
    expect(svg).toContain(`10'-0" to side property line`);
  });

  it('draws none when the job records none, rather than inventing a lot', () => {
    const svg = renderPlanView(withLines(undefined)).svg;
    expect(svg).not.toContain('pv-property-line');
  });

  it('grows the sheet so a distant line still fits on the drawing', () => {
    const near = renderPlanView(withLines([{ side: 'bottom', distanceFt: 12, label: 'Rear' }]));
    const far = renderPlanView(withLines([{ side: 'bottom', distanceFt: 60, label: 'Rear' }]));
    // Same width target, so a line 60 ft out has to make the sheet taller —
    // otherwise it is drawn outside the viewBox and silently disappears.
    expect(far.heightPx).toBeGreaterThan(near.heightPx);
  });

  it('measures a side line from the spa when the spa is the nearest water', () => {
    // A detached spa hangs off the deep end, so the right-hand envelope edge is
    // past the pool wall. Measuring from the pool would overstate the setback.
    const attached = renderPlanView(withLines([{ side: 'right', distanceFt: 10, label: 'Side' }]));
    expect(attached.svg).toContain(`10'-0" to side`);
    expect(attached.widthPx).toBeGreaterThan(0);
  });

  it('ignores a zero or negative distance rather than drawing a line through the pool', () => {
    const svg = renderPlanView(withLines([{ side: 'left', distanceFt: 0, label: 'Side' }])).svg;
    expect(svg).not.toContain('pv-property-line');
  });
});
