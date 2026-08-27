/** Unit conversions and physical constants. All engine math is in feet unless noted. */

/** US gallons per cubic foot. */
export const GAL_PER_CF = 7.48052;

/** Cubic feet per cubic yard. */
export const CF_PER_CY = 27;

export const IN_PER_FT = 12;

export function inToFt(inches: number): number {
  return inches / IN_PER_FT;
}

export function ftToIn(feet: number): number {
  return feet * IN_PER_FT;
}

export function cfToGal(cf: number): number {
  return cf * GAL_PER_CF;
}

export function cfToCy(cf: number): number {
  return cf / CF_PER_CY;
}
