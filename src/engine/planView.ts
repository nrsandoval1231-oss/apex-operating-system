/**
 * SVG plan view — build order step 9.
 *
 * Built in the order the PRD sets: geometry, then dimension lines and leaders,
 * then plumbing runs and pad.
 *
 * Pure TypeScript producing an SVG string, with no UI imports, so the React
 * sheet and the standalone HTML render the same drawing rather than two drawings
 * that drift apart.
 *
 * Everything drawn comes from the job inputs. The drawing does not invent
 * geometry: where a position is a drafting convention rather than a dimension
 * the job carries (which wall the skimmers sit on, where the pad goes), it is
 * marked as indicative in the legend.
 *
 * Colours come from CSS classes, not baked-in hex, so the drawing themes with
 * the sheet it sits on.
 */

import type { Job } from './types.ts';
import { inToFt } from './units.ts';

export interface PlanViewResult {
  readonly svg: string;
  /** Pixels per foot the drawing was laid out at. */
  readonly pxPerFt: number;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Real-world extents of everything drawn, including margins. ft */
  readonly contentWidthFt: number;
  readonly contentHeightFt: number;
}

/**
 * Architectural scales, largest first. Printing at one of these is the whole
 * point of a plan sheet: a drawing at "whatever fits" cannot be measured.
 */
export const ARCH_SCALES: readonly { inPerFt: number; label: string }[] = [
  { inPerFt: 1, label: `1" = 1'-0"` },
  { inPerFt: 0.75, label: `3/4" = 1'-0"` },
  { inPerFt: 0.5, label: `1/2" = 1'-0"` },
  { inPerFt: 0.375, label: `3/8" = 1'-0"` },
  { inPerFt: 0.25, label: `1/4" = 1'-0"` },
  { inPerFt: 0.1875, label: `3/16" = 1'-0"` },
  { inPerFt: 0.125, label: `1/8" = 1'-0"` },
  { inPerFt: 0.09375, label: `3/32" = 1'-0"` },
  { inPerFt: 0.0625, label: `1/16" = 1'-0"` },
];

/** Printable area of an ANSI B sheet, landscape, at a 0.5 in margin. */
export const ELEVEN_BY_SEVENTEEN = { widthIn: 17, heightIn: 11, marginIn: 0.5 };

export interface PrintScale {
  readonly inPerFt: number;
  readonly label: string;
  readonly widthIn: number;
  readonly heightIn: number;
  /** False when the drawing does not fit the sheet at ANY standard scale. */
  readonly fits: boolean;
}

/**
 * Largest standard scale that fits the drawing on the sheet. If none fits, the
 * smallest is returned with `fits: false` — the sheet says so rather than
 * silently shrinking the drawing to an unmeasurable size.
 */
export function choosePrintScale(
  contentWidthFt: number,
  contentHeightFt: number,
  availWidthIn: number,
  availHeightIn: number,
): PrintScale {
  for (const sc of ARCH_SCALES) {
    const w = contentWidthFt * sc.inPerFt;
    const h = contentHeightFt * sc.inPerFt;
    if (w <= availWidthIn && h <= availHeightIn) {
      return { ...sc, widthIn: w, heightIn: h, fits: true };
    }
  }
  const smallest = ARCH_SCALES[ARCH_SCALES.length - 1]!;
  return {
    ...smallest,
    widthIn: contentWidthFt * smallest.inPerFt,
    heightIn: contentHeightFt * smallest.inPerFt,
    fits: false,
  };
}

/** Print scale for the standard 11x17 landscape plan sheet. */
export function planPrintScale(plan: PlanViewResult): PrintScale {
  const { widthIn, heightIn, marginIn } = ELEVEN_BY_SEVENTEEN;
  return choosePrintScale(
    plan.contentWidthFt,
    plan.contentHeightFt,
    widthIn - 2 * marginIn,
    // Room for the title block strip under the drawing.
    heightIn - 2 * marginIn - 0.75,
  );
}

interface Ctx {
  readonly job: Job;
  readonly s: (ft: number) => number;
  readonly x: (ft: number) => number;
  readonly y: (ft: number) => number;
}

/** For attribute values, where quotes must be escaped. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * For text nodes. Quotes are legal inside SVG text content and escaping them
 * would turn every inch mark into &quot; — 30'-0" has to read as 30'-0".
 */
const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const n = (v: number) => Number(v.toFixed(2));

/** Feet as a builder reads them: 12.5 -> 12'-6". */
export function feetInches(ft: number): string {
  const whole = Math.floor(ft + 1e-9);
  const inches = Math.round((ft - whole) * 12);
  if (inches === 12) return `${whole + 1}'-0"`;
  return `${whole}'-${inches}"`;
}

export function renderPlanView(job: Job, targetWidthPx = 1040): PlanViewResult {
  const pool = job.pool;
  const L = pool.lengthFt;
  const W = pool.widthFt;
  const spa = job.spa;
  const deckW = job.deck?.widthFt ?? 0;
  const setback = job.site.distanceToFoundationFt;
  const over = job.excavation.shellThicknessFt + job.excavation.overDigHorizontalFt;

  // --- extents, in feet, before scaling ------------------------------------
  const spaW = spa ? spa.widthFt : 0;
  const spaL = spa ? spa.lengthFt : 0;

  const padW = 14;
  const padD = 7;
  /**
   * Depth of the house band at the top of the sheet. Indicative only — it marks
   * where the foundation is, it is not a building footprint. Kept shallow
   * because vertical extent is what decides the printed scale.
   */
  const houseDepth = 3;

  // The house sits `setback` feet off the top long wall, and the band itself
  // needs room above that or it runs off the top of the drawing.
  const topExtent = setback + houseDepth + 2.5;
  const bottomExtent = (job.equipment?.distanceFromPoolFt ?? Math.max(deckW, over) + 4) + padD + 6;
  const leftExtent = Math.max(deckW, over) + 9;
  const rightExtent = Math.max(deckW, over) + (spa?.insetIntoPool ? 0 : spaL) + 12;

  const contentW = leftExtent + L + rightExtent;
  const contentH = topExtent + W + bottomExtent;

  const pxPerFt = targetWidthPx / contentW;
  const widthPx = Math.round(contentW * pxPerFt);
  const heightPx = Math.round(contentH * pxPerFt);

  const s = (ft: number) => ft * pxPerFt;
  const x = (ft: number) => s(leftExtent + ft);
  const y = (ft: number) => s(topExtent + ft);
  const ctx: Ctx = { job, s, x, y };

  const parts: string[] = [];

  parts.push(`<defs>
    <marker id="dimArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" class="pv-dim-arrow"/>
    </marker>
    <pattern id="pvHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" class="pv-hatch"/>
    </pattern>
  </defs>`);

  // --- excavation and deck outlines ----------------------------------------
  parts.push(
    `<rect class="pv-excavation" x="${n(x(-over))}" y="${n(y(-over))}" width="${n(s(L + 2 * over))}" height="${n(s(W + 2 * over))}"/>`,
  );
  if (deckW > 0) {
    parts.push(
      `<rect class="pv-deck" x="${n(x(-deckW))}" y="${n(y(-deckW))}" width="${n(s(L + 2 * deckW))}" height="${n(s(W + 2 * deckW))}"/>`,
    );
  }

  // --- water ---------------------------------------------------------------
  parts.push(`<rect class="pv-water" x="${n(x(0))}" y="${n(y(0))}" width="${n(s(L))}" height="${n(s(W))}"/>`);

  if (spa && spa.insetIntoPool) {
    // Set into the shallow-end corner: it sits inside the pool rectangle, so it
    // is drawn there. Drawing it hanging off the end would misrepresent both the
    // footprint and the water.
    parts.push(
      `<rect class="pv-water pv-spa" x="${n(x(0))}" y="${n(y(0))}" width="${n(s(spaL))}" height="${n(s(spaW))}"/>`,
    );
    // Dam wall on the two inner edges, where it meets pool water.
    parts.push(
      `<polyline class="pv-damwall" fill="none" points="${n(x(0))},${n(y(spaW))} ${n(x(spaL))},${n(y(spaW))} ${n(x(spaL))},${n(y(0))}"/>`,
    );
    parts.push(text(ctx, spaL / 2, spaW / 2 - 0.5, 'SPA', 'pv-label-inset', 'middle'));
    parts.push(
      text(ctx, spaL / 2, spaW / 2 + 0.9, `${feetInches(spaL)} × ${feetInches(spaW)} inset`, 'pv-note-inset', 'middle'),
    );
  } else if (spa) {
    const sy0 = (W - spaW) / 2;
    parts.push(
      `<rect class="pv-water pv-spa" x="${n(x(L))}" y="${n(y(sy0))}" width="${n(s(spaL))}" height="${n(s(spaW))}"/>`,
    );
    // Dam wall on the shared edge.
    parts.push(
      `<line class="pv-damwall" x1="${n(x(L))}" y1="${n(y(sy0))}" x2="${n(x(L))}" y2="${n(y(sy0 + spaW))}"/>`,
    );
    parts.push(text(ctx, L + spaL / 2, sy0 + spaW / 2, 'SPA', 'pv-label-inset', 'middle'));
    parts.push(
      text(ctx, L + spaL / 2, sy0 + spaW / 2 + 1.4, `${feetInches(spaL)} × ${feetInches(spaW)}`, 'pv-note-inset', 'middle'),
    );
  }

  // --- depth profile: breakover stations across the pool --------------------
  const p = pool.profile;
  const stations: { at: number; label: string }[] = [
    { at: p.shallowRun, label: 'breakover' },
    { at: p.shallowRun + p.transitionRun, label: 'deep floor' },
  ];
  for (const st of stations) {
    if (st.at <= 0 || st.at >= L) continue;
    parts.push(
      `<line class="pv-station" x1="${n(x(st.at))}" y1="${n(y(0))}" x2="${n(x(st.at))}" y2="${n(y(W))}"/>`,
    );
    parts.push(text(ctx, st.at, 1.0, st.label, 'pv-station-label', 'middle'));
  }

  const depthY = W * 0.36;
  parts.push(text(ctx, p.shallowRun / 2, depthY, `${feetInches(p.shallowDepth)} deep`, 'pv-depth', 'middle'));
  parts.push(
    text(ctx, p.shallowRun + p.transitionRun + p.deepRun / 2, depthY, `${feetInches(p.deepDepth)} deep`, 'pv-depth', 'middle'),
  );
  parts.push(
    text(ctx, p.shallowRun + p.transitionRun / 2, depthY, 'slope', 'pv-depth-soft', 'middle'),
  );

  // --- steps and seats ------------------------------------------------------
  for (const st of pool.steps) {
    const wFt = inToFt(st.treadWidthIn);
    const runFt = inToFt(st.treadRunIn);
    const y0 = (W - wFt) / 2;
    const depth = runFt * st.treadCount;
    parts.push(
      `<rect class="pv-step" x="${n(x(0))}" y="${n(y(y0))}" width="${n(s(depth))}" height="${n(s(wFt))}"/>`,
    );
    for (let i = 1; i <= st.treadCount; i++) {
      parts.push(
        `<line class="pv-step-tread" x1="${n(x(runFt * i))}" y1="${n(y(y0))}" x2="${n(x(runFt * i))}" y2="${n(y(y0 + wFt))}"/>`,
      );
    }
    parts.push(text(ctx, 0.3, y0 + wFt + 0.9, `${st.treadCount} treads @ ${st.treadRunIn}"`, 'pv-note', 'start'));
  }

  for (const seat of pool.seats) {
    const wFt = inToFt(seat.surfaceWidthIn);
    const dFt = inToFt(seat.surfaceDepthIn);
    // Drawn against the bottom long wall, positioned indicatively.
    const x0 = L * 0.62;
    parts.push(
      `<rect class="pv-seat" x="${n(x(x0))}" y="${n(y(W - dFt))}" width="${n(s(wFt))}" height="${n(s(dFt))}"/>`,
    );
    parts.push(
      text(ctx, x0 + wFt / 2, W - dFt / 2, `${seat.kind} ${seat.id}`, 'pv-note-inset', 'middle'),
    );
  }

  // --- plumbing: outlets, skimmers, returns ---------------------------------
  const hyd = job.hydraulics;
  if (hyd) {
    const sep = hyd.mainDrains.separationFt;
    const mdX = p.shallowRun + p.transitionRun + p.deepRun / 2;
    for (let i = 0; i < hyd.mainDrains.count; i++) {
      const offset = (i - (hyd.mainDrains.count - 1) / 2) * sep;
      parts.push(symbol(ctx, mdX, W / 2 + offset, 'pv-drain'));
    }
    parts.push(text(ctx, mdX, W / 2 + sep / 2 + 1.6, `${hyd.mainDrains.count} outlets @ ${feetInches(sep)} apart`, 'pv-note', 'middle'));

    const skimmers = hyd.runs.filter((r) => r.role === 'skimmer');
    skimmers.forEach((r, i) => {
      const sx = L * ((i + 1) / (skimmers.length + 1));
      parts.push(symbol(ctx, sx, 0, 'pv-skimmer'));
      parts.push(text(ctx, sx, -1.1, r.id, 'pv-note', 'middle'));
    });

    const returns = hyd.runs.filter((r) => r.role === 'return-branch');
    returns.forEach((_run, i) => {
      const rx = L * ((i + 1) / (returns.length + 1));
      parts.push(symbol(ctx, rx, W, 'pv-return'));
    });
  }

  // --- equipment pad --------------------------------------------------------
  const padX = L - padW;
  // Pad sits at its real distance from the pool edge.
  const padY = W + (job.equipment?.distanceFromPoolFt ?? Math.max(deckW, over) + 4);
  if (job.equipment) {
    parts.push(
      `<rect class="pv-pad" x="${n(x(padX))}" y="${n(y(padY))}" width="${n(s(padW))}" height="${n(s(padD))}"/>`,
    );
    parts.push(
      text(ctx, padX + padW / 2, padY - 0.7, `EQUIPMENT PAD · ${feetInches(job.equipment.distanceFromPoolFt)} FROM POOL`, 'pv-label', 'middle'),
    );
    // Numbered on the drawing, named in a legend under it. A pad item is often
    // narrower than its name, and a truncated label is worse than a number.
    const items = job.equipment.padItems;
    let cursor = 0.5;
    items.forEach((item, i) => {
      const iw = Math.min(item.widthFt, padW - cursor - 0.5);
      const ih = Math.min(item.depthFt, padD - 2);
      parts.push(
        `<rect class="pv-pad-item" x="${n(x(padX + cursor))}" y="${n(y(padY + 1))}" width="${n(s(iw))}" height="${n(s(ih))}"/>`,
      );
      parts.push(text(ctx, padX + cursor + iw / 2, padY + 1 + ih / 2, String(i + 1), 'pv-pad-number', 'middle'));
      cursor += item.widthFt + 0.6;
    });
    parts.push(
      text(
        ctx,
        padX,
        padY + padD + 1.1,
        items.map((it, i) => `${i + 1} ${it.label}`).join('   '),
        'pv-note',
        'start',
      ),
    );
    // Suction and return trunks, drawn as routed runs to the pad.
    parts.push(
      `<polyline class="pv-run pv-run-suction" points="${n(x(L * 0.5))},${n(y(W))} ${n(x(L * 0.5))},${n(y(padY - 1.5))} ${n(x(padX + 2))},${n(y(padY - 1.5))} ${n(x(padX + 2))},${n(y(padY))}"/>`,
    );
    parts.push(
      `<polyline class="pv-run pv-run-return" points="${n(x(L * 0.78))},${n(y(W))} ${n(x(L * 0.78))},${n(y(padY - 2.6))} ${n(x(padX + padW - 2))},${n(y(padY - 2.6))} ${n(x(padX + padW - 2))},${n(y(padY))}"/>`,
    );
  }

  // --- house foundation and the 1:1 setback ---------------------------------
  const houseY = -setback;
  parts.push(
    `<rect class="pv-house" x="${n(x(-leftExtent + 1))}" y="${n(y(houseY - houseDepth))}" width="${n(s(contentW - 2))}" height="${n(s(houseDepth))}"/>`,
  );
  parts.push(text(ctx, L / 2, houseY - 1.2, job.site.foundationDescription.toUpperCase(), 'pv-label', 'middle'));

  // --- dimensions -----------------------------------------------------------
  const dimBelow = W + Math.max(deckW, over) + 2;
  parts.push(dimH(ctx, 0, L, dimBelow, feetInches(L)));
  parts.push(dimV(ctx, 0, W, -Math.max(deckW, over) - 2.5, feetInches(W)));
  // 1:1 depth-to-foundation, local 307.2.2.2. The drawing shows the verdict, not
  // just the dimension — a plan that draws a violation as an ordinary dimension
  // is how it gets built that way.
  const governingDepth = Math.max(p.deepDepth, spa?.depthFt ?? 0);
  const setbackOk = governingDepth <= setback;
  parts.push(
    dimV(
      ctx,
      houseY,
      0,
      // Clear to the right of the pool: the profile dimension row runs the full
      // length above the water, and this label is long when it is a violation.
      L + 3,
      setbackOk
        ? `${feetInches(setback)} to foundation · 1:1 OK`
        : `${feetInches(setback)} — VIOLATES 1:1 (needs ${feetInches(governingDepth)})`,
      setbackOk ? 'pv-dim-setback' : 'pv-dim-violation',
    ),
  );

  if (deckW > 0) {
    parts.push(dimV(ctx, W, W + deckW, L * 0.2, `${feetInches(deckW)} deck`));
  }

  // profile runs along the top
  let cursorX = 0;
  for (const [len, label] of [
    [p.shallowRun, 'shallow'],
    [p.transitionRun, 'transition'],
    [p.deepRun, 'deep'],
  ] as const) {
    if (len > 0) {
      parts.push(dimH(ctx, cursorX, cursorX + len, -1.9, `${feetInches(len)} ${label}`, 'pv-dim-soft'));
      cursorX += len;
    }
  }

  // --- scale bar and legend -------------------------------------------------
  const barY = contentH - topExtent - 2.2;
  parts.push(scaleBar(ctx, -leftExtent + 1.5, barY, pxPerFt));

  const svg = `<svg class="planview" viewBox="0 0 ${widthPx} ${heightPx}" width="100%" role="img" aria-label="Dimensioned plan view of ${esc(job.name)}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;

  return { svg, pxPerFt, widthPx, heightPx, contentWidthFt: contentW, contentHeightFt: contentH };
}

// --- primitives -------------------------------------------------------------

function text(ctx: Ctx, xf: number, yf: number, label: string, cls: string, anchor: string): string {
  return `<text class="${cls}" x="${n(ctx.x(xf))}" y="${n(ctx.y(yf))}" text-anchor="${anchor}" dominant-baseline="middle">${escText(label)}</text>`;
}

function symbol(ctx: Ctx, xf: number, yf: number, cls: string): string {
  return `<circle class="${cls}" cx="${n(ctx.x(xf))}" cy="${n(ctx.y(yf))}" r="${n(ctx.s(0.55))}"/>`;
}

/** Horizontal dimension line with witness lines and arrowheads. */
function dimH(ctx: Ctx, x1: number, x2: number, atY: number, label: string, cls = 'pv-dim'): string {
  const yy = ctx.y(atY);
  return `<g class="${cls}">
    <line class="pv-witness" x1="${n(ctx.x(x1))}" y1="${n(ctx.y(atY > 0 ? atY - 0.6 : atY + 0.6))}" x2="${n(ctx.x(x1))}" y2="${n(yy)}"/>
    <line class="pv-witness" x1="${n(ctx.x(x2))}" y1="${n(ctx.y(atY > 0 ? atY - 0.6 : atY + 0.6))}" x2="${n(ctx.x(x2))}" y2="${n(yy)}"/>
    <line class="pv-dim-line" x1="${n(ctx.x(x1))}" y1="${n(yy)}" x2="${n(ctx.x(x2))}" y2="${n(yy)}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>
    <text class="pv-dim-text" x="${n((ctx.x(x1) + ctx.x(x2)) / 2)}" y="${n(yy - 4)}" text-anchor="middle">${escText(label)}</text>
  </g>`;
}

/** Vertical dimension line. */
function dimV(ctx: Ctx, y1: number, y2: number, atX: number, label: string, cls = 'pv-dim'): string {
  const xx = ctx.x(atX);
  const mid = (ctx.y(y1) + ctx.y(y2)) / 2;
  return `<g class="${cls}">
    <line class="pv-witness" x1="${n(ctx.x(atX > 0 ? atX - 0.6 : atX + 0.6))}" y1="${n(ctx.y(y1))}" x2="${n(xx)}" y2="${n(ctx.y(y1))}"/>
    <line class="pv-witness" x1="${n(ctx.x(atX > 0 ? atX - 0.6 : atX + 0.6))}" y1="${n(ctx.y(y2))}" x2="${n(xx)}" y2="${n(ctx.y(y2))}"/>
    <line class="pv-dim-line" x1="${n(xx)}" y1="${n(ctx.y(y1))}" x2="${n(xx)}" y2="${n(ctx.y(y2))}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>
    <text class="pv-dim-text" x="${n(xx - 5)}" y="${n(mid)}" text-anchor="middle" transform="rotate(-90 ${n(xx - 5)} ${n(mid)})">${escText(label)}</text>
  </g>`;
}

/**
 * Graphic scale bar. A drawing that can be resized needs one — a stated ratio
 * stops being true the moment the page scales the SVG, but a bar scales with it.
 */
function scaleBar(ctx: Ctx, atX: number, atY: number, pxPerFt: number): string {
  const segs = [0, 5, 10, 20];
  const parts: string[] = [];
  const y0 = ctx.y(atY);
  const h = 5;
  for (let i = 0; i < segs.length - 1; i++) {
    const a = ctx.x(atX + segs[i]!);
    const b = ctx.x(atX + segs[i + 1]!);
    parts.push(
      `<rect class="${i % 2 === 0 ? 'pv-scale-fill' : 'pv-scale-empty'}" x="${n(a)}" y="${n(y0)}" width="${n(b - a)}" height="${h}"/>`,
    );
    parts.push(`<text class="pv-scale-text" x="${n(a)}" y="${n(y0 + 15)}" text-anchor="middle">${segs[i]}</text>`);
  }
  const last = ctx.x(atX + segs[segs.length - 1]!);
  parts.push(`<text class="pv-scale-text" x="${n(last)}" y="${n(y0 + 15)}" text-anchor="middle">${segs[segs.length - 1]} ft</text>`);
  parts.push(
    `<text class="pv-scale-note" x="${n(ctx.x(atX))}" y="${n(y0 - 6)}" text-anchor="start">GRAPHIC SCALE · ${pxPerFt.toFixed(1)} px per ft as laid out</text>`,
  );
  return `<g>${parts.join('')}</g>`;
}
