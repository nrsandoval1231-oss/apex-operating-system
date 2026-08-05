/**
 * Piecewise-linear longitudinal depth profile, shared by geometry and excavation.
 *
 * A profile is a list of segments running from the shallow end wall to the deep
 * end wall. Each segment has a length and a depth at each end, so a flat run is
 * a segment with d1 === d2 and the transition is a segment with d1 !== d2.
 */

export interface ProfileSegment {
  readonly name: string;
  readonly length: number;
  readonly d1: number;
  readonly d2: number;
}

/** Longitudinal cross-section area (the area of one side wall). ft^2 */
export function crossSectionArea(segments: readonly ProfileSegment[]): number {
  return segments.reduce((a, s) => a + (s.length * (s.d1 + s.d2)) / 2, 0);
}

/** Total run of the profile. ft */
export function totalRun(segments: readonly ProfileSegment[]): number {
  return segments.reduce((a, s) => a + s.length, 0);
}

/**
 * Length of the floor measured along the slope, not in plan. Wetted floor area
 * uses this, not the plan run — a 14 ft transition dropping 2.5 ft is 14.22 ft
 * of plaster.
 */
export function floorSlantLength(segments: readonly ProfileSegment[]): number {
  return segments.reduce((a, s) => a + Math.hypot(s.length, s.d2 - s.d1), 0);
}

/**
 * Integral of clamp(d(x) - lo, 0, hi - lo) dx over the whole profile.
 *
 * This is the per-unit-width volume of the excavation solid that falls inside
 * the depth band [lo, hi]. Used to split cut volume across soil layers.
 * Evaluated analytically per segment; a linear segment crossing a band boundary
 * is split at the crossing.
 */
export function integrateDepthBand(
  segments: readonly ProfileSegment[],
  lo: number,
  hi: number,
): number {
  const t = hi - lo;
  if (!(t > 0)) return 0;
  let total = 0;
  for (const s of segments) {
    total += segmentBandArea(s, lo, hi);
  }
  return total;
}

function segmentBandArea(s: ProfileSegment, lo: number, hi: number): number {
  const t = hi - lo;
  const f = (d: number) => Math.min(Math.max(d - lo, 0), t);

  // Flat segment: constant clamp value.
  if (Math.abs(s.d2 - s.d1) < 1e-12) {
    return f(s.d1) * s.length;
  }

  // Linear segment. clamp() is piecewise-linear in x with breakpoints where
  // d(x) = lo and d(x) = hi. Split at those crossings and integrate each piece
  // with the trapezoid rule, which is exact for a linear function.
  const xs = new Set<number>([0, s.length]);
  for (const level of [lo, hi]) {
    const x = ((level - s.d1) / (s.d2 - s.d1)) * s.length;
    if (x > 0 && x < s.length) xs.add(x);
  }
  const pts = [...xs].sort((a, b) => a - b);

  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const xa = pts[i]!;
    const xb = pts[i + 1]!;
    const da = s.d1 + ((s.d2 - s.d1) * xa) / s.length;
    const db = s.d1 + ((s.d2 - s.d1) * xb) / s.length;
    area += ((f(da) + f(db)) / 2) * (xb - xa);
  }
  return area;
}

/** Deepest point of the profile. ft */
export function maxDepth(segments: readonly ProfileSegment[]): number {
  return segments.reduce((m, s) => Math.max(m, s.d1, s.d2), 0);
}

/**
 * Water depth at a station along the pool's length.
 *
 * The section needs this to sit an object on the floor beneath it rather than at
 * a depth entered somewhere else. Flat over the shallow run, linear through the
 * transition, flat again over the deep run; a station past either end clamps to
 * that end's depth rather than extrapolating a floor that does not exist.
 */
export function depthAtStation(
  profile: { shallowRun: number; transitionRun: number; shallowDepth: number; deepDepth: number },
  stationFt: number,
): number {
  const { shallowRun, transitionRun, shallowDepth, deepDepth } = profile;
  if (!Number.isFinite(stationFt) || stationFt <= shallowRun) return shallowDepth;
  if (transitionRun <= 0 || stationFt >= shallowRun + transitionRun) return deepDepth;
  const through = (stationFt - shallowRun) / transitionRun;
  return shallowDepth + through * (deepDepth - shallowDepth);
}

/**
 * The deepest water under an object's footprint.
 *
 * This is what `floorDepthFt` on a step or a seat should be, and it was being
 * invented instead — a new bench got `shallowDepth + 1` regardless of where it
 * sat, which is how the section came to draw a bench hanging clear of the floor.
 *
 * Depth never decreases with distance from the shallow end, so the deepest point
 * under a footprint is always its deep-side edge. Taking the deepest rather than
 * the average is deliberate: a seat has to reach the floor everywhere it spans,
 * and a figure that is too shallow is one that leaves it floating.
 */
export function floorDepthUnder(
  profile: { shallowRun: number; transitionRun: number; shallowDepth: number; deepDepth: number },
  fromFt: number,
  toFt: number,
): number {
  const deepEdge = Math.max(fromFt, toFt);
  return depthAtStation(profile, deepEdge);
}

/**
 * Average water depth under a footprint.
 *
 * This is what a seat or a stair actually displaces against: the floor under it
 * slopes, so a single depth taken at one edge is either too deep or too shallow
 * everywhere else. The average is the figure that makes `w x d x (d_floor -
 * d_seat)` a true volume rather than an approximation nobody stated.
 *
 * Integrated piecewise rather than sampled, so it is exact for the three-segment
 * profile this engine models and does not depend on a step count.
 */
export function averageFloorDepthUnder(
  profile: { shallowRun: number; transitionRun: number; shallowDepth: number; deepDepth: number },
  fromFt: number,
  toFt: number,
): number {
  const a = Math.min(fromFt, toFt);
  const b = Math.max(fromFt, toFt);
  if (!(b > a)) return depthAtStation(profile, a);

  const { shallowRun, transitionRun } = profile;
  const transitionEnd = shallowRun + transitionRun;
  // Break the span on the profile's own vertices, then integrate each piece as a
  // trapezoid — exact, because depth is linear between vertices.
  const cuts = [a, b, shallowRun, transitionEnd]
    .filter((x) => x >= a && x <= b)
    .sort((x, y) => x - y);

  let area = 0;
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const x0 = cuts[i]!;
    const x1 = cuts[i + 1]!;
    if (x1 <= x0) continue;
    area += ((depthAtStation(profile, x0) + depthAtStation(profile, x1)) / 2) * (x1 - x0);
  }
  return area / (b - a);
}
