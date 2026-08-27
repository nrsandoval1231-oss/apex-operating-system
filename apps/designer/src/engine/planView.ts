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

import type { Job, PoolWall } from './types.ts';
import { inToFt } from './units.ts';
import { placementRect } from './placement.ts';
import { deckMargins } from './deck.ts';
import { depthStations, maxDepth, segmentsFromProfile } from './profile.ts';
import {
  contentTransform,
  normalizeTurns,
  rotatedExtentFt,
  rotatedSize,
  rotationLabel,
  textTransform,
  type QuarterTurns,
} from './planRotation.ts';

export interface PlanViewResult {
  readonly svg: string;
  /** Pixels per foot the drawing was laid out at. */
  readonly pxPerFt: number;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Real-world extents of everything drawn, including margins. ft */
  readonly contentWidthFt: number;
  readonly contentHeightFt: number;
  /**
   * Where pool (0, 0) sits in the SVG's own coordinates.
   *
   * Exported so a pointer position can be turned back into plan feet. Without
   * it the drag handler would have to re-derive the margins, which is the same
   * arithmetic in a second place and free to drift from this one.
   *
   * These are coordinates in the UNROTATED layout. When the sheet is turned, a
   * pointer must go through `inverseContentPoint` first — see `quarterTurns`.
   */
  readonly originXPx: number;
  readonly originYPx: number;
  /** Quarter turns clockwise the finished sheet was rotated by. */
  readonly quarterTurns: QuarterTurns;
  /**
   * The layout's own size before rotation, which is what the inverse map needs.
   *
   * Equal to `widthPx`/`heightPx` at 0 and 180 turns and swapped at 90 and 270,
   * so a drag handler that reached for the wrong pair would work by accident on
   * half the turns. Carried explicitly rather than re-derived for that reason.
   */
  readonly layoutWidthPx: number;
  readonly layoutHeightPx: number;
}

export interface PlanViewOptions {
  /** Id of the object drawn as selected, if any. */
  readonly selectedId?: string;
  /**
   * Draw grab handles for resizing. Off by default so a printed or exported
   * sheet carries only the drawing — editing chrome is for the screen.
   */
  readonly interactive?: boolean;
  /**
   * Quarter turns clockwise applied to the SHEET, not to the pool.
   *
   * The layout below is unchanged by this: everything is still laid out with the
   * shallow end at x = 0 and the house across the top, and the finished group is
   * turned. See `planRotation.ts` for why this is a view transform rather than a
   * change to the model.
   */
  readonly quarterTurns?: QuarterTurns;
}

/**
 * The spa has no id of its own — a job has at most one, and it is a field on
 * the job rather than a member of a list. This is the handle the move tool uses
 * for it, kept as a named constant so the renderer and the editor cannot
 * disagree about the string.
 */
export const SPA_MOVE_ID = 'spa';

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
  /**
   * How far the finished group is turned. Carried here only so every label can
   * counter-rotate about its own anchor and stay readable; nothing else in the
   * drawing knows or needs to know that the sheet is rotated.
   */
  readonly turns: QuarterTurns;
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

export function renderPlanView(
  job: Job,
  targetWidthPx = 1040,
  options: PlanViewOptions = {},
): PlanViewResult {
  const selectedId = options.selectedId;
  const pool = job.pool;
  const L = pool.lengthFt;
  const W = pool.widthFt;
  const spa = job.spa;
  /**
   * The slab, as drawn. The deck is no longer a border width, so the extents
   * below take its four margins rather than one number — see `deck.ts`.
   */
  const deckRect = job.deck?.outline ?? null;
  const deckM = deckRect
    ? deckMargins(deckRect, L, W)
    : { leftFt: 0, rightFt: 0, topFt: 0, bottomFt: 0 };
  /** The widest margin, where a single figure is still needed for clearance. */
  const deckW = Math.max(deckM.leftFt, deckM.rightFt, deckM.topFt, deckM.bottomFt);
  const setback = job.site.distanceToFoundationFt;
  const over = job.excavation.bondBeamFormOffsetFt;

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

  /**
   * Where an attached spa sits. It always projects outward by its length and
   * spans its width along the wall, so the shape rotates with the wall rather
   * than changing proportions when it is moved around a corner.
   */
  const spaPlace = spa?.placement ?? { wall: 'deep' as const, alongFt: (W - spaW) / 2 };
  const spaOutside = Boolean(spa && !spa.insetIntoPool);
  /**
   * A freely positioned spa is drawn length-along-x, width-along-y: with no wall
   * there is nothing to take an orientation from. A wall-placed one keeps the
   * old behaviour, so a job saved before free placement opens unchanged.
   */
  const spaRect = spa && spaOutside
    ? (spa.position
      ? { x: spa.position.xFt, y: spa.position.yFt, widthFt: spaL, heightFt: spaW }
      : placementRect(spaPlace, spaW, spaL, L, W, true))
    : null;
  const spaOn = (wall: PoolWall) =>
    (spaOutside && !spa?.position && spaPlace.wall === wall ? spaL : 0);
  /** A free spa can sit anywhere, so the sheet has to grow to wherever it went. */
  const freeSpaBounds = spa?.position && spaRect
    ? { left: -spaRect.x, right: spaRect.x + spaRect.widthFt - L, top: -spaRect.y, bottom: spaRect.y + spaRect.heightFt - W }
    : { left: 0, right: 0, top: 0, bottom: 0 };

  /**
   * The water envelope, in pool feet. An attached spa hangs off whichever wall
   * it is on, so the right-hand edge is not simply the pool length — and a
   * property-line dimension has to run from the nearest water, same as the
   * foundation setback.
   */
  const envRight = L + spaOn('deep');
  const lineDistance = (side: 'left' | 'right' | 'top' | 'bottom') =>
    (job.site.propertyLines ?? [])
      .filter((line) => line.side === side)
      .reduce((furthest, line) => Math.max(furthest, line.distanceFt), 0);

  // A property line is measured from the envelope edge on its own side, so the
  // right and bottom cases start beyond the pool rectangle. Room is left past
  // each line for its own label.
  const propTop = lineDistance('top');
  const propBottom = lineDistance('bottom');
  const propLeft = lineDistance('left');
  const propRight = lineDistance('right');

  // The house sits `setback` feet off the top long wall, and the band itself
  // needs room above that or it runs off the top of the drawing.
  const topExtent = Math.max(
    setback + houseDepth + 2.5,
    propTop > 0 ? propTop + 4 : 0,
    spaOn('top') + Math.max(deckM.topFt, over) + 3,
    freeSpaBounds.top + 3,
  );
  const bottomExtent = Math.max(
    (job.equipment?.distanceFromPoolFt ?? Math.max(deckM.bottomFt, over) + 4) + padD + 6,
    propBottom > 0 ? propBottom + 4 : 0,
    spaOn('bottom') + Math.max(deckM.bottomFt, over) + 3,
    freeSpaBounds.bottom + 3,
  );
  const leftExtent = Math.max(
    Math.max(deckM.leftFt, over) + 9 + spaOn('shallow'),
    freeSpaBounds.left + 3,
    propLeft > 0 ? propLeft + 4 : 0,
  );
  const rightExtent = Math.max(
    Math.max(deckM.rightFt, over) + spaOn('deep') + 12,
    freeSpaBounds.right + 3,
    propRight > 0 ? (envRight - L) + propRight + 4 : 0,
  );

  const contentW = leftExtent + L + rightExtent;
  const contentH = topExtent + W + bottomExtent;

  /**
   * The sheet is turned; the layout is not.
   *
   * `targetWidthPx` sizes the drawing to the column it will sit in, so on an odd
   * quarter turn the width the caller asked for is the layout's HEIGHT. Scaling
   * off `contentW` regardless would make a rotated plan overflow its column by
   * exactly the aspect ratio.
   */
  const turns = normalizeTurns(options.quarterTurns ?? 0);
  const acrossFt = rotatedExtentFt(turns, contentW, contentH).contentWidthFt;

  const pxPerFt = targetWidthPx / acrossFt;
  const widthPx = Math.round(contentW * pxPerFt);
  const heightPx = Math.round(contentH * pxPerFt);
  const sheet = rotatedSize(turns, { widthPx, heightPx });

  const s = (ft: number) => ft * pxPerFt;
  const x = (ft: number) => s(leftExtent + ft);
  const y = (ft: number) => s(topExtent + ft);
  const ctx: Ctx = { job, s, x, y, turns };

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
  if (spaRect) {
    // Over-dig wraps the spa on every side except the one it shares with the
    // pool, which is already inside the pool's own over-dig.
    parts.push(
      `<rect class="pv-excavation pv-spa-excavation" x="${n(x(spaRect.x - over))}" y="${n(y(spaRect.y - over))}" width="${n(s(spaRect.widthFt + 2 * over))}" height="${n(s(spaRect.heightFt + 2 * over))}"/>`,
    );
  }
  if (deckRect) {
    // One slab, drawn where it was drawn. It used to be a ring derived from a
    // width, plus a second ring around the spa — two rectangles standing in for
    // a shape nobody could actually describe.
    parts.push(
      `<rect class="pv-deck" x="${n(x(deckRect.xFt))}" y="${n(y(deckRect.yFt))}" width="${n(s(deckRect.widthFt))}" height="${n(s(deckRect.heightFt))}"/>`,
    );
    if (spaRect) {
    }
  }

  // --- water ---------------------------------------------------------------
  parts.push(`<rect class="pv-water" x="${n(x(0))}" y="${n(y(0))}" width="${n(s(L))}" height="${n(s(W))}"/>`);

  if (spa && spa.insetIntoPool) {
    /**
     * An inset spa sits inside the pool rectangle, so it is drawn there rather
     * than hanging off an end. It used to be welded to (0, 0) — the shallow-end
     * corner — with no handle, so "corner spa" meant one specific corner and
     * nothing else. It now carries a free position like any other spa, so it can
     * go in whichever corner the yard wants or out in the middle of the water.
     */
    const inset = { x: spa.position?.xFt ?? 0, y: spa.position?.yFt ?? 0, widthFt: spaL, heightFt: spaW };
    const selected = selectedId === SPA_MOVE_ID;
    parts.push(
      `<rect class="pv-water pv-spa${selected ? ' pv-selected' : ''}"`
      + ` data-move-kind="spa" data-move-id="${SPA_MOVE_ID}"`
      + ` x="${n(x(inset.x))}" y="${n(y(inset.y))}" width="${n(s(inset.widthFt))}" height="${n(s(inset.heightFt))}"/>`,
    );
    /**
     * Dam wall on every edge that faces pool water — which is every edge not
     * lying on the pool's own boundary. A spa in a corner has two such edges, a
     * spa in the middle has four, and hardcoding two was only correct while it
     * could not be moved.
     */
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const edges: readonly (readonly [number, number, number, number, boolean])[] = [
      [inset.x, inset.y, inset.x + inset.widthFt, inset.y, near(inset.y, 0)],
      [inset.x, inset.y + inset.heightFt, inset.x + inset.widthFt, inset.y + inset.heightFt, near(inset.y + inset.heightFt, W)],
      [inset.x, inset.y, inset.x, inset.y + inset.heightFt, near(inset.x, 0)],
      [inset.x + inset.widthFt, inset.y, inset.x + inset.widthFt, inset.y + inset.heightFt, near(inset.x + inset.widthFt, L)],
    ];
    for (const [x1, y1, x2, y2, onPoolBoundary] of edges) {
      if (onPoolBoundary) continue;
      parts.push(
        `<line class="pv-damwall" x1="${n(x(x1))}" y1="${n(y(y1))}" x2="${n(x(x2))}" y2="${n(y(y2))}"/>`,
      );
    }
    const icx = inset.x + inset.widthFt / 2;
    const icy = inset.y + inset.heightFt / 2;
    parts.push(text(ctx, icx, icy - 0.5, 'SPA', 'pv-label-inset', 'middle'));
    parts.push(
      text(ctx, icx, icy + 0.9, `${feetInches(spaL)} × ${feetInches(spaW)} inset`, 'pv-note-inset', 'middle'),
    );
    if (options.interactive && selected) parts.push(resizeGrip(ctx, inset, 'spa', SPA_MOVE_ID));
  } else if (spa && spaRect) {
    const selected = selectedId === SPA_MOVE_ID;
    parts.push(
      `<rect class="pv-water pv-spa${selected ? ' pv-selected' : ''}${spa.placement ? '' : ' pv-unplaced'}"`
      + ` data-move-kind="spa" data-move-id="${SPA_MOVE_ID}" data-move-wall="${spaPlace.wall}"`
      + ` x="${n(x(spaRect.x))}" y="${n(y(spaRect.y))}" width="${n(s(spaRect.widthFt))}" height="${n(s(spaRect.heightFt))}"/>`,
    );
    // Dam wall on the shared edge — whichever edge that now is.
    const shared = spaPlace.wall === 'shallow' || spaPlace.wall === 'deep'
      ? { x1: spaPlace.wall === 'deep' ? spaRect.x : spaRect.x + spaRect.widthFt, y1: spaRect.y, x2: spaPlace.wall === 'deep' ? spaRect.x : spaRect.x + spaRect.widthFt, y2: spaRect.y + spaRect.heightFt }
      : { x1: spaRect.x, y1: spaPlace.wall === 'bottom' ? spaRect.y : spaRect.y + spaRect.heightFt, x2: spaRect.x + spaRect.widthFt, y2: spaPlace.wall === 'bottom' ? spaRect.y : spaRect.y + spaRect.heightFt };
    parts.push(
      `<line class="pv-damwall" x1="${n(x(shared.x1))}" y1="${n(y(shared.y1))}" x2="${n(x(shared.x2))}" y2="${n(y(shared.y2))}"/>`,
    );
    const cx = spaRect.x + spaRect.widthFt / 2;
    const cy = spaRect.y + spaRect.heightFt / 2;
    parts.push(text(ctx, cx, cy, 'SPA', 'pv-label-inset', 'middle'));
    parts.push(
      text(ctx, cx, cy + 1.4, `${feetInches(spaL)} × ${feetInches(spaW)}`, 'pv-note-inset', 'middle'),
    );
    parts.push(...objectDims(ctx, spaRect, spaPlace.wall, L, W));
    if (options.interactive && selected) parts.push(resizeGrip(ctx, spaRect, 'spa', SPA_MOVE_ID));
  }

  // --- depth profile: breakover stations across the pool --------------------
  const p = pool.profile;
  const profileStations = depthStations(p);
  const profileSegments = segmentsFromProfile(p);
  const deepest = maxDepth(profileSegments);
  const stations = profileStations.slice(1, -1).map((station) => ({
    at: station.stationFt,
    label: station.depthFt === deepest ? 'middle deep' : 'breakover',
  }));
  for (const st of stations) {
    if (st.at <= 0 || st.at >= L) continue;
    parts.push(
      `<line class="pv-station" x1="${n(x(st.at))}" y1="${n(y(0))}" x2="${n(x(st.at))}" y2="${n(y(W))}"/>`,
    );
    parts.push(text(ctx, st.at, 1.0, st.label, 'pv-station-label', 'middle'));
  }

  const depthY = W * 0.36;
  let profileCursor = 0;
  for (const segment of profileSegments) {
    const middle = profileCursor + segment.length / 2;
    const label = segment.d1 === segment.d2 ? `${feetInches(segment.d1)} deep` : 'slope';
    parts.push(text(ctx, middle, depthY, label, segment.d1 === segment.d2 ? 'pv-depth' : 'pv-depth-soft', 'middle'));
    profileCursor += segment.length;
  }

  // --- steps and seats ------------------------------------------------------
  // Drawn from each object's placement so the drawing shows where the thing is
  // actually going. An object with no placement keeps the old convention and is
  // marked unplaced, rather than being drawn somewhere specific and looking
  // like a decision nobody made.
  for (const st of pool.steps) {
    const wFt = inToFt(st.treadWidthIn);
    const runFt = inToFt(st.treadRunIn);
    const depth = runFt * st.treadCount;
    const place = st.placement ?? { wall: 'shallow' as const, alongFt: (W - wFt) / 2 };
    // Free position wins. A stair coming off a tanning ledge is against no pool
    // wall at all, so it is drawn run-along-x, width-along-y.
    const rect = st.position
      ? { x: st.position.xFt, y: st.position.yFt, widthFt: depth, heightFt: wFt }
      : placementRect(place, wFt, depth, L, W);
    const selected = selectedId === st.id;
    parts.push(
      `<rect class="pv-step${selected ? ' pv-selected' : ''}${st.placement ? '' : ' pv-unplaced'}"`
      + ` data-move-kind="step" data-move-id="${esc(st.id)}" data-move-wall="${place.wall}"`
      + ` x="${n(x(rect.x))}" y="${n(y(rect.y))}" width="${n(s(rect.widthFt))}" height="${n(s(rect.heightFt))}"/>`,
    );
    // Tread lines run across the stair, perpendicular to the direction it
    // descends, which flips with the wall.
    const acrossX = place.wall === 'shallow' || place.wall === 'deep';
    for (let i = 1; i <= st.treadCount; i++) {
      const t = (acrossX ? rect.widthFt : rect.heightFt) * (i / st.treadCount);
      parts.push(
        acrossX
          ? `<line class="pv-step-tread" x1="${n(x(rect.x + (place.wall === 'shallow' ? t : rect.widthFt - t)))}" y1="${n(y(rect.y))}" x2="${n(x(rect.x + (place.wall === 'shallow' ? t : rect.widthFt - t)))}" y2="${n(y(rect.y + rect.heightFt))}"/>`
          : `<line class="pv-step-tread" x1="${n(x(rect.x))}" y1="${n(y(rect.y + (place.wall === 'top' ? t : rect.heightFt - t)))}" x2="${n(x(rect.x + rect.widthFt))}" y2="${n(y(rect.y + (place.wall === 'top' ? t : rect.heightFt - t)))}"/>`,
      );
    }
    parts.push(text(ctx, rect.x + rect.widthFt / 2, rect.y + rect.heightFt + 0.9,
      `${st.treadCount} treads @ ${st.treadRunIn}"${st.placement ? '' : ' · unplaced'}`, 'pv-note', 'middle'));
    parts.push(...objectDims(ctx, rect, place.wall, L, W));
    if (options.interactive && selected) parts.push(resizeGrip(ctx, rect, 'step', st.id));
    void acrossX;
  }

  for (const seat of pool.seats) {
    const wFt = inToFt(seat.surfaceWidthIn);
    const dFt = inToFt(seat.surfaceDepthIn);
    const place = seat.placement ?? { wall: 'bottom' as const, alongFt: L * 0.62 };
    /*
     * Free orientation matches the default wall placement — surface WIDTH runs
     * along x, surface DEPTH into the pool — so a seat that has always been on
     * the bottom wall keeps its shape the first time it is dragged or resized.
     * Defining it the other way round flipped every bench the moment it moved.
     */
    const rect = seat.position
      ? { x: seat.position.xFt, y: seat.position.yFt, widthFt: wFt, heightFt: dFt }
      : placementRect(place, wFt, dFt, L, W);
    const selected = selectedId === seat.id;
    parts.push(
      `<rect class="pv-seat${selected ? ' pv-selected' : ''}${seat.placement ? '' : ' pv-unplaced'}"`
      + ` data-move-kind="seat" data-move-id="${esc(seat.id)}" data-move-wall="${place.wall}"`
      + ` x="${n(x(rect.x))}" y="${n(y(rect.y))}" width="${n(s(rect.widthFt))}" height="${n(s(rect.heightFt))}"/>`,
    );
    parts.push(
      text(ctx, rect.x + rect.widthFt / 2, rect.y + rect.heightFt / 2,
        `${seat.kind} ${seat.id}${seat.placement ? '' : ' · unplaced'}`, 'pv-note-inset', 'middle'),
    );
    parts.push(...objectDims(ctx, rect, place.wall, L, W));
    if (options.interactive && selected) parts.push(resizeGrip(ctx, rect, 'seat', seat.id));

  }

  // --- accessories -----------------------------------------------------------
  // A bubbler sits in the water; a deck jet stands outside it on the deck and
  // arcs a stream in, which is why it is drawn beyond the water edge with its
  // throw shown as an arc rather than as a dot on the coping.
  for (const acc of pool.accessories ?? []) {
    const isDeckJet = acc.kind === 'deck-jet';
    const place = acc.placement ?? { wall: 'bottom' as const, alongFt: L / 2 };
    // Free position wins; the wall placement is only how an older job opens.
    const rect = acc.position
      ? { x: acc.position.xFt, y: acc.position.yFt, widthFt: 1, heightFt: 1 }
      : placementRect(place, 1, isDeckJet ? Math.max(deckW, 1.5) : 1.2, L, W, isDeckJet);
    const cx = rect.x + rect.widthFt / 2;
    const cy = rect.y + rect.heightFt / 2;
    const selected = selectedId === acc.id;
    /**
     * Which way a deck jet throws. A wall-placed one aims across its own wall; a
     * freely placed one has no wall, so it aims at the water — which is what a
     * deck jet is pointed at in the first place.
     */
    const aim: PoolWall = acc.position ? aimFromOutside(cx, cy, L, W) : place.wall;
    parts.push(isDeckJet
      ? deckJetSymbol(ctx, cx, cy, aim, selected, acc.id)
      : bubblerSymbol(ctx, cx, cy, selected, acc.id));
    if (isDeckJet) {
      // The throw, toward the water. Indicative: nobody dimensions an arc.
      const toward = aim === 'top' ? [cx, 0] : aim === 'bottom' ? [cx, W]
        : aim === 'shallow' ? [0, cy] : [L, cy];
      parts.push(
        `<path class="pv-jet-arc" d="M ${n(x(cx))} ${n(y(cy))} Q ${n(x((cx + toward[0]!) / 2))} ${n(y((cy + toward[1]!) / 2))} ${n(x(toward[0]!))} ${n(y(toward[1]!))}"/>`,
      );
    }
    parts.push(text(ctx, cx, cy + (isDeckJet ? -1.1 : 1.2), acc.id, 'pv-station-label', 'middle'));
  }

  // --- plumbing: outlets, skimmers, returns ---------------------------------
  const hyd = job.hydraulics;
  if (hyd) {
    const sep = hyd.mainDrains.separationFt;
    const deepestStations = profileStations.filter((station) => station.depthFt === deepest);
    const mdX = ((deepestStations[0]?.stationFt ?? L / 2) + (deepestStations.at(-1)?.stationFt ?? L / 2)) / 2;
    for (let i = 0; i < hyd.mainDrains.count; i++) {
      const offset = (i - (hyd.mainDrains.count - 1) / 2) * sep;
      parts.push(drainSymbol(ctx, mdX, W / 2 + offset));
    }
    parts.push(text(ctx, mdX, W / 2 + sep / 2 + 1.6, `${hyd.mainDrains.count} outlets @ ${feetInches(sep)} apart`, 'pv-note', 'middle'));

    const skimmers = hyd.runs.filter((r) => r.role === 'skimmer');
    skimmers.forEach((r, i) => {
      const sx = L * ((i + 1) / (skimmers.length + 1));
      parts.push(skimmerSymbol(ctx, sx, 0, 'top', r.id));
      parts.push(text(ctx, sx, -1.1, r.id, 'pv-note', 'middle'));
    });

    const returns = hyd.runs.filter((r) => r.role === 'return-branch');
    returns.forEach((_run, i) => {
      const rx = L * ((i + 1) / (returns.length + 1));
      parts.push(returnSymbol(ctx, rx, W, 'bottom', `R${i + 1}`));
    });
  }

  // --- equipment pad --------------------------------------------------------
  const padX = L - padW;
  // Pad sits at its real distance from the pool edge.
  const padY = W + (job.equipment?.distanceFromPoolFt ?? Math.max(deckM.bottomFt, over) + 4);
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
  const dimBelow = W + Math.max(deckM.bottomFt, over) + 2;
  parts.push(dimH(ctx, 0, L, dimBelow, feetInches(L)));
  parts.push(dimV(ctx, 0, W, -Math.max(deckM.leftFt, over) - 2.5, feetInches(W)));
  // 1:1 depth-to-foundation, local 307.2.2.2. The drawing shows the verdict, not
  // just the dimension — a plan that draws a violation as an ordinary dimension
  // is how it gets built that way.
  const governingDepth = Math.max(deepest, spa?.depthFt ?? 0);
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

  if (deckRect && deckM.bottomFt > 0) {
    parts.push(dimV(ctx, W, W + deckM.bottomFt, L * 0.2, `${feetInches(deckM.bottomFt)} deck`));
  }

  // --- property lines --------------------------------------------------------
  // Each is drawn the full width or height of the sheet, labelled, and
  // dimensioned back to the nearest water on its own side. No pass/fail badge:
  // unlike the 1:1 foundation rule, no property-line limit has been confirmed
  // for Lubbock, and a drawing must not imply a verdict nobody supplied.
  for (const line of job.site.propertyLines ?? []) {
    const d = line.distanceFt;
    if (!Number.isFinite(d) || d <= 0) continue;
    const label = line.label.toUpperCase();

    if (line.side === 'top' || line.side === 'bottom') {
      const at = line.side === 'top' ? -d : W + d;
      parts.push(
        `<line class="pv-property-line" x1="${n(x(-leftExtent + 1))}" y1="${n(y(at))}" x2="${n(x(L + rightExtent - 1))}" y2="${n(y(at))}"/>`,
      );
      parts.push(
        text(ctx, -leftExtent + 1.5, at + (line.side === 'top' ? -0.8 : 1.8), label, 'pv-property-label', 'start'),
      );
      // Measured from the envelope edge on this side, which for top/bottom is
      // the pool wall — a detached spa is centred and never the nearest point.
      parts.push(
        dimV(ctx, Math.min(at, line.side === 'top' ? 0 : W), Math.max(at, line.side === 'top' ? 0 : W),
          L * 0.65, `${feetInches(d)} to ${line.label.toLowerCase()}`, 'pv-dim-setback'),
      );
    } else {
      const at = line.side === 'left' ? -d : envRight + d;
      parts.push(
        `<line class="pv-property-line" x1="${n(x(at))}" y1="${n(y(-topExtent + 1))}" x2="${n(x(at))}" y2="${n(y(W + bottomExtent - 1))}"/>`,
      );
      parts.push(text(ctx, at, -topExtent + 2.2, label, 'pv-property-label', 'middle'));
      parts.push(
        dimH(ctx, Math.min(at, line.side === 'left' ? 0 : envRight), Math.max(at, line.side === 'left' ? 0 : envRight),
          W * 0.5, `${feetInches(d)} to ${line.label.toLowerCase()}`, 'pv-dim-setback'),
      );
    }
  }

  // profile runs along the top
  let cursorX = 0;
  for (const segment of profileSegments) {
    const len = segment.length;
    const label = segment.d1 === segment.d2
      ? (segment.d1 === deepest && deepest > profileStations[0]!.depthFt ? 'middle deep' : 'shallow')
      : 'transition';
    if (len > 0) {
      parts.push(dimH(ctx, cursorX, cursorX + len, -1.9, `${feetInches(len)} ${label}`, 'pv-dim-soft'));
      cursorX += len;
    }
  }

  // --- resize handles --------------------------------------------------------
  // Invisible thick strokes along each water edge. Dragging one resizes the
  // pool; the resize policy lives in poolResize.ts, not here.
  if (options.interactive) {
    const grab = (wall: string, x1: number, y1: number, x2: number, y2: number) =>
      `<line class="pv-wall-grab" data-resize-kind="pool" data-resize-wall="${wall}"`
      + ` x1="${n(x(x1))}" y1="${n(y(y1))}" x2="${n(x(x2))}" y2="${n(y(y2))}"/>`;
    parts.push(grab('shallow', 0, 0, 0, W));
    parts.push(grab('deep', L, 0, L, W));
    parts.push(grab('top', 0, 0, L, 0));
    parts.push(grab('bottom', 0, W, L, W));
  }

  // --- what the grey outlines are -------------------------------------------
  // Two dashed rectangles sit outside the water and nothing said what they
  // were. A drawing that leaves someone guessing at a line is worse than one
  // with a slightly busier margin.
  const legendY = -topExtent + 1.1;
  parts.push(text(ctx, L + 1.5, legendY, '— — over-dig (form line)', 'pv-legend', 'start'));
  if (deckRect) parts.push(text(ctx, L + 1.5, legendY + 1.1, '– – – deck edge', 'pv-legend', 'start'));

  // --- scale bar and legend -------------------------------------------------
  const barY = contentH - topExtent - 2.2;
  parts.push(scaleBar(ctx, -leftExtent + 1.5, barY, pxPerFt));

  // The whole drawing turns as one group. Nothing above this line knows about
  // rotation except the labels, which counter-rotate so they stay readable.
  const transform = contentTransform(turns, { widthPx, heightPx });
  const body = transform === ''
    ? parts.join('')
    : `<g transform="${transform}">${parts.join('')}</g>`;
  const rotationNote = turns === 0 ? '' : `, ${rotationLabel(turns).toLowerCase()}`;

  const svg = `<svg class="planview" viewBox="0 0 ${sheet.widthPx} ${sheet.heightPx}" width="100%" role="img" aria-label="Dimensioned plan view of ${esc(job.name)}${esc(rotationNote)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  const extents = rotatedExtentFt(turns, contentW, contentH);
  return {
    svg,
    pxPerFt,
    widthPx: sheet.widthPx,
    heightPx: sheet.heightPx,
    // Swapped on an odd turn, because `planPrintScale` reads these to choose the
    // architectural scale — and fitting a long pool on the sheet is most of the
    // reason to rotate in the first place.
    contentWidthFt: extents.contentWidthFt,
    contentHeightFt: extents.contentHeightFt,
    quarterTurns: turns,
    // Still the origin in the UNROTATED layout the drag rules are written in.
    // A pointer is mapped back through `inverseContentPoint` before it is
    // measured against these.
    originXPx: x(0),
    originYPx: y(0),
    layoutWidthPx: widthPx,
    layoutHeightPx: heightPx,
  };
}

/**
 * Position and size for one placed object.
 *
 * Every movable thing gets dimensioned where it sits: how far along the wall it
 * starts, how wide it is, and how far it reaches in. A drawing that lets you
 * move a bench but never says where you moved it to is a picture, not a plan —
 * and the person building it works from the numbers, not the shape.
 *
 * Drawn soft so the pool's own dimensions still lead. Which axis carries which
 * measurement flips with the wall, because "along" and "into" swap at a corner.
 */
function objectDims(
  ctx: Ctx,
  rect: { x: number; y: number; widthFt: number; heightFt: number },
  wall: PoolWall,
  poolLengthFt: number,
  poolWidthFt: number,
): string[] {
  const parts: string[] = [];
  const endsOn = wall === 'shallow' || wall === 'deep';

  if (endsOn) {
    // Runs across the width: position is measured down from the house side.
    const at = wall === 'shallow' ? rect.x + rect.widthFt + 1.4 : rect.x - 1.4;
    if (rect.y > 0.05) parts.push(dimV(ctx, 0, rect.y, at, feetInches(rect.y), 'pv-dim-soft'));
    parts.push(dimV(ctx, rect.y, rect.y + rect.heightFt, at, feetInches(rect.heightFt), 'pv-dim-soft'));
    const below = poolWidthFt + 1.2;
    parts.push(dimH(ctx, rect.x, rect.x + rect.widthFt, below, feetInches(rect.widthFt), 'pv-dim-soft'));
  } else {
    // Runs along the length: position is measured from the shallow end.
    const at = wall === 'top' ? rect.y + rect.heightFt + 1.4 : rect.y - 1.4;
    if (rect.x > 0.05) parts.push(dimH(ctx, 0, rect.x, at, feetInches(rect.x), 'pv-dim-soft'));
    parts.push(dimH(ctx, rect.x, rect.x + rect.widthFt, at, feetInches(rect.widthFt), 'pv-dim-soft'));
    const beside = poolLengthFt + 1.2;
    parts.push(dimV(ctx, rect.y, rect.y + rect.heightFt, beside, feetInches(rect.heightFt), 'pv-dim-soft'));
  }
  return parts;
}

// --- primitives -------------------------------------------------------------

function text(ctx: Ctx, xf: number, yf: number, label: string, cls: string, anchor: string): string {
  const px = ctx.x(xf);
  const py = ctx.y(yf);
  return `<text class="${cls}" x="${n(px)}" y="${n(py)}" text-anchor="${anchor}" dominant-baseline="middle"${upright(ctx, px, py)}>${escText(label)}</text>`;
}

/**
 * Keep a label the right way up on a rotated sheet.
 *
 * The label counter-rotates about its own anchor, so it stays exactly where the
 * drawing put it and reads horizontally at every turn. A dimension a builder has
 * to tilt the page to read is a dimension that gets misread.
 */
function upright(ctx: Ctx, px: number, py: number): string {
  return textTransform(ctx.turns, { x: px, y: py });
}

/**
 * The corner grip that resizes an object.
 *
 * Drawn ONLY on the selected object, and as a ring outside its corner rather
 * than a filled square inside it. The old grips were 0.9 ft squares sitting on
 * every step and bench whether or not anyone was editing them, and they read as
 * an extra tread — geometry rather than chrome. A handle that appears when you
 * select something, and nowhere else, cannot be mistaken for the thing it edits.
 */
function resizeGrip(ctx: Ctx, rect: { x: number; y: number; widthFt: number; heightFt: number }, target: string, id: string): string {
  const cx = ctx.x(rect.x + rect.widthFt);
  const cy = ctx.y(rect.y + rect.heightFt);
  return `<g class="pv-size-grip" data-resize-kind="object" data-resize-target="${esc(target)}" data-resize-id="${esc(id)}">`
    + `<circle class="pv-size-grip-hit" cx="${n(cx)}" cy="${n(cy)}" r="${n(ctx.s(1.1))}"/>`
    + `<circle class="pv-size-grip-ring" cx="${n(cx)}" cy="${n(cy)}" r="${n(ctx.s(0.5))}"/>`
    + `<line class="pv-size-grip-tick" x1="${n(cx - ctx.s(0.28))}" y1="${n(cy)}" x2="${n(cx + ctx.s(0.28))}" y2="${n(cy)}"/>`
    + `<line class="pv-size-grip-tick" x1="${n(cx)}" y1="${n(cy - ctx.s(0.28))}" x2="${n(cx)}" y2="${n(cy + ctx.s(0.28))}"/>`
    + `</g>`;
}

/**
 * Which pool edge a freely placed fitting faces.
 *
 * A deck jet stands outside the water and throws in, so the edge it faces is the
 * one it is beyond. Choosing by distance-from-centre instead would aim a jet
 * sitting inside the pool footprint back out through the nearest wall, which is
 * the opposite of where it throws. Only a fitting that is inside on both axes
 * falls back to nearest-edge, and there it genuinely is a judgement call.
 */
function aimFromOutside(cx: number, cy: number, L: number, W: number): PoolWall {
  if (cx < 0) return 'shallow';
  if (cx > L) return 'deep';
  if (cy < 0) return 'top';
  if (cy > W) return 'bottom';
  const toEdge: readonly (readonly [PoolWall, number])[] = [
    ['shallow', cx],
    ['deep', L - cx],
    ['top', cy],
    ['bottom', W - cy],
  ];
  return toEdge.reduce((best, item) => (item[1] < best[1] ? item : best))[0];
}

/**
 * Fittings, drawn as what they are.
 *
 * Every station used to be the same 0.55 ft circle in a different colour, which
 * on a printed sheet is five things nobody can tell apart. A plan is read by
 * shape before it is read by legend, so each fitting now has its own outline —
 * and each is drawn at the size it actually is rather than at a size that reads
 * from across the room.
 *
 * `inward` is the unit vector pointing from the wall into the water, so one
 * function serves all four walls without a per-wall branch at every call site.
 */
function inwardFrom(wall: PoolWall): readonly [number, number] {
  switch (wall) {
    case 'shallow': return [1, 0];
    case 'deep': return [-1, 0];
    case 'top': return [0, 1];
    default: return [0, -1];
  }
}

/**
 * A return eyeball. Small, and set INSIDE the wall where it is actually
 * installed — it used to be a large circle centred on the wall line, so half of
 * it sat out on the deck where no return has ever been fitted.
 */
function returnSymbol(ctx: Ctx, xf: number, yf: number, wall: PoolWall, id: string): string {
  const [ix, iy] = inwardFrom(wall);
  // Set in by its own radius plus the wall, so the fitting reads as being in
  // the wall rather than floating in the water.
  const cx = xf + ix * 0.55;
  const cy = yf + iy * 0.55;
  const r = 0.3;
  return `<g class="pv-fitting pv-return-fitting" data-station="${esc(id)}">`
    + `<circle class="pv-return-body" cx="${n(ctx.x(cx))}" cy="${n(ctx.y(cy))}" r="${n(ctx.s(r))}"/>`
    // The eyeball's throw direction. A return is directional and the drawing
    // should say which way it is aimed.
    + `<line class="pv-return-jet" x1="${n(ctx.x(cx))}" y1="${n(ctx.y(cy))}"`
    + ` x2="${n(ctx.x(cx + ix * 0.85))}" y2="${n(ctx.y(cy + iy * 0.85))}"/>`
    + `</g>`;
}

/**
 * A skimmer throat: a rectangle set into the wall, which is its actual shape.
 * Nothing else on the plan is a rectangle in the wall, so it reads at a glance.
 */
function skimmerSymbol(ctx: Ctx, xf: number, yf: number, wall: PoolWall, id: string): string {
  const [ix, iy] = inwardFrom(wall);
  const alongW = 1.25;
  const intoW = 0.75;
  // Straddles the wall line, because a skimmer genuinely is cut into the wall.
  const halfAlong = alongW / 2;
  const x0 = ix !== 0 ? xf - (ix < 0 ? intoW : 0) : xf - halfAlong;
  const y0 = iy !== 0 ? yf - (iy < 0 ? intoW : 0) : yf - halfAlong;
  const w = ix !== 0 ? intoW : alongW;
  const h = ix !== 0 ? alongW : intoW;
  return `<rect class="pv-fitting pv-skimmer-throat" data-station="${esc(id)}"`
    + ` x="${n(ctx.x(x0))}" y="${n(ctx.y(y0))}" width="${n(ctx.s(w))}" height="${n(ctx.s(h))}" rx="${n(ctx.s(0.12))}"/>`;
}

/** A main drain: a grated outlet on the floor. Circle plus its grate bars. */
function drainSymbol(ctx: Ctx, xf: number, yf: number): string {
  const r = 0.5;
  const cx = ctx.x(xf);
  const cy = ctx.y(yf);
  const rp = ctx.s(r);
  const bars = [-0.45, 0, 0.45].map((f) =>
    `<line class="pv-drain-bar" x1="${n(cx - rp * 0.8)}" y1="${n(cy + rp * f)}" x2="${n(cx + rp * 0.8)}" y2="${n(cy + rp * f)}"/>`).join('');
  return `<g class="pv-fitting pv-drain-grate"><circle class="pv-drain-body" cx="${n(cx)}" cy="${n(cy)}" r="${n(rp)}"/>${bars}</g>`;
}

/** A bubbler: a floor nozzle, drawn as concentric rings — water rising in place. */
function bubblerSymbol(ctx: Ctx, cxf: number, cyf: number, selected: boolean, id: string): string {
  const cx = ctx.x(cxf);
  const cy = ctx.y(cyf);
  return `<g class="pv-fitting pv-bubbler-icon${selected ? ' pv-selected' : ''}"`
    + ` data-move-kind="accessory" data-move-id="${esc(id)}">`
    + `<circle class="pv-bubbler-ring" cx="${n(cx)}" cy="${n(cy)}" r="${n(ctx.s(0.45))}"/>`
    + `<circle class="pv-bubbler-ring" cx="${n(cx)}" cy="${n(cy)}" r="${n(ctx.s(0.26))}"/>`
    + `<circle class="pv-bubbler-core" cx="${n(cx)}" cy="${n(cy)}" r="${n(ctx.s(0.1))}"/>`
    + `</g>`;
}

/** A deck jet: a nozzle on the deck, drawn as a small aimed wedge. */
function deckJetSymbol(
  ctx: Ctx, cxf: number, cyf: number, wall: PoolWall, selected: boolean, id: string,
): string {
  const [ix, iy] = inwardFrom(wall);
  // A triangle pointing the way the jet throws.
  const tipX = cxf + ix * 0.5;
  const tipY = cyf + iy * 0.5;
  // Perpendicular, for the two back corners.
  const px = -iy;
  const py = ix;
  const backX = cxf - ix * 0.25;
  const backY = cyf - iy * 0.25;
  const pts = [
    [tipX, tipY],
    [backX + px * 0.38, backY + py * 0.38],
    [backX - px * 0.38, backY - py * 0.38],
  ].map(([ax, ay]) => `${n(ctx.x(ax!))},${n(ctx.y(ay!))}`).join(' ');
  return `<polygon class="pv-fitting pv-deck-jet-icon${selected ? ' pv-selected' : ''}"`
    + ` data-move-kind="accessory" data-move-id="${esc(id)}" points="${pts}"/>`;
}

/** Horizontal dimension line with witness lines and arrowheads. */
function dimH(ctx: Ctx, x1: number, x2: number, atY: number, label: string, cls = 'pv-dim'): string {
  const yy = ctx.y(atY);
  return `<g class="${cls}">
    <line class="pv-witness" x1="${n(ctx.x(x1))}" y1="${n(ctx.y(atY > 0 ? atY - 0.6 : atY + 0.6))}" x2="${n(ctx.x(x1))}" y2="${n(yy)}"/>
    <line class="pv-witness" x1="${n(ctx.x(x2))}" y1="${n(ctx.y(atY > 0 ? atY - 0.6 : atY + 0.6))}" x2="${n(ctx.x(x2))}" y2="${n(yy)}"/>
    <line class="pv-dim-line" x1="${n(ctx.x(x1))}" y1="${n(yy)}" x2="${n(ctx.x(x2))}" y2="${n(yy)}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>
    <text class="pv-dim-text" x="${n((ctx.x(x1) + ctx.x(x2)) / 2)}" y="${n(yy)}" text-anchor="middle" dominant-baseline="middle"${upright(ctx, (ctx.x(x1) + ctx.x(x2)) / 2, yy)}>${escText(label)}</text>
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
    <text class="pv-dim-text" x="${n(xx)}" y="${n(mid)}" text-anchor="middle" dominant-baseline="middle"${upright(ctx, xx, mid)}>${escText(label)}</text>
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
    parts.push(`<text class="pv-scale-text" x="${n(a)}" y="${n(y0 + 15)}" text-anchor="middle"${upright(ctx, a, y0 + 15)}>${segs[i]}</text>`);
  }
  const last = ctx.x(atX + segs[segs.length - 1]!);
  parts.push(`<text class="pv-scale-text" x="${n(last)}" y="${n(y0 + 15)}" text-anchor="middle"${upright(ctx, last, y0 + 15)}>${segs[segs.length - 1]} ft</text>`);
  parts.push(
    `<text class="pv-scale-note" x="${n(ctx.x(atX))}" y="${n(y0 - 6)}" text-anchor="start"${upright(ctx, ctx.x(atX), y0 - 6)}>GRAPHIC SCALE · ${pxPerFt.toFixed(1)} px per ft as laid out</text>`,
  );
  return `<g>${parts.join('')}</g>`;
}
