/**
 * Free placement on an invisible grid.
 *
 * WHY THIS EXISTS ALONGSIDE `placement.ts` RATHER THAN REPLACING IT
 *
 * `Placement` gives an object one degree of freedom along a wall, and for a step
 * or a bench that is not a limitation — it is the truth. A stair is built into a
 * wall; a bench is a ledge along one. There is no such thing as a bench floating
 * in the middle of the pool, so a model that cannot express one is a model that
 * cannot express a mistake.
 *
 * A spa and a bubbler are different. A spa goes where the yard says it goes —
 * tucked into a corner, off the deep end, or set out in the middle. A bubbler
 * goes wherever the tanning ledge is. Forcing either onto a wall was the model
 * being wrong, not the model being careful.
 *
 * So: two degrees of freedom for the things that genuinely have two, and the
 * grid is what stops that freedom costing symmetry. Everything lands on a 6 inch
 * lattice, and the corners and centre pull harder than the rest, so "centred on
 * the pool" and "flush in the corner" are positions you can hit deliberately
 * rather than by nudging until it looks right.
 *
 * Pure and unit-tested, like the rest of the engine. The drag handler does the
 * pointer arithmetic and none of the policy.
 */

/** A point in plan feet, relative to the pool origin. */
export interface PlanPoint {
  readonly xFt: number;
  readonly yFt: number;
}

/**
 * The lattice. Six inches, which is the increment the rest of the tool already
 * resizes on and the smallest one anybody dimensions a pool deck to.
 */
export const GRID_FT = 0.5;

/**
 * How near a magnet has to be before it takes over. Just over two grid steps —
 * close enough that you have to mean it, far enough that you do not have to be
 * precise about meaning it.
 */
export const MAGNET_RANGE_FT = 1.25;

/** Nearest lattice point on one axis. */
export function snapToGrid(ft: number, gridFt: number = GRID_FT): number {
  if (!Number.isFinite(ft)) return 0;
  return Math.round(ft / gridFt) * gridFt;
}

/** Nearest lattice point. */
export function snapPoint(point: PlanPoint, gridFt: number = GRID_FT): PlanPoint {
  return { xFt: snapToGrid(point.xFt, gridFt), yFt: snapToGrid(point.yFt, gridFt) };
}

/** A named position worth landing on exactly. */
export interface Magnet {
  readonly id: string;
  readonly label: string;
  readonly at: PlanPoint;
}

/**
 * The positions symmetry actually cares about, for an object of a given size.
 *
 * Coordinates are the object's TOP-LEFT corner, the same anchor `position`
 * carries, so a magnet can be adopted without re-deriving anything.
 *
 * Four outside corners — the spa tucked past the pool corner, diagonally out.
 * Four inside corners — flush within the pool's own rectangle.
 * Four edge centres — centred on each wall, just outside it.
 * One pool centre — the island position.
 */
export function magnets(
  objectWidthFt: number,
  objectHeightFt: number,
  poolLengthFt: number,
  poolWidthFt: number,
): readonly Magnet[] {
  const L = poolLengthFt;
  const W = poolWidthFt;
  const w = objectWidthFt;
  const h = objectHeightFt;
  return [
    // Outside the corners, clear of the water on both axes.
    { id: 'corner-out-shallow-house', label: 'outside the shallow/house corner', at: { xFt: -w, yFt: -h } },
    { id: 'corner-out-deep-house', label: 'outside the deep/house corner', at: { xFt: L, yFt: -h } },
    { id: 'corner-out-shallow-yard', label: 'outside the shallow/yard corner', at: { xFt: -w, yFt: W } },
    { id: 'corner-out-deep-yard', label: 'outside the deep/yard corner', at: { xFt: L, yFt: W } },
    // Flush inside the pool's own corners.
    { id: 'corner-in-shallow-house', label: 'inside the shallow/house corner', at: { xFt: 0, yFt: 0 } },
    { id: 'corner-in-deep-house', label: 'inside the deep/house corner', at: { xFt: L - w, yFt: 0 } },
    { id: 'corner-in-shallow-yard', label: 'inside the shallow/yard corner', at: { xFt: 0, yFt: W - h } },
    { id: 'corner-in-deep-yard', label: 'inside the deep/yard corner', at: { xFt: L - w, yFt: W - h } },
    // Centred on each wall, sitting just outside it.
    { id: 'centre-deep', label: 'centred off the deep end', at: { xFt: L, yFt: (W - h) / 2 } },
    { id: 'centre-shallow', label: 'centred off the shallow end', at: { xFt: -w, yFt: (W - h) / 2 } },
    { id: 'centre-house', label: 'centred on the house side', at: { xFt: (L - w) / 2, yFt: -h } },
    { id: 'centre-yard', label: 'centred on the yard side', at: { xFt: (L - w) / 2, yFt: W } },
    // The middle of the water.
    { id: 'pool-centre', label: 'centred in the pool', at: { xFt: (L - w) / 2, yFt: (W - h) / 2 } },
  ];
}

export interface SnapResult {
  readonly at: PlanPoint;
  /** The magnet that claimed the position, or null when it landed on the grid. */
  readonly magnet: Magnet | null;
}

/**
 * Where a dragged object lands.
 *
 * A magnet wins inside its range; otherwise the grid does. The magnet is
 * returned rather than only its coordinates so the UI can say *why* the object
 * stopped where it did — "centred in the pool" is worth telling someone,
 * because it is the difference between symmetric and nearly symmetric.
 *
 * Magnets are tested against the RAW pointer position, not the snapped one.
 * Snapping first would quantise the distance and make a magnet either
 * unreachable or sticky depending on where it fell between lattice points.
 */
export function snapWithMagnets(
  raw: PlanPoint,
  objectWidthFt: number,
  objectHeightFt: number,
  poolLengthFt: number,
  poolWidthFt: number,
  rangeFt: number = MAGNET_RANGE_FT,
): SnapResult {
  if (!Number.isFinite(raw.xFt) || !Number.isFinite(raw.yFt)) {
    return { at: { xFt: 0, yFt: 0 }, magnet: null };
  }
  let best: Magnet | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const magnet of magnets(objectWidthFt, objectHeightFt, poolLengthFt, poolWidthFt)) {
    const dx = magnet.at.xFt - raw.xFt;
    const dy = magnet.at.yFt - raw.yFt;
    const distance = Math.hypot(dx, dy);
    if (distance <= rangeFt && distance < bestDistance) {
      best = magnet;
      bestDistance = distance;
    }
  }
  return best ? { at: best.at, magnet: best } : { at: snapPoint(raw), magnet: null };
}

/**
 * Hold an object inside a rectangle.
 *
 * Used for an inset spa, and it is a correctness constraint rather than a
 * nicety: `insetIntoPool` is what tells the excavation engine the spa needs no
 * cut outside the pool envelope. A spa flagged inset but drawn out on the deck
 * would report quantities for a pool nobody is building. Freedom for that object
 * means anywhere in the water, and moving it out of the water is a change of
 * kind — the Spillover mode — not a drag.
 */
export function clampWithin(
  at: PlanPoint,
  objectWidthFt: number,
  objectHeightFt: number,
  poolLengthFt: number,
  poolWidthFt: number,
): PlanPoint {
  const maxX = Math.max(0, poolLengthFt - objectWidthFt);
  const maxY = Math.max(0, poolWidthFt - objectHeightFt);
  return {
    xFt: Math.min(Math.max(at.xFt, 0), maxX),
    yFt: Math.min(Math.max(at.yFt, 0), maxY),
  };
}
