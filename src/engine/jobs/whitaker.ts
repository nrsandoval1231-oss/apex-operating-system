/**
 * Whitaker — a completed Lubbock job, used to reconcile the tool against what
 * was actually built and bought.
 *
 * This is the test the PRD asks for: run a real job through and see whether the
 * numbers match the invoices.
 *
 * WHAT THE COST LEDGER EVIDENCES (Whitaker Final 7.21.26):
 *   - An automatic cover: "Pool Cover", "coping for cover", "cover install,
 *     cleaning cover box". So there is a cover and a cover box.
 *   - A cedar board fence, later stained. So a fence exists too — which means
 *     the barrier compliance path is a question, not an assumption.
 *   - An air blower, which normally means a spa.
 *   - "pvc sump, skimmer w/ round lid, autofill", a "skimmer plate".
 *   - A variable-speed pump, sanitizer, inline feeder, diverter valve, and
 *     "omniply" — Hayward Omni automation.
 *   - Two pipe light kits, an actuator with cord.
 *   - Shotcrete, tile, coping, plaster, pavers, irrigation, turf.
 *
 * WHAT IT DOES NOT CONTAIN: a single dimension, quantity or count. It is a cost
 * ledger. Every number the takeoff needs has to come from the job itself.
 *
 * So the geometry is a REQUIRED ARGUMENT, not a default. There is deliberately
 * no way to call this with assumed dimensions — a reconciliation against made-up
 * geometry would prove nothing.
 */

import { APEX_STANDARD_DETAIL } from '../standardDetail.ts';
import { findPumpModel } from '../pumpCatalog.ts';
import { STANDARD_MODEL } from '../standardModel.ts';
import type { Job } from '../types.ts';

export interface WhitakerDimensions {
  readonly lengthFt: number;
  readonly widthFt: number;
  readonly shallowDepthFt: number;
  readonly deepDepthFt: number;
  /** The three runs must add up to the length. */
  readonly shallowRunFt: number;
  readonly transitionRunFt: number;
  readonly deepRunFt: number;
  /** Pool edge to the nearest house foundation or footing. Local 307.2.2.2. */
  readonly distanceToFoundationFt: number;
  readonly deckWidthFt: number;
  /** Omit if there is no spa. The ledger's air blower suggests there is one. */
  readonly spa?: { lengthFt: number; widthFt: number; depthFt: number; insetIntoPool: boolean };
  readonly equipmentDistanceFromPoolFt: number;
}

/**
 * What was actually bought, for comparison against what the tool says to buy.
 * Every field optional: fill in whatever the invoices actually recorded.
 */
export interface WhitakerActuals {
  readonly haulLoads?: number;
  readonly truckCapacityLcy?: number;
  readonly guniteCy?: number;
  readonly rebarTons?: number;
  readonly tileLf?: number;
  readonly copingPieces?: number;
  readonly plasterSf?: number;
  readonly deckSf?: number;
}

export function whitakerJob(d: WhitakerDimensions): Job {
  return {
    name: 'Whitaker — built 2026, reconciliation',
    jurisdiction: 'Lubbock, TX',
    pool: {
      lengthFt: d.lengthFt,
      widthFt: d.widthFt,
      profile: {
        shallowRun: d.shallowRunFt,
        transitionRun: d.transitionRunFt,
        deepRun: d.deepRunFt,
        shallowDepth: d.shallowDepthFt,
        deepDepth: d.deepDepthFt,
      },
      // Steps and seats are not in the ledger. Carried from the standard model
      // so the geometry runs; replace with the real ones if they are known.
      steps: STANDARD_MODEL.pool.steps,
      seats: STANDARD_MODEL.pool.seats,
    },
    ...(d.spa
      ? {
          spa: {
            lengthFt: d.spa.lengthFt,
            widthFt: d.spa.widthFt,
            depthFt: d.spa.depthFt,
            damWallHeightFt: 1.5,
            damWallThicknessIn: 6,
            attachedToPool: true,
            insetIntoPool: d.spa.insetIntoPool,
          },
        }
      : {}),
    site: {
      distanceToFoundationFt: d.distanceToFoundationFt,
      foundationDescription: 'house slab foundation',
    },
    excavation: {
      ...STANDARD_MODEL.excavation,
      shellThicknessFt: APEX_STANDARD_DETAIL.shellThicknessIn / 12,
      truckCapacityLcy: 12,
    },
    hydraulics: {
      ...STANDARD_MODEL.hydraulics!,
      // Ledger shows a variable-speed pump; model unknown, so the catalogue
      // pump with published curves stands in until the real one is named.
      pumpModel: findPumpModel('SP32900VSPX1'),
    },
    finishes: STANDARD_MODEL.finishes!,
    deck: { ...STANDARD_MODEL.deck!, widthFt: d.deckWidthFt },
    equipment: {
      ...STANDARD_MODEL.equipment!,
      distanceFromPoolFt: d.equipmentDistanceFromPoolFt,
    },
    // The ledger shows both a cover and a fence. Which one carries barrier
    // compliance is a decision on the job, not something the invoices reveal,
    // so the cover is left off until that is answered — attaching it would make
    // the tool assert a compliance path nobody stated.
  };
}


/**
 * Whitaker as built, per the builder: 14 x 24, 3.5 to 6 ft, a 6 x 6 spa set INTO
 * the shallow corner, 10 ft off the house, 4 ft of deck all round, pad 25 ft away
 * on the side of the house.
 *
 * Still assumed and worth correcting: the 8 / 11 / 5 split of the 24 ft length
 * for "normal slope", the 3.5 ft spa depth, and the steps and bench carried over
 * from the standard model because the ledger records neither.
 */
export const WHITAKER: Job = whitakerJob({
  lengthFt: 24,
  widthFt: 14,
  shallowDepthFt: 3.5,
  deepDepthFt: 6,
  shallowRunFt: 8,
  transitionRunFt: 11,
  deepRunFt: 5,
  distanceToFoundationFt: 10,
  deckWidthFt: 4,
  spa: { lengthFt: 6, widthFt: 6, depthFt: 3.5, insetIntoPool: true },
  equipmentDistanceFromPoolFt: 25,
});
