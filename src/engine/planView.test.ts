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
    const drains = plan.svg.match(/pv-drain-grate/g) ?? [];
    expect(drains).toHaveLength(STANDARD_MODEL.hydraulics!.mainDrains.count);
    expect(plan.svg).toContain(`2 outlets @ 3'-0" apart`);
  });

  it('extends the excavation outline around an attached spa', () => {
    expect(plan.svg).toContain('pv-spa-excavation');
    const inset = renderPlanView({
      ...STANDARD_MODEL,
      spa: { ...STANDARD_MODEL.spa!, insetIntoPool: true },
    });
    expect(inset.svg).not.toContain('pv-spa-excavation');
  });

  it('draws the deck as one slab, not a ring plus a second ring round the spa', () => {
    // The deck used to be a band derived from a width, with a second band drawn
    // around an attached spa — two rectangles standing in for a shape nobody
    // could describe. It is now the rectangle that was actually drawn.
    expect(plan.svg.match(/class="pv-deck"/g) ?? []).toHaveLength(1);
    expect(plan.svg).not.toContain('pv-spa-deck');
  });

  it('draws a symbol per skimmer and per return branch', () => {
    const skimmers = STANDARD_MODEL.hydraulics!.runs.filter((r) => r.role === 'skimmer');
    const returns = STANDARD_MODEL.hydraulics!.runs.filter((r) => r.role === 'return-branch');
    expect(plan.svg.match(/pv-skimmer-throat/g) ?? []).toHaveLength(skimmers.length);
    expect(plan.svg.match(/pv-return-fitting/g) ?? []).toHaveLength(returns.length);
  });

  it('gives each fitting its own shape, not one circle in four colours', () => {
    // A plan is read by shape before it is read by legend. Every station used to
    // be the same 0.55 ft circle, which is four things nobody can tell apart.
    expect(plan.svg).toContain('pv-skimmer-throat');      // rectangle in the wall
    expect(plan.svg).toContain('pv-return-fitting');      // small eyeball + throw
    expect(plan.svg).toContain('pv-drain-grate');         // circle + grate bars
    expect(plan.svg).toMatch(/<rect class="pv-fitting pv-skimmer-throat/);
    expect(plan.svg).toMatch(/<circle class="pv-return-body/);
    expect(plan.svg).toMatch(/<line class="pv-drain-bar/);
  });

  it('sets returns inside the wall, not straddling it', () => {
    // The old symbol was centred on the wall line, so half of every return sat
    // out on the deck. A return is fitted in the wall, below the water.
    const W = STANDARD_MODEL.pool.widthFt;
    const bodies = [...plan.svg.matchAll(/<circle class="pv-return-body" cx="([\d.]+)" cy="([\d.]+)"/g)];
    expect(bodies.length).toBeGreaterThan(0);
    const wallY = plan.originYPx + W * plan.pxPerFt;
    for (const [, , cy] of bodies) {
      // Returns are on the bottom wall, so "inside" means a smaller y.
      expect(Number(cy)).toBeLessThan(wallY);
    }
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

describe('turning the sheet', () => {
  const upright = renderPlanView(STANDARD_MODEL);
  const turned = renderPlanView(STANDARD_MODEL, 1040, { quarterTurns: 1 });
  const half = renderPlanView(STANDARD_MODEL, 1040, { quarterTurns: 2 });

  it('changes nothing at all when the sheet is not turned', () => {
    // Rotation is a feature nobody has used until they press the button. An
    // unrotated plan must be the same bytes it was before rotation existed, or
    // every drawing in the repository silently changed.
    expect(renderPlanView(STANDARD_MODEL, 1040, { quarterTurns: 0 }).svg).toBe(upright.svg);
    expect(upright.svg).not.toContain('<g transform="');
    expect(upright.quarterTurns).toBe(0);
  });

  it('turns the whole drawing as one group', () => {
    expect(turned.svg).toContain('<g transform="translate(');
    expect(turned.svg).toContain('rotate(90)');
    expect(turned.quarterTurns).toBe(1);
  });

  it('swaps the extents the print scale is chosen from', () => {
    expect(turned.contentWidthFt).toBeCloseTo(upright.contentHeightFt, 6);
    expect(turned.contentHeightFt).toBeCloseTo(upright.contentWidthFt, 6);
  });

  it('prints a deep site at a bigger scale once it is turned', () => {
    // The print sheet is always 11x17 LANDSCAPE, so rotation earns its scale on
    // a drawing that is deeper than it is wide — a site carrying front and rear
    // property lines, not a long pool.
    //
    // The standard model is 65 x 71.5 ft of content, marginally deeper than
    // wide, and turning it changes nothing: it fits at 1/8" either way and fits
    // at 3/16" neither way. Rotation is not free scale, and the second
    // assertion below is here so nobody reads the first as promising that.
    const deepSite: Job = {
      ...STANDARD_MODEL,
      site: {
        ...STANDARD_MODEL.site,
        propertyLines: [
          { side: 'top', distanceFt: 40, label: 'Front property line' },
          { side: 'bottom', distanceFt: 40, label: 'Rear property line' },
        ],
      },
    };
    const flat = planPrintScale(renderPlanView(deepSite));
    const onEnd = planPrintScale(renderPlanView(deepSite, 1040, { quarterTurns: 1 }));
    expect(onEnd.inPerFt).toBeGreaterThan(flat.inPerFt);

    // And the standard model gains nothing, which is the honest other half.
    expect(planPrintScale(turned).inPerFt).toBe(planPrintScale(upright).inPerFt);
  });

  it('keeps the layout size for the drag handler, separately from the sheet size', () => {
    // Both renders are fitted to the same 1040px column, so the sheet sizes are
    // NOT a plain swap of each other — each is rescaled. What must hold is that
    // the layout box is still the UNROTATED one, because that is what the drag
    // inverse measures against; getting these two pairs confused would put every
    // drop in the wrong place by the aspect ratio.
    expect(turned.widthPx).toBeCloseTo(1040, 0);
    expect(turned.heightPx).toBe(turned.layoutWidthPx);
    expect(turned.widthPx).toBe(turned.layoutHeightPx);
    // Same shape as the unrotated layout, at a different scale.
    expect(turned.layoutWidthPx / turned.layoutHeightPx)
      .toBeCloseTo(upright.widthPx / upright.heightPx, 2);
  });

  it('fits the drawing to the column it was asked for, whichever way it is turned', () => {
    // targetWidthPx is the column width. On an odd turn the caller's width is
    // the layout's height, so scaling off the layout width would overflow.
    expect(turned.widthPx).toBeCloseTo(1040, 0);
    expect(upright.widthPx).toBeCloseTo(1040, 0);
  });

  it('never leaves a dimension upside down', () => {
    // At 180° every label would otherwise read bottom-up. The horizontal
    // dimensions counter-rotate; the vertical ones stay aligned to their own
    // line, which is what a drafter expects and what the unrotated sheet does.
    expect(half.svg).toContain('rotate(-180');
    expect(half.svg).not.toContain('rotate(90 ');
  });

  it('says which way it is turned, for anyone who cannot see the drawing', () => {
    expect(turned.svg).toContain('rotated 90°');
    expect(upright.svg).not.toContain('rotated');
  });

  it('draws the same pool at every turn', () => {
    // Rotation is a view transform: the same objects, the same dimensions, the
    // same code verdicts. Only their position on the sheet changes.
    for (const turns of [0, 1, 2, 3] as const) {
      const svg = renderPlanView(STANDARD_MODEL, 1040, { quarterTurns: turns }).svg;
      expect(svg).toContain(`30'-0"`);
      expect(svg).toContain(`15'-0"`);
      expect(svg).toContain('1:1 OK');
    }
  });
});
