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

describe('the section draws what a builder would recognise', () => {
  const svg = renderSectionView(STANDARD_MODEL).svg;
  const step = STANDARD_MODEL.pool.steps[0]!;

  it('descends the stair from the deck into the water, not out of it', () => {
    // It used to build from the wall outward and upward: the toe against the
    // wall and the top tread furthest into the pool, so you would have climbed
    // OUT of the water to reach the deck.
    const path = /<path class="sec-step" d="([^"]+)"/.exec(svg)?.[1] ?? '';
    const points = [...path.matchAll(/([-\d.]+) ([-\d.]+)/g)].map(([, px, py]) => ({ x: +px!, y: +py! }));
    expect(points.length).toBeGreaterThan(4);

    // Highest tread (smallest y on screen) must be nearest the shallow-end wall
    // (smallest x); the toe must be furthest into the pool.
    const highest = points.reduce((best, p) => (p.y < best.y ? p : best));
    const lowest = points.reduce((best, p) => (p.y > best.y ? p : best));
    expect(highest.x).toBeLessThan(lowest.x);
  });

  it('spans the stair its real length into the pool', () => {
    const path = /<path class="sec-step" d="([^"]+)"/.exec(svg)?.[1] ?? '';
    const xs = [...path.matchAll(/([-\d.]+) ([-\d.]+)/g)].map(([, px]) => +px!);
    const section = renderSectionView(STANDARD_MODEL);
    const spanFt = (step.treadRunIn / 12) * step.treadCount;
    expect((Math.max(...xs) - Math.min(...xs)) / section.pxPerFt).toBeCloseTo(spanFt, 1);
  });

  it('leaves benches and swimouts off the section entirely', () => {
    // A bench sits against a SIDE wall, which a longitudinal centreline section
    // does not cut. Drawing it anyway put a rectangle in the middle of the water
    // belonging to a wall the reader cannot see, with a label that collided with
    // everything near it.
    expect(STANDARD_MODEL.pool.seats.some((seat) => seat.kind === 'bench')).toBe(true);
    expect(svg).not.toContain('sec-seat');
  });

  it('draws a tanning ledge, which is genuinely on this cut', () => {
    const withLedge = renderSectionView({
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        seats: [{
          ...STANDARD_MODEL.pool.seats[0]!,
          id: 'TL1',
          kind: 'tanningLedge',
          depthBelowWaterlineIn: 10,
          surfaceWidthIn: 96,
          surfaceDepthIn: 60,
          position: { xFt: 0, yFt: 0 },
        }],
      },
    }).svg;
    expect(withLedge).toContain('sec-seat');
    expect(withLedge).toContain('below WL');
  });

  it('puts the stair after the ledge, in the order you would walk them', () => {
    // The reason steps needed a station at all: a stair coming off a ledge
    // starts at the ledge's edge, and drawing it at the wall put it through the
    // ledge.
    const job: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        seats: [{
          ...STANDARD_MODEL.pool.seats[0]!,
          id: 'TL1',
          kind: 'tanningLedge',
          depthBelowWaterlineIn: 10,
          surfaceWidthIn: 96,
          surfaceDepthIn: 60,
          position: { xFt: 0, yFt: 0 },
        }],
        // Flush on the ledge's deep edge — the position `abutMagnets` produces
        // when you drag a stair onto a ledge. The ledge is 8 ft of surface
        // depth, so its edge is x = 8.
        steps: [{ ...STANDARD_MODEL.pool.steps[0]!, position: { xFt: 8, yFt: 0 } }],
      },
    };
    const out = renderSectionView(job);
    const ledgeXs = [...(/<path class="sec-seat" d="([^"]+)"/.exec(out.svg)?.[1] ?? '')
      .matchAll(/([-\d.]+) ([-\d.]+)/g)].map(([, px]) => +px!);
    const stairXs = [...(/<path class="sec-step" d="([^"]+)"/.exec(out.svg)?.[1] ?? '')
      .matchAll(/([-\d.]+) ([-\d.]+)/g)].map(([, px]) => +px!);
    expect(ledgeXs.length).toBeGreaterThan(0);
    expect(stairXs.length).toBeGreaterThan(0);
    // The stair begins at or past the ledge's deep edge — they do not overlap.
    expect(Math.min(...stairXs)).toBeGreaterThanOrEqual(Math.max(...ledgeXs) - 0.5);
  });

});

describe('turning the section with the plan', () => {
  const upright = renderSectionView(STANDARD_MODEL);
  const half = renderSectionView(STANDARD_MODEL, 1040, { quarterTurns: 2 });
  const quarter = renderSectionView(STANDARD_MODEL, 1040, { quarterTurns: 1 });

  it('changes nothing when the sheet is not turned', () => {
    expect(renderSectionView(STANDARD_MODEL, 1040, { quarterTurns: 0 }).svg).toBe(upright.svg);
    expect(upright.svg).not.toContain('<g transform="');
    expect(upright.quarterTurns).toBe(0);
  });

  it('turns the whole section as one group', () => {
    expect(half.svg).toContain('<g transform="translate(');
    expect(half.svg).toContain('rotate(180)');
    expect(half.quarterTurns).toBe(2);
  });

  it('puts the deep end on the other side at 180, which is the point', () => {
    /*
     * The reason a section needs this at all. Turn the plan 180° and the deep
     * end moves to the left; a section still drawn shallow-left would then
     * contradict the plan above it, on the one drawing where left and right
     * carry meaning.
     */
    const deepestOf = (svg: string) => {
      const d = /<path class="pv-water sec-water" d="([^"]+)"/.exec(svg)?.[1] ?? '';
      const pts = [...d.matchAll(/([-\d.]+) ([-\d.]+)/g)].map(([, px, py]) => ({ x: +px!, y: +py! }));
      return pts.reduce((best, p) => (p.y > best.y ? p : best));
    };
    /*
     * The path coordinates sit INSIDE the rotated group, so they are identical
     * in both renders — the turn is carried by the group transform. Where the
     * deep end lands on the SHEET is the raw point mapped through it, which at
     * 180° is (u, v) -> (width - u, height - v).
     */
    const rawUpright = deepestOf(upright.svg);
    const rawHalf = deepestOf(half.svg);
    const onSheetHalf = half.layoutWidthPx - rawHalf.x;
    expect(rawUpright.x).toBeGreaterThan(upright.widthPx / 2);
    expect(onSheetHalf).toBeLessThan(half.widthPx / 2);
  });

  it('swaps the sheet on a quarter turn and keeps the layout for the drag', () => {
    expect(quarter.contentWidthFt).toBeCloseTo(upright.contentHeightFt, 6);
    expect(quarter.heightPx).toBe(quarter.layoutWidthPx);
    expect(quarter.widthPx).toBe(quarter.layoutHeightPx);
  });

  it('says which way it is turned for anyone who cannot see it', () => {
    expect(half.svg).toContain('rotated 180°');
    expect(upright.svg).not.toContain('rotated');
  });

  it('still dimensions the same pool at every turn', () => {
    for (const turns of [0, 1, 2, 3] as const) {
      const svg = renderSectionView(STANDARD_MODEL, 1040, { quarterTurns: turns }).svg;
      expect(svg).toContain(`30'-0"`);
      expect(svg).toContain(`3'-6"`);
      expect(svg).toContain(`6'-0"`);
    }
  });
});
