/**
 * SVG longitudinal section — the side view.
 *
 * The plan carries length, width, and the setbacks. Depth is the one dimension a
 * plan cannot show honestly: it prints "3'-6"" and "6'-0"" as labels on a flat
 * rectangle, which is a number next to a drawing rather than a drawing of the
 * thing. The city asks for depth dimensions; this is where they are drawn.
 *
 * The cut runs along the pool length, on the pool centreline, looking at the
 * long wall. That is the only section that shows the depth profile, which varies
 * along the length and nowhere else (see DepthProfile).
 *
 * Same rules as planView: pure TypeScript producing an SVG string, no UI
 * imports, colours from CSS classes, and nothing drawn that the job does not
 * carry. Where something is a drafting convention rather than a dimension, it is
 * drawn faintly and labelled indicative.
 */

import type { Job } from './types.ts';
import { inToFt } from './units.ts';
import { ELEVEN_BY_SEVENTEEN, choosePrintScale, type PrintScale } from './planView.ts';

export interface SectionViewResult {
  readonly svg: string;
  readonly pxPerFt: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly contentWidthFt: number;
  readonly contentHeightFt: number;
  /** Where pool x=0 / waterline depth=0 sit in SVG coordinates, for dragging. */
  readonly originXPx: number;
  readonly originYPx: number;
}

export interface SectionViewOptions {
  /** Draw grab handles on the floors and stations. Screen only. */
  readonly interactive?: boolean;
}

/**
 * The section prints at a real architectural scale for the same reason the plan
 * does: a drawing at "whatever fits" cannot be measured, and a reviewer scaling
 * a depth off an unstated scale is the failure this avoids.
 *
 * A section is much shorter than it is wide, so it usually clears a larger scale
 * than the plan does. They are allowed to differ — each sheet states its own.
 */
export function sectionPrintScale(section: SectionViewResult): PrintScale {
  const { widthIn, heightIn, marginIn } = ELEVEN_BY_SEVENTEEN;
  return choosePrintScale(
    section.contentWidthFt,
    section.contentHeightFt,
    widthIn - 2 * marginIn,
    heightIn - 2 * marginIn - 0.75,
  );
}

const n = (v: number) => Number(v.toFixed(2));

const escText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Feet to a builder's feet and inches. Mirrors planView.feetInches. */
function feetInches(ft: number): string {
  const sign = ft < 0 ? '-' : '';
  const abs = Math.abs(ft);
  let f = Math.floor(abs + 1e-9);
  let i = Math.round((abs - f) * 12);
  if (i === 12) { f += 1; i = 0; }
  return `${sign}${f}'-${i}"`;
}

interface Ctx {
  readonly s: (ft: number) => number;
  readonly x: (ft: number) => number;
  /** Elevation in feet BELOW the pool water surface. Negative is above water. */
  readonly y: (ft: number) => number;
}

export function renderSectionView(
  job: Job,
  targetWidthPx = 1040,
  options: SectionViewOptions = {},
): SectionViewResult {
  const p = job.pool.profile;
  const L = job.pool.lengthFt;
  const spa = job.spa;
  const freeboard = job.excavation.freeboardFt;
  const shell = job.excavation.shellThicknessFt;

  // Horizontal room for the depth dimension stack on the left, and for an
  // attached spa hanging off the deep end on the right.
  const spaRunsRight = Boolean(spa && spa.attachedToPool && !spa.insetIntoPool);
  const spaL = spaRunsRight ? spa!.lengthFt : 0;
  const spaRise = spa ? spa.damWallHeightFt : 0;

  const leftExtent = 9;
  const rightExtent = spaL + 9;
  // Above water: whichever reaches higher — the bond beam at freeboard, or a spa
  // raised on its dam wall — plus its own shell and room for the grade label.
  // Below: the deep floor, the shell under it, and two dimension rows.
  const topExtent = Math.max(freeboard, spaRunsRight ? spaRise + shell : 0) + 3.5;
  const bottomExtent = shell + 5.5;

  const contentW = leftExtent + L + rightExtent;
  const contentH = topExtent + p.deepDepth + bottomExtent;

  const pxPerFt = targetWidthPx / contentW;
  const widthPx = Math.round(contentW * pxPerFt);
  const heightPx = Math.round(contentH * pxPerFt);

  const s = (ft: number) => ft * pxPerFt;
  const x = (ft: number) => s(leftExtent + ft);
  const y = (ft: number) => s(topExtent + ft);
  const ctx: Ctx = { s, x, y };

  const parts: string[] = [];

  parts.push(`<defs>
    <marker id="secArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" class="pv-dim-arrow"/>
    </marker>
    <pattern id="secHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" class="pv-hatch"/>
    </pattern>
  </defs>`);

  // --- the floor line, which is the whole point of this view -----------------
  // Shallow flat, then the transition, then the deep flat. Read straight off the
  // profile: this drawing cannot disagree with the quantities.
  const shallowEndX = p.shallowRun;
  const deepStartX = p.shallowRun + p.transitionRun;
  const floor: readonly (readonly [number, number])[] = [
    [0, p.shallowDepth],
    [shallowEndX, p.shallowDepth],
    [deepStartX, p.deepDepth],
    [L, p.deepDepth],
  ];

  // Water body: down the shallow wall, along the floor, up the deep wall.
  const waterPath = [
    `M ${n(x(0))} ${n(y(0))}`,
    ...floor.map(([fx, fd]) => `L ${n(x(fx))} ${n(y(fd))}`),
    `L ${n(x(L))} ${n(y(0))}`,
    'Z',
  ].join(' ');
  parts.push(`<path class="pv-water sec-water" d="${waterPath}"/>`);

  // Shell, offset outside the water envelope. Drawn as a band so the section
  // reads as a built thing rather than a void.
  const shellPath = [
    `M ${n(x(-shell))} ${n(y(-freeboard))}`,
    `L ${n(x(-shell))} ${n(y(p.shallowDepth + shell))}`,
    `L ${n(x(shallowEndX))} ${n(y(p.shallowDepth + shell))}`,
    `L ${n(x(deepStartX))} ${n(y(p.deepDepth + shell))}`,
    `L ${n(x(L + shell))} ${n(y(p.deepDepth + shell))}`,
    `L ${n(x(L + shell))} ${n(y(-freeboard))}`,
    `L ${n(x(L))} ${n(y(-freeboard))}`,
    `L ${n(x(L))} ${n(y(0))}`,
    ...[...floor].reverse().map(([fx, fd]) => `L ${n(x(fx))} ${n(y(fd))}`),
    `L ${n(x(0))} ${n(y(0))}`,
    `L ${n(x(0))} ${n(y(-freeboard))}`,
    'Z',
  ].join(' ');
  parts.push(`<path class="sec-shell" d="${shellPath}"/>`);

  // --- water surface and grade ----------------------------------------------
  parts.push(
    `<line class="sec-waterline" x1="${n(x(-shell - 1.5))}" y1="${n(y(0))}" x2="${n(x(L + shell + 1.5))}" y2="${n(y(0))}"/>`,
  );
  parts.push(txt(ctx, -shell - 1.6, -0.55, 'WATERLINE', 'pv-station-label', 'start'));

  // Grade sits at the top of the bond beam: freeboard above the water.
  parts.push(
    `<line class="sec-grade" x1="${n(x(-leftExtent + 1))}" y1="${n(y(-freeboard))}" x2="${n(x(-shell))}" y2="${n(y(-freeboard))}"/>`,
  );
  parts.push(
    `<line class="sec-grade" x1="${n(x(L + shell))}" y1="${n(y(-freeboard))}" x2="${n(x(L + rightExtent - 1))}" y2="${n(y(-freeboard))}"/>`,
  );
  parts.push(txt(ctx, -leftExtent + 1.3, -freeboard - 0.8, 'GRADE / DECK', 'pv-station-label', 'start'));

  // --- attached spa ----------------------------------------------------------
  // Raised by the dam wall; water spills over it into the pool. Only drawn when
  // it genuinely sits outside the pool footprint — an inset spa is inside the
  // plan rectangle and is not on this cut.
  if (spaRunsRight && spa) {
    const spaSurface = -spa.damWallHeightFt;
    const spaFloor = spaSurface + spa.depthFt;
    const damT = inToFt(spa.damWallThicknessIn);
    parts.push(
      `<path class="pv-water sec-water" d="M ${n(x(L))} ${n(y(spaSurface))} L ${n(x(L + spa.lengthFt))} ${n(y(spaSurface))} L ${n(x(L + spa.lengthFt))} ${n(y(spaFloor))} L ${n(x(L))} ${n(y(spaFloor))} Z"/>`,
    );
    parts.push(
      `<path class="sec-shell" d="M ${n(x(L))} ${n(y(spaSurface))} L ${n(x(L + damT))} ${n(y(spaSurface))} L ${n(x(L + damT))} ${n(y(spaFloor + shell))} L ${n(x(L + spa.lengthFt + shell))} ${n(y(spaFloor + shell))} L ${n(x(L + spa.lengthFt + shell))} ${n(y(spaSurface))} L ${n(x(L + spa.lengthFt))} ${n(y(spaSurface))} L ${n(x(L + spa.lengthFt))} ${n(y(spaFloor))} L ${n(x(L + damT))} ${n(y(spaFloor))} L ${n(x(L + damT))} ${n(y(spaSurface))} Z"/>`,
    );
    // The spillover itself: the reason the spa is raised at all.
    parts.push(
      `<path class="sec-spill" d="M ${n(x(L))} ${n(y(spaSurface))} Q ${n(x(L - 0.35))} ${n(y(spaSurface + spa.damWallHeightFt * 0.5))} ${n(x(L - 0.15))} ${n(y(0))}"/>`,
    );
    parts.push(txt(ctx, L + spa.lengthFt / 2, spaSurface + spa.depthFt / 2, 'SPA', 'pv-label', 'middle'));
    parts.push(dimV(ctx, spaSurface, spaFloor, L + spa.lengthFt + 3.2, `${feetInches(spa.depthFt)} spa`, 'pv-dim-soft'));
    parts.push(dimV(ctx, spaSurface, 0, L + spa.lengthFt + 6, `${feetInches(spa.damWallHeightFt)} dam`, 'pv-dim-soft'));
  }

  // --- depth dimensions — what this view exists for --------------------------
  parts.push(dimV(ctx, 0, p.shallowDepth, -3.2, feetInches(p.shallowDepth)));
  parts.push(dimV(ctx, 0, p.deepDepth, -6.4, feetInches(p.deepDepth)));
  parts.push(dimV(ctx, -freeboard, 0, L + (spaRunsRight ? 0 : 3.2), `${feetInches(freeboard)} freeboard`, 'pv-dim-soft'));

  // --- run dimensions along the bottom ---------------------------------------
  const dimRow = p.deepDepth + shell + 2.2;
  let cursor = 0;
  for (const [len, label] of [
    [p.shallowRun, 'shallow'],
    [p.transitionRun, 'transition'],
    [p.deepRun, 'deep'],
  ] as const) {
    if (len > 0) {
      parts.push(dimH(ctx, cursor, cursor + len, dimRow, `${feetInches(len)} ${label}`, 'pv-dim-soft'));
      cursor += len;
    }
  }
  parts.push(dimH(ctx, 0, L, dimRow + 2.4, feetInches(L)));

  // --- breakover, the point a swimmer needs to know about --------------------
  if (p.transitionRun > 0) {
    parts.push(
      `<line class="pv-station" x1="${n(x(shallowEndX))}" y1="${n(y(-freeboard - 0.8))}" x2="${n(x(shallowEndX))}" y2="${n(y(p.shallowDepth))}"/>`,
    );
    parts.push(txt(ctx, shallowEndX, -freeboard - 1.4, 'BREAKOVER', 'pv-station-label', 'middle'));
  }

  // --- steps, drawn where the profile puts them ------------------------------
  // Riser heights come from the job bottom-first, so the stair is built upward
  // from the floor exactly as the code text reads it.
  for (const step of job.pool.steps) {
    const treadRun = inToFt(step.treadRunIn);
    let atX = 0;
    let atY = step.floorDepthFt;
    const risers = step.riserHeightsIn;
    const poly: string[] = [`M ${n(x(atX))} ${n(y(atY))}`];
    for (let i = 0; i < step.treadCount; i += 1) {
      const rise = inToFt(risers[i] ?? 0);
      atY -= rise;
      poly.push(`L ${n(x(atX))} ${n(y(atY))}`);
      atX += treadRun;
      poly.push(`L ${n(x(atX))} ${n(y(atY))}`);
    }
    poly.push(`L ${n(x(atX))} ${n(y(step.floorDepthFt))}`, 'Z');
    parts.push(`<path class="sec-step" d="${poly.join(' ')}"/>`);
    parts.push(
      txt(ctx, atX + 0.4, step.floorDepthFt - 0.5, `${step.treadCount} treads @ ${step.treadRunIn}"`, 'pv-station-label', 'start'),
    );
  }

  // --- seats -----------------------------------------------------------------
  for (const seat of job.pool.seats) {
    const top = inToFt(seat.depthBelowWaterlineIn);
    const run = inToFt(seat.surfaceDepthIn);
    // Drawn on the deep-end side of the breakover, which is where a bench in a
    // rectangular pool goes. Position is indicative; the dimensions are not.
    const seatX = L - run;
    parts.push(
      `<path class="sec-seat" d="M ${n(x(seatX))} ${n(y(seat.floorDepthFt))} L ${n(x(seatX))} ${n(y(top))} L ${n(x(L))} ${n(y(top))} L ${n(x(L))} ${n(y(seat.floorDepthFt))} Z"/>`,
    );
    parts.push(txt(ctx, seatX - 0.4, top - 0.6, `${seat.kind} ${feetInches(top)} below WL`, 'pv-station-label', 'end'));
  }

  parts.push(
    txt(ctx, L / 2, p.deepDepth + shell + 4.6, 'LONGITUDINAL SECTION ON POOL CENTRELINE · INDICATIVE POSITIONS, DIMENSIONED DEPTHS', 'pv-station-label', 'middle'),
  );

  // --- grab handles ----------------------------------------------------------
  // Wide invisible strokes over the two floor flats and the two stations. The
  // drag rules — snapping, clamps, which run absorbs a move — live in
  // poolResize.ts; these only mark what can be grabbed.
  if (options.interactive) {
    const grab = (handle: string, x1f: number, y1f: number, x2f: number, y2f: number) =>
      `<line class="sec-grab" data-sec-handle="${handle}"`
      + ` x1="${n(x(x1f))}" y1="${n(y(y1f))}" x2="${n(x(x2f))}" y2="${n(y(y2f))}"/>`;
    if (p.shallowRun > 0) parts.push(grab('shallow-floor', 0, p.shallowDepth, shallowEndX, p.shallowDepth));
    if (p.deepRun > 0 || p.transitionRun > 0) parts.push(grab('deep-floor', deepStartX, p.deepDepth, L, p.deepDepth));
    parts.push(grab('breakover', shallowEndX, -freeboard, shallowEndX, p.shallowDepth));
    parts.push(grab('deep-start', deepStartX, -freeboard, deepStartX, p.deepDepth));
  }

  const svg = `<svg class="sectionview" viewBox="0 0 ${widthPx} ${heightPx}" width="100%" role="img" aria-label="Dimensioned longitudinal section of ${escText(job.name)}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;

  return {
    svg,
    pxPerFt,
    widthPx,
    heightPx,
    contentWidthFt: contentW,
    contentHeightFt: contentH,
    originXPx: x(0),
    originYPx: y(0),
  };
}

// --- primitives -------------------------------------------------------------

function txt(ctx: Ctx, xf: number, yf: number, label: string, cls: string, anchor: string): string {
  return `<text class="${cls}" x="${n(ctx.x(xf))}" y="${n(ctx.y(yf))}" text-anchor="${anchor}" dominant-baseline="middle">${escText(label)}</text>`;
}

function dimH(ctx: Ctx, x1: number, x2: number, atY: number, label: string, cls = 'pv-dim'): string {
  const yy = ctx.y(atY);
  return `<g class="${cls}">
    <line class="pv-witness" x1="${n(ctx.x(x1))}" y1="${n(ctx.y(atY - 0.6))}" x2="${n(ctx.x(x1))}" y2="${n(yy)}"/>
    <line class="pv-witness" x1="${n(ctx.x(x2))}" y1="${n(ctx.y(atY - 0.6))}" x2="${n(ctx.x(x2))}" y2="${n(yy)}"/>
    <line class="pv-dim-line" x1="${n(ctx.x(x1))}" y1="${n(yy)}" x2="${n(ctx.x(x2))}" y2="${n(yy)}" marker-start="url(#secArrow)" marker-end="url(#secArrow)"/>
    <text class="pv-dim-text" x="${n((ctx.x(x1) + ctx.x(x2)) / 2)}" y="${n(yy - 4)}" text-anchor="middle">${escText(label)}</text>
  </g>`;
}

function dimV(ctx: Ctx, y1: number, y2: number, atX: number, label: string, cls = 'pv-dim'): string {
  const xx = ctx.x(atX);
  const mid = (ctx.y(y1) + ctx.y(y2)) / 2;
  return `<g class="${cls}">
    <line class="pv-witness" x1="${n(ctx.x(atX + 0.6))}" y1="${n(ctx.y(y1))}" x2="${n(xx)}" y2="${n(ctx.y(y1))}"/>
    <line class="pv-witness" x1="${n(ctx.x(atX + 0.6))}" y1="${n(ctx.y(y2))}" x2="${n(xx)}" y2="${n(ctx.y(y2))}"/>
    <line class="pv-dim-line" x1="${n(xx)}" y1="${n(ctx.y(y1))}" x2="${n(xx)}" y2="${n(ctx.y(y2))}" marker-start="url(#secArrow)" marker-end="url(#secArrow)"/>
    <text class="pv-dim-text" x="${n(xx - 5)}" y="${n(mid)}" text-anchor="middle" transform="rotate(-90 ${n(xx - 5)} ${n(mid)})">${escText(label)}</text>
  </g>`;
}
