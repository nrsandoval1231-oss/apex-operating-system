/**
 * Placement geometry: where a wall-mounted object sits, in plan feet.
 *
 * One module, used by both the renderer and the drag handler, so the rectangle
 * that gets drawn and the rectangle a pointer is tested against are the same
 * rectangle. Two copies of this arithmetic would drift, and the symptom would be
 * an object that does not sit where you dropped it.
 *
 * Plan coordinates: the pool occupies x 0..L and y 0..W. The shallow end is at
 * x = 0, the deep end at x = L, and the house side is y = 0.
 */

import type { Placement, PoolWall } from './types.ts';

/** A rectangle in plan feet. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly widthFt: number;
  readonly heightFt: number;
}

/** How long the wall is, and therefore how far along it something can slide. */
export function wallLengthFt(wall: PoolWall, poolLengthFt: number, poolWidthFt: number): number {
  return wall === 'shallow' || wall === 'deep' ? poolWidthFt : poolLengthFt;
}

/**
 * The rectangle an object occupies.
 *
 * `alongFt` is the near edge, `spanFt` the extent along the wall, and
 * `projectFt` how far it reaches away from the wall. Objects inside the pool
 * (steps, benches) project inward; an attached spa projects outward, which is
 * the only thing `outward` changes.
 */
export function placementRect(
  placement: Placement,
  spanFt: number,
  projectFt: number,
  poolLengthFt: number,
  poolWidthFt: number,
  outward = false,
): Rect {
  const along = clampAlong(placement.alongFt, spanFt, placement.wall, poolLengthFt, poolWidthFt);
  switch (placement.wall) {
    case 'shallow':
      return outward
        ? { x: -projectFt, y: along, widthFt: projectFt, heightFt: spanFt }
        : { x: 0, y: along, widthFt: projectFt, heightFt: spanFt };
    case 'deep':
      return outward
        ? { x: poolLengthFt, y: along, widthFt: projectFt, heightFt: spanFt }
        : { x: poolLengthFt - projectFt, y: along, widthFt: projectFt, heightFt: spanFt };
    case 'top':
      return outward
        ? { x: along, y: -projectFt, widthFt: spanFt, heightFt: projectFt }
        : { x: along, y: 0, widthFt: spanFt, heightFt: projectFt };
    case 'bottom':
    default:
      return outward
        ? { x: along, y: poolWidthFt, widthFt: spanFt, heightFt: projectFt }
        : { x: along, y: poolWidthFt - projectFt, widthFt: spanFt, heightFt: projectFt };
  }
}

/**
 * Keep an object on its wall.
 *
 * An object wider than its wall is pinned at zero rather than given a negative
 * position: the drawing then shows it overhanging, which is the truth, instead
 * of sliding it somewhere it would fit and hiding the problem.
 */
export function clampAlong(
  alongFt: number,
  spanFt: number,
  wall: PoolWall,
  poolLengthFt: number,
  poolWidthFt: number,
): number {
  if (!Number.isFinite(alongFt)) return 0;
  const limit = wallLengthFt(wall, poolLengthFt, poolWidthFt) - spanFt;
  if (limit <= 0) return 0;
  return Math.min(Math.max(alongFt, 0), limit);
}

/**
 * Turn a point in plan feet into a position along a wall.
 *
 * Used by the drag handler: the pointer carries an (x, y), the object needs an
 * `alongFt`. The grab offset is subtracted by the caller so an object does not
 * jump its own half-width to the cursor on the first pixel of movement.
 */
export function alongFromPoint(
  wall: PoolWall,
  pointXFt: number,
  pointYFt: number,
): number {
  return wall === 'shallow' || wall === 'deep' ? pointYFt : pointXFt;
}

/**
 * Which wall a point is nearest, so a drag can carry an object around a corner.
 *
 * Distance is measured to the wall line, not to the pool centre, because the
 * question being answered is "which wall is this being dropped on".
 */
export function nearestWall(
  pointXFt: number,
  pointYFt: number,
  poolLengthFt: number,
  poolWidthFt: number,
): PoolWall {
  const candidates: readonly (readonly [PoolWall, number])[] = [
    ['shallow', Math.abs(pointXFt - 0)],
    ['deep', Math.abs(pointXFt - poolLengthFt)],
    ['top', Math.abs(pointYFt - 0)],
    ['bottom', Math.abs(pointYFt - poolWidthFt)],
  ];
  return candidates.reduce((best, candidate) => (candidate[1] < best[1] ? candidate : best))[0];
}

/** How far the pointer must leave a wall before an object jumps to another. */
export const WALL_SWITCH_MARGIN_FT = 2.5;

/** Half-inch resolution: finer is not a dimension anyone builds to. */
export const snapAlong = (ft: number) => Math.round(ft * 24) / 24;

/**
 * The whole drag decision: pointer position in, new placement out.
 *
 * Extracted from the React component so it can be tested without a browser. The
 * component is then only responsible for turning a pointer event into plan feet
 * and handing the result back — the rules about which wall an object lands on
 * and where along it are all here, and all reachable from a unit test.
 */
export function resolveDrag(input: {
  readonly current: Placement;
  readonly pointXFt: number;
  readonly pointYFt: number;
  /** Along-wall distance from the object's near edge to the grab point. */
  readonly grabOffsetFt: number;
  readonly spanFt: number;
  readonly poolLengthFt: number;
  readonly poolWidthFt: number;
}): Placement {
  const { current, pointXFt, pointYFt, grabOffsetFt, spanFt, poolLengthFt: L, poolWidthFt: W } = input;

  const distanceTo = (wall: PoolWall) =>
    wall === 'shallow' ? Math.abs(pointXFt)
      : wall === 'deep' ? Math.abs(pointXFt - L)
        : wall === 'top' ? Math.abs(pointYFt)
          : Math.abs(pointYFt - W);

  // Stay put unless the pointer is meaningfully closer to another wall. Without
  // the margin an object flickers between two walls near a corner.
  const candidate = nearestWall(pointXFt, pointYFt, L, W);
  const wall = distanceTo(candidate) + WALL_SWITCH_MARGIN_FT < distanceTo(current.wall)
    ? candidate
    : current.wall;

  // Turning a corner changes which axis "along" means, so the grab offset from
  // the old wall no longer applies. Centring on the pointer is the least
  // surprising thing to do at that moment.
  const switched = wall !== current.wall;
  const raw = alongFromPoint(wall, pointXFt, pointYFt) - (switched ? spanFt / 2 : grabOffsetFt);

  return { wall, alongFt: snapAlong(clampAlong(raw, spanFt, wall, L, W)) };
}

/** Do two rectangles overlap? Touching edges do not count. */
export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.widthFt
    && b.x < a.x + a.widthFt
    && a.y < b.y + b.heightFt
    && b.y < a.y + a.heightFt
  );
}

/**
 * The plan footprint of a stair or a seat — one definition, used everywhere.
 *
 * The renderer, the drag handler and the takeoff all need this rectangle, and
 * for a while they each derived it themselves. Two of those copies disagreed
 * about which argument was the span and which the projection, which showed up as
 * a bench that flipped its shape the first time it was touched and a resize
 * anchor that sat where the object was not drawn. One function, three callers.
 *
 * Free `position` wins. Its orientation matches the default wall placement —
 * the dimension measured along the wall runs along x — so an object that has
 * always been on its default wall keeps its shape the first time it moves.
 */
export function stepFootprint(
  step: { treadRunIn: number; treadCount: number; treadWidthIn: number; position?: { xFt: number; yFt: number }; placement?: Placement },
  poolLengthFt: number,
  poolWidthFt: number,
): Rect {
  const runFt = (step.treadRunIn / 12) * step.treadCount;
  const widthFt = step.treadWidthIn / 12;
  if (step.position) {
    return { x: step.position.xFt, y: step.position.yFt, widthFt: runFt, heightFt: widthFt };
  }
  const place = step.placement ?? { wall: 'shallow' as const, alongFt: (poolWidthFt - widthFt) / 2 };
  return placementRect(place, widthFt, runFt, poolLengthFt, poolWidthFt);
}

export function seatFootprint(
  seat: { surfaceWidthIn: number; surfaceDepthIn: number; position?: { xFt: number; yFt: number }; placement?: Placement },
  poolLengthFt: number,
  poolWidthFt: number,
): Rect {
  const widthFt = seat.surfaceWidthIn / 12;
  const depthFt = seat.surfaceDepthIn / 12;
  if (seat.position) {
    return { x: seat.position.xFt, y: seat.position.yFt, widthFt, heightFt: depthFt };
  }
  const place = seat.placement ?? { wall: 'bottom' as const, alongFt: poolLengthFt * 0.62 };
  return placementRect(place, widthFt, depthFt, poolLengthFt, poolWidthFt);
}
