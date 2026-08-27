/**
 * Pipe hydraulics primitives: Schedule 40 PVC dimensions, velocity, friction
 * loss, and fitting equivalent lengths.
 *
 * Friction loss is Hazen-Williams at C = 150 for PVC. Fittings use the
 * equivalent-length-in-diameters (L/D) method, which is size-independent and
 * avoids carrying a separate equivalent-length table per pipe size.
 */

export type NominalSize = '1.5' | '2' | '2.5' | '3';

/** Schedule 40 PVC inside diameters, inches. */
export const SCH40_ID: Record<NominalSize, number> = {
  '1.5': 1.61,
  '2': 2.067,
  '2.5': 2.469,
  '3': 3.068,
};

export const PIPE_SIZES: readonly NominalSize[] = ['1.5', '2', '2.5', '3'];

/** Hazen-Williams roughness coefficient for PVC. */
export const C_PVC = 150;

/**
 * Velocity in a full pipe.
 *   v (fps) = 0.4085 x Q (gpm) / d^2 (in)
 */
export function velocityFps(gpm: number, idIn: number): number {
  return (0.4085 * gpm) / (idIn * idIn);
}

/**
 * Hazen-Williams head loss, feet of water per 100 ft of pipe.
 *   h = 0.2083 x (100/C)^1.852 x Q^1.852 / d^4.8655
 */
export function frictionLossPer100Ft(gpm: number, idIn: number, c = C_PVC): number {
  if (gpm <= 0) return 0;
  return (0.2083 * Math.pow(100 / c, 1.852) * Math.pow(gpm, 1.852)) / Math.pow(idIn, 4.8655);
}

export type FittingKind =
  | '90-ell'
  | '45-ell'
  | 'tee-run'
  | 'tee-branch'
  | 'ball-valve'
  | 'gate-valve'
  | 'check-valve'
  | 'sweep-90';

/**
 * Equivalent length in pipe diameters (L/D). Standard values for turbulent flow
 * in commercial pipe; a 2 in 90 ell at L/D 30 is 30 x 2.067 in = 5.2 ft.
 */
export const FITTING_LD: Record<FittingKind, number> = {
  '90-ell': 30,
  'sweep-90': 20,
  '45-ell': 16,
  'tee-run': 20,
  'tee-branch': 60,
  'ball-valve': 3,
  'gate-valve': 8,
  'check-valve': 100,
};

export interface FittingCount {
  readonly kind: FittingKind;
  readonly count: number;
}

/** Equivalent length of a fitting set, in feet. */
export function fittingEquivalentLengthFt(
  fittings: readonly FittingCount[],
  idIn: number,
): number {
  return fittings.reduce((a, f) => a + (FITTING_LD[f.kind] * f.count * idIn) / 12, 0);
}

/** Smallest listed size whose velocity at `gpm` is at or under `limitFps`. */
export function smallestSizeForVelocity(gpm: number, limitFps: number): NominalSize | null {
  for (const size of PIPE_SIZES) {
    if (velocityFps(gpm, SCH40_ID[size]) <= limitFps) return size;
  }
  return null;
}

// --- manufacturer constraints -----------------------------------------------

/**
 * Hayward's "Maximum Recommended System Flow Rate by Pipe Size", from the
 * 400/600/800 Series VS Pumps Owner's Manual IS3200OX Rev B, section 4.3.
 *
 * This is a pump-manufacturer limit, not a code limit. It works out to about
 * 7 fps across the range — between the 6 fps design target and the 8 fps code
 * maximum — so it is its own threshold and is labeled as the manufacturer's.
 */
export const HAYWARD_MAX_SYSTEM_FLOW_GPM: Record<NominalSize, number> = {
  '1.5': 45,
  '2': 80,
  '2.5': 110,
  '3': 160,
};

/**
 * Minimum straight pipe between the pump suction inlet and any fitting, from the
 * same chart. Equivalent to 5 pipe diameters.
 */
export const HAYWARD_MIN_STRAIGHT_PIPE_IN: Record<NominalSize, number> = {
  '1.5': 7.5,
  '2': 10,
  '2.5': 12.5,
  '3': 15,
};

export const HAYWARD_SOURCE =
  "Hayward 400/600/800 Series VS Pumps Owner's Manual IS3200OX Rev B, Pipe Sizing Chart";
