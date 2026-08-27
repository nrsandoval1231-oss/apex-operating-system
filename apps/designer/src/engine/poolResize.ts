/**
 * Resize rules: drag a wall, get a buildable pool back.
 *
 * Pure functions, because the drag handler must not contain policy. What
 * happens to the depth profile when the pool gets shorter is a design decision
 * with test coverage, not a side effect of pointer arithmetic.
 */

import type { DepthProfile, Job, PoolWall } from './types.ts';
import { isStationDepthProfile } from './profile.ts';

/** Half-foot snap for plan dimensions; nobody lays out a shell to the inch. */
export const snapHalfFt = (ft: number) => Math.round(ft * 2) / 2;

/** Quarter-foot (3") snap for depths. */
export const snapQuarterFt = (ft: number) => Math.round(ft * 4) / 4;

export const MIN_POOL_LENGTH_FT = 10;
export const MAX_POOL_LENGTH_FT = 80;
export const MIN_POOL_WIDTH_FT = 8;
export const MAX_POOL_WIDTH_FT = 40;

/**
 * Fit the depth profile to a new length.
 *
 * The change is absorbed from the deep end backwards: deep flat first, then the
 * transition, then the shallow flat. That mirrors how these pools are actually
 * rethought when a lot forces them shorter — the shallow play area is the part
 * the customer bought, and it is the last thing to give.
 */
export function fitProfileToLength(profile: DepthProfile, lengthFt: number): DepthProfile {
  if (isStationDepthProfile(profile)) {
    const oldLength = profile.stations.at(-1)!.stationFt;
    const scale = oldLength > 0 ? lengthFt / oldLength : 1;
    return {
      ...profile,
      stations: profile.stations.map((station, index) => ({
        ...station,
        stationFt: index === profile.stations.length - 1 ? lengthFt : station.stationFt * scale,
      })),
      shallowRun: profile.shallowRun * scale,
      transitionRun: profile.transitionRun * scale,
      deepRun: profile.deepRun * scale,
    };
  }
  let shallowRun = profile.shallowRun;
  let transitionRun = profile.transitionRun;
  let deepRun = lengthFt - shallowRun - transitionRun;
  if (deepRun < 0) {
    transitionRun = Math.max(0, transitionRun + deepRun);
    deepRun = 0;
    shallowRun = lengthFt - transitionRun;
  }
  return { ...profile, shallowRun, transitionRun, deepRun };
}

/**
 * The whole wall-drag decision: which wall, where the pointer is, new job out.
 *
 * `targetFt` is the new length (end walls) or width (side walls) implied by the
 * pointer, before snapping and clamping. The caller derives it from geometry;
 * everything that is a rule rather than arithmetic lives here.
 */
export function resizePool(job: Job, wall: PoolWall, targetFt: number): Job {
  if (!Number.isFinite(targetFt)) return job;

  if (wall === 'shallow' || wall === 'deep') {
    const lengthFt = Math.min(
      Math.max(snapHalfFt(targetFt), MIN_POOL_LENGTH_FT),
      MAX_POOL_LENGTH_FT,
    );
    return {
      ...job,
      pool: {
        ...job.pool,
        lengthFt,
        profile: fitProfileToLength(job.pool.profile, lengthFt),
      },
    };
  }

  // An inset spa lives inside the plan footprint, so the pool can never be
  // dragged narrower than the spa that is set into it.
  const spaMin = job.spa?.insetIntoPool ? job.spa.widthFt + 2 : 0;
  const widthFt = Math.min(
    Math.max(snapHalfFt(targetFt), MIN_POOL_WIDTH_FT, spaMin),
    MAX_POOL_WIDTH_FT,
  );
  return { ...job, pool: { ...job.pool, widthFt } };
}

/** The four things the section lets you grab. */
export type SectionHandle = 'shallow-floor' | 'deep-floor' | 'breakover' | 'deep-start';

/**
 * Drag decision for the section: a handle and a pointer position in section
 * feet, a new depth profile out.
 *
 * Depths snap to 3" and stations to 6". The floor cannot cross itself: the
 * shallow floor stays at or above the deep floor, and the two stations keep
 * their order. Every clamp is here so the drag can only produce a profile the
 * geometry engine accepts.
 */
export function resolveSectionDrag(
  profile: DepthProfile,
  lengthFt: number,
  handle: SectionHandle,
  pointXFt: number,
  pointDepthFt: number,
): DepthProfile {
  switch (handle) {
    case 'shallow-floor': {
      const shallowDepth = Math.min(
        Math.max(snapQuarterFt(pointDepthFt), 1),
        profile.deepDepth,
      );
      return { ...profile, shallowDepth };
    }
    case 'deep-floor': {
      const deepDepth = Math.min(
        Math.max(snapQuarterFt(pointDepthFt), profile.shallowDepth),
        12,
      );
      return { ...profile, deepDepth };
    }
    case 'breakover': {
      // Moves the end of the shallow flat; the transition gives or takes so the
      // deep-floor station stays where it was.
      const deepStart = profile.shallowRun + profile.transitionRun;
      const shallowRun = Math.min(Math.max(snapHalfFt(pointXFt), 0), deepStart);
      return { ...profile, shallowRun, transitionRun: deepStart - shallowRun };
    }
    case 'deep-start':
    default: {
      // Moves where the deep flat begins; the deep run absorbs the change.
      const deepStart = Math.min(Math.max(snapHalfFt(pointXFt), profile.shallowRun), lengthFt);
      return {
        ...profile,
        transitionRun: deepStart - profile.shallowRun,
        deepRun: lengthFt - deepStart,
      };
    }
  }
}
