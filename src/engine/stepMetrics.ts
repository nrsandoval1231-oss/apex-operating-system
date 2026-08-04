/**
 * Step and bench measurements, for the sheet and for the field.
 *
 * "How tall is the stair and how deep is each tread" is a question someone asks
 * standing in a hole, and the sheet could not answer it: the plan drew the
 * stair, the code table checked it, and nowhere printed the rise.
 *
 * NOT PART OF THE APPROVED QUANTITY PAYLOAD. That payload is a fixed list of 17
 * codes carried under a SHA-256 that Proposal independently revalidates. Adding
 * to it moves the digest, which is a contract change, not a display change.
 * These are derived from inputs the payload already covers and are printed, not
 * signed. Promoting any of them later is a deliberate act with a version bump.
 */

import type { Seat, StepSet } from './types.ts';
import { inToFt } from './units.ts';

export interface StepMetrics {
  readonly id: string;
  readonly treadCount: number;
  /** Horizontal run of one tread — how deep it is front to back. ft */
  readonly treadRunFt: number;
  /** Side-to-side stair width. ft */
  readonly treadWidthFt: number;
  /**
   * Floor to deck, summed from the risers.
   *
   * Summed rather than taken from the water depth because they are different
   * measurements and can legitimately disagree: the stack is floor to deck, and
   * the water depth stops at the waterline. The difference is the freeboard.
   */
  readonly totalRiseFt: number;
  /** Each riser, bottom first. in */
  readonly riserHeightsIn: readonly number[];
  /** The tallest riser, which is what the code limit applies to. in */
  readonly maxRiserIn: number;
  /** How far the whole stair projects from the wall. ft */
  readonly totalRunFt: number;
  /** Plan area of the tread surfaces. sf */
  readonly treadAreaSf: number;
  /** Total leading edge, which is what the contrasting stripe is measured in. ft */
  readonly leadingEdgeFt: number;
  /** Water depth where it lands. ft */
  readonly floorDepthFt: number;
}

export interface SeatMetrics {
  readonly id: string;
  readonly kind: Seat['kind'];
  /** Surface depth below the waterline — the "height" a swimmer feels. in */
  readonly depthBelowWaterlineIn: number;
  /** Front to back. in */
  readonly surfaceDepthIn: number;
  /** Along the wall. in */
  readonly surfaceWidthIn: number;
  /** Seat surface to pool floor: how far it is raised off the bottom. ft */
  readonly heightAboveFloorFt: number;
  readonly surfaceAreaSf: number;
  readonly leadingEdgeLengthFt: number;
}

export function stepMetrics(step: StepSet): StepMetrics {
  const treadRunFt = inToFt(step.treadRunIn);
  const treadWidthFt = inToFt(step.treadWidthIn);
  const risers = step.riserHeightsIn;
  return {
    id: step.id,
    treadCount: step.treadCount,
    treadRunFt,
    treadWidthFt,
    totalRiseFt: inToFt(risers.reduce((sum, riser) => sum + riser, 0)),
    riserHeightsIn: risers,
    maxRiserIn: risers.length > 0 ? Math.max(...risers) : 0,
    totalRunFt: treadRunFt * step.treadCount,
    treadAreaSf: treadRunFt * treadWidthFt * step.treadCount,
    leadingEdgeFt: treadWidthFt * step.treadCount,
    floorDepthFt: step.floorDepthFt,
  };
}

export function seatMetrics(seat: Seat): SeatMetrics {
  return {
    id: seat.id,
    kind: seat.kind,
    depthBelowWaterlineIn: seat.depthBelowWaterlineIn,
    surfaceDepthIn: seat.surfaceDepthIn,
    surfaceWidthIn: seat.surfaceWidthIn,
    // The seat sits `depthBelowWaterline` down from the surface and the floor is
    // `floorDepthFt` down, so the gap between them is how high the ledge stands.
    heightAboveFloorFt: seat.floorDepthFt - inToFt(seat.depthBelowWaterlineIn),
    surfaceAreaSf: inToFt(seat.surfaceDepthIn) * inToFt(seat.surfaceWidthIn),
    leadingEdgeLengthFt: seat.leadingEdgeLengthFt,
  };
}
