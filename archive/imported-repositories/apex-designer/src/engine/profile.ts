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

import type { DepthProfile, DepthStation, LegacyDepthProfile, StationDepthProfile } from './types.ts';

export function isStationDepthProfile(profile: DepthProfile): profile is StationDepthProfile {
  return profile.kind === 'linear-stations' && Array.isArray(profile.stations);
}

export function legacyProfileToStations(profile: LegacyDepthProfile): StationDepthProfile {
  return {
    shallowRun: profile.shallowRun,
    transitionRun: profile.transitionRun,
    deepRun: profile.deepRun,
    shallowDepth: profile.shallowDepth,
    deepDepth: profile.deepDepth,
    kind: 'linear-stations',
    stations: [
      { stationFt: 0, depthFt: profile.shallowDepth },
      { stationFt: profile.shallowRun, depthFt: profile.shallowDepth },
      { stationFt: profile.shallowRun + profile.transitionRun, depthFt: profile.deepDepth },
      { stationFt: profile.shallowRun + profile.transitionRun + profile.deepRun, depthFt: profile.deepDepth },
    ].filter((station, index, all) => index === 0 || station.stationFt !== all[index - 1]!.stationFt),
  };
}

export function depthStations(profile: DepthProfile): readonly DepthStation[] {
  return isStationDepthProfile(profile) ? profile.stations : legacyProfileToStations(profile).stations;
}

export function sportsPoolProfile(lengthFt: number): StationDepthProfile {
  const fifth = lengthFt / 5;
  return {
    shallowRun: fifth,
    transitionRun: fifth,
    deepRun: lengthFt - fifth * 2,
    shallowDepth: 3,
    deepDepth: 5,
    kind: 'linear-stations',
    preset: 'sports-3-5-3',
    stations: [
      { stationFt: 0, depthFt: 3 },
      { stationFt: fifth, depthFt: 3 },
      { stationFt: fifth * 2, depthFt: 5 },
      { stationFt: fifth * 3, depthFt: 5 },
      { stationFt: fifth * 4, depthFt: 3 },
      { stationFt: lengthFt, depthFt: 3 },
    ],
  };
}

export function segmentsFromProfile(profile: DepthProfile): ProfileSegment[] {
  const stations = depthStations(profile);
  return stations.slice(0, -1).map((station, index) => {
    const next = stations[index + 1]!;
    const flat = station.depthFt === next.depthFt;
    return {
      name: flat ? `${station.depthFt} ft flat` : 'Slope',
      length: next.stationFt - station.stationFt,
      d1: station.depthFt,
      d2: next.depthFt,
    };
  });
}

export function validateDepthStations(profile: DepthProfile, lengthFt: number): string[] {
  const stations = depthStations(profile);
  const errors: string[] = [];
  if (stations.length < 2) errors.push('Depth profile requires at least two stations.');
  if (stations[0]?.stationFt !== 0) errors.push('Depth profile must start at station 0.');
  if (Math.abs((stations.at(-1)?.stationFt ?? -1) - lengthFt) > 0.01) {
    errors.push(`Depth profile must end at pool length ${lengthFt.toFixed(2)} ft.`);
  }
  stations.forEach((station, index) => {
    if (!Number.isFinite(station.stationFt) || !Number.isFinite(station.depthFt) || station.depthFt <= 0) {
      errors.push(`Depth station ${index + 1} must have a finite station and positive depth.`);
    }
    if (index > 0 && station.stationFt <= stations[index - 1]!.stationFt) {
      errors.push('Depth stations must be in strictly increasing order.');
    }
  });
  return errors;
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
  profile: DepthProfile,
  stationFt: number,
): number {
  const stations = depthStations(profile);
  if (!Number.isFinite(stationFt) || stationFt <= stations[0]!.stationFt) return stations[0]!.depthFt;
  const last = stations.at(-1)!;
  if (stationFt >= last.stationFt) return last.depthFt;
  const right = stations.findIndex((station) => station.stationFt >= stationFt);
  const a = stations[right - 1]!;
  const b = stations[right]!;
  const through = (stationFt - a.stationFt) / (b.stationFt - a.stationFt);
  return a.depthFt + through * (b.depthFt - a.depthFt);
}

/**
 * The deepest water under an object's footprint.
 *
 * This is what `floorDepthFt` on a step or a seat should be, and it was being
 * invented instead — a new bench got `shallowDepth + 1` regardless of where it
 * sat, which is how the section came to draw a bench hanging clear of the floor.
 *
 * A profile may rise or fall (the 3-5-3 sports profile does both), so inspect
 * both edges and every profile vertex under the footprint. Taking the deepest
 * rather than the average is deliberate: a seat has to reach the floor
 * everywhere it spans, and a figure that is too shallow is one that leaves it
 * floating.
 */
export function floorDepthUnder(
  profile: DepthProfile,
  fromFt: number,
  toFt: number,
): number {
  const a = Math.min(fromFt, toFt);
  const b = Math.max(fromFt, toFt);
  const candidates = [a, b, ...depthStations(profile).map((station) => station.stationFt).filter((x) => x > a && x < b)];
  return Math.max(...candidates.map((station) => depthAtStation(profile, station)));
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
  profile: DepthProfile,
  fromFt: number,
  toFt: number,
): number {
  const a = Math.min(fromFt, toFt);
  const b = Math.max(fromFt, toFt);
  if (!(b > a)) return depthAtStation(profile, a);

  // Break the span on the profile's own vertices, then integrate each piece as a
  // trapezoid — exact, because depth is linear between vertices.
  const cuts = [a, b, ...depthStations(profile).map((station) => station.stationFt)]
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
