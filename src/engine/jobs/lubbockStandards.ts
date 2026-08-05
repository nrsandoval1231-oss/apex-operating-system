/**
 * The three pools Apex actually builds.
 *
 * 12x24, 15x30 and 20x40, each with a 6x6 spa set into a corner and spilling
 * over into the pool. Travis puts these at roughly 90% of Lubbock work, so they
 * are what the app opens with — the previous buttons were engine fixtures and
 * diagnostic cases, which is the right set for testing the engine and the wrong
 * set for someone starting a job.
 *
 * Everything except length and width follows Travis's confirmed build standards:
 * the depth profile is always 3'-6" to 6'-0", the spa is always 6 x 6 x 3'-6",
 * and the deck is always a 4 ft border. That is what makes length x width a
 * complete specification.
 *
 * WHAT THESE ARE NOT: a survey or a plumbing design. Pipe run lengths, the gas
 * connected load, and the property lines are per-job measurements. They carry
 * the standard model's values so the engine has something to compute, and every
 * one of them is marked in the source it came from as a placeholder to replace.
 */

import { deckOutlineFromBorder } from '../deck.ts';
import { STANDARD_MODEL } from '../standardModel.ts';
import type { DepthProfile, Job } from '../types.ts';

/** The confirmed Apex depth profile, fitted to a length. */
function profileFor(lengthFt: number, runs: readonly [number, number, number]): DepthProfile {
  const [shallowRun, transitionRun, deepRun] = runs;
  if (shallowRun + transitionRun + deepRun !== lengthFt) {
    // The engine checks this too. Failing here means the table below is wrong,
    // which is worth catching at the source rather than as a takeoff refusal.
    throw new Error(`Runs for the ${lengthFt} ft pool do not sum to its length.`);
  }
  return { shallowRun, transitionRun, deepRun, shallowDepth: 3.5, deepDepth: 6 };
}

/**
 * The shallow-end tanning ledge, and the stair that comes off it.
 *
 * Apex's other standard shallow-end arrangement: a Baja shelf across the
 * shallow end with the entry stair stepping down off its deep edge, rather than
 * a stair straight off the wall.
 *
 * Three constraints shape the geometry, and all three come from the pool rather
 * than from taste:
 *
 *   - The spa is set into the shallow/house corner at (0, 0) and is 6 x 6, so
 *     the ledge starts 6 ft along the wall. Starting at 0 would draw it through
 *     the spa.
 *   - The ledge takes its width from what is left of the wall, so it always
 *     reaches the far side however wide the pool is.
 *   - The ledge is at most 5 ft deep AND never deep enough to push the stair
 *     past the breakover. On the 12 x 24 the shallow flat is only 8 ft, so a
 *     5 ft ledge would put the bottom tread on the slope. Sized against the run
 *     rather than fixed, the stair always lands on flat floor.
 *
 * The stair is positioned freely, because a stair off a ledge is against no
 * wall at all — it starts exactly where the ledge ends, which is the position
 * `abutMagnets` produces when you drag one onto the other by hand.
 */
function shallowLedgeAndStair(
  widthFt: number,
  shallowRunFt: number,
): Pick<Job['pool'], 'steps' | 'seats'> {
  const SPA_FT = 6;
  const STAIR_RUN_FT = 4; // 4 treads at the 12 in Lubbock minimum
  const acrossFt = widthFt - SPA_FT;
  const ledgeDepthFt = Math.min(5, shallowRunFt - STAIR_RUN_FT);
  return {
    seats: [
      {
        ...STANDARD_MODEL.pool.seats[0]!,
        id: 'TL1',
        kind: 'tanningLedge',
        // The Apex standard: always 10 in of water over the surface.
        depthBelowWaterlineIn: 10,
        surfaceWidthIn: Math.round(acrossFt * 12),
        surfaceDepthIn: Math.round(ledgeDepthFt * 12),
        leadingEdgeLengthFt: acrossFt,
        floorDepthFt: 3.5,
        isRequiredEntryExit: false,
        // Wall placement, not a free position: on the shallow wall the ledge's
        // width runs ACROSS the pool and its depth reaches into it, which is
        // the orientation a wall placement gives and a free one does not.
        placement: { wall: 'shallow', alongFt: SPA_FT },
      },
    ],
    steps: [
      {
        ...STANDARD_MODEL.pool.steps[0]!,
        treadWidthIn: Math.round(acrossFt * 12),
        floorDepthFt: 3.5,
        // Flush on the ledge's deep edge, matching its width.
        position: { xFt: ledgeDepthFt, yFt: SPA_FT },
      },
    ],
  };
}

function lubbockStandard(
  lengthFt: number,
  widthFt: number,
  runs: readonly [number, number, number],
  options: { readonly shallowLedge?: boolean } = {},
): Job {
  return {
    ...STANDARD_MODEL,
    name: `${widthFt} x ${lengthFt} — corner spa, spillover${options.shallowLedge ? ', tanning ledge' : ''}`,
    pool: {
      ...STANDARD_MODEL.pool,
      lengthFt,
      widthFt,
      profile: profileFor(lengthFt, runs),
      ...(options.shallowLedge ? shallowLedgeAndStair(widthFt, runs[0]) : {}),
      ...(options.shallowLedge ? {} : {
      steps: [
        {
          ...STANDARD_MODEL.pool.steps[0]!,
          // Clear of the spa. The spa is set into the shallow-end corner at
          // (0,0), so a stair on the same wall starting at 0 sits directly on
          // top of it — which is exactly what it did, and the tread lines read
          // as mystery lines through the spa. Start where the spa ends.
          placement: { wall: 'shallow', alongFt: 6 },
        },
      ],
      seats: [
        {
          ...STANDARD_MODEL.pool.seats[0]!,
          placement: { wall: 'bottom', alongFt: lengthFt * 0.55 },
        },
      ],
      }),
    },
    /*
     * NO PUMP AND NO GAS ON A PRESET.
     *
     * Every preset used to open onto a red code stop reading "this
     * configuration cannot be built as entered". It could — the numbers behind
     * the stop were invented, and the two placeholders were arguing with each
     * other rather than with reality.
     *
     * The gas stop was 455 cfh of connected load against a 250 cfh meter, and
     * the furnace, water heater and range making up that load are marked
     * PLACEHOLDER in the source they came from. The hydraulic stop was a pump
     * turning the water over in 5.66 h against a 6 h maximum — a pump chosen
     * for the standard model, judged against pipe runs it was never sized for.
     *
     * A stop that fires on every job teaches its reader to scroll past it, and
     * that costs the one that matters. So a preset states neither: the pump is
     * selected against real developed lengths, and the connected load is what
     * is actually on the meter. Both are per-job measurements.
     *
     * The RUNS stay. Their lengths are indicative and the sheet says so, but
     * they carry the spa's own suction and return — the Apex standard that a
     * spa is plumbed as its own body of water — and the plan draws the skimmers,
     * returns and outlets from them.
     */
    hydraulics: STANDARD_MODEL.hydraulics && {
      ...STANDARD_MODEL.hydraulics,
      pumpModel: undefined,
      runs: [
        ...STANDARD_MODEL.hydraulics.runs,
        // A spa is its own body of water: it needs a suction of its own and a
        // return of its own, not just the jet supply. Added on the presets and
        // NOT on STANDARD_MODEL, deliberately — STANDARD_MODEL is the fixture
        // the approved-quantity digest is pinned against, and developed run
        // length is one of the seventeen signed quantities.
        {
          id: 'SPA-SUCTION',
          label: 'Spa suction',
          role: 'suction-branch',
          lengthFt: 22,
          fittings: [{ kind: '90-ell', count: 3 }],
          flowBasis: { dividedBy: 2 },
        },
        {
          id: 'SPA-RETURN',
          label: 'Spa return',
          role: 'return-branch',
          lengthFt: 20,
          fittings: [{ kind: '90-ell', count: 2 }],
          flowBasis: { dividedBy: 4 },
        },
      ],
    },
    spa: {
      lengthFt: 6,
      widthFt: 6,
      depthFt: 3.5,
      damWallHeightFt: 1.5,
      damWallThicknessIn: 6,
      attachedToPool: true,
      // Set INTO the pool footprint at a corner rather than added outside it.
      // This is a volume question, not a cosmetic one: an inset spa takes its
      // footprint out of the pool's water, which moves every hydraulic number
      // downstream of volume.
      insetIntoPool: true,
      // Six jets in the wall is the Apex standard on every spa.
      jetCount: 6,
    },
    /*
     * The deck is sized to THIS pool, not inherited.
     *
     * Spreading STANDARD_MODEL gave every preset the 15 x 30 model's slab — a
     * 38 x 23 rectangle. On the 12 x 24 that was merely too big; on the 20 x 40
     * it does not contain the pool at all, and once the deck became a drawn
     * outline with a containment check, that preset threw instead of opening.
     * Nothing caught it because no test opened the large preset.
     */
    deck: STANDARD_MODEL.deck && {
      ...STANDARD_MODEL.deck,
      outline: deckOutlineFromBorder(lengthFt, widthFt, 4),
    },
    equipment: STANDARD_MODEL.equipment && {
      ...STANDARD_MODEL.equipment,
      gas: undefined,
    },
    site: {
      ...STANDARD_MODEL.site,
      // No property lines. A preset cannot know where the lot boundaries are,
      // and a plan that invents one is worse than a plan that shows none —
      // a reviewer cannot tell a placeholder from a measurement. Add them per
      // job in the editor.
      propertyLines: undefined,
    },
  };
}

/** 12 x 24. The small standard. */
export const LUBBOCK_12X24 = lubbockStandard(24, 12, [8, 11, 5]);

/** 15 x 30. The one the PRD's standard model is built on. */
export const LUBBOCK_15X30 = lubbockStandard(30, 15, [10, 14, 6]);

/** 20 x 40. The large standard. */
export const LUBBOCK_20X40 = lubbockStandard(40, 20, [12, 20, 8]);

/** The same three, with a shallow-end tanning ledge and the stair off it. */
export const LUBBOCK_12X24_LEDGE = lubbockStandard(24, 12, [8, 11, 5], { shallowLedge: true });
export const LUBBOCK_15X30_LEDGE = lubbockStandard(30, 15, [10, 14, 6], { shallowLedge: true });
export const LUBBOCK_20X40_LEDGE = lubbockStandard(40, 20, [12, 20, 8], { shallowLedge: true });

export const LUBBOCK_STANDARDS: readonly { readonly label: string; readonly job: Job }[] = [
  { label: `12' × 24'`, job: LUBBOCK_12X24 },
  { label: `15' × 30'`, job: LUBBOCK_15X30 },
  { label: `20' × 40'`, job: LUBBOCK_20X40 },
  { label: `12' × 24' + ledge`, job: LUBBOCK_12X24_LEDGE },
  { label: `15' × 30' + ledge`, job: LUBBOCK_15X30_LEDGE },
  { label: `20' × 40' + ledge`, job: LUBBOCK_20X40_LEDGE },
];
