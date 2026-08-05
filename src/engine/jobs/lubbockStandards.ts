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

function lubbockStandard(
  lengthFt: number,
  widthFt: number,
  runs: readonly [number, number, number],
): Job {
  return {
    ...STANDARD_MODEL,
    name: `${widthFt} x ${lengthFt} — corner spa, spillover`,
    pool: {
      ...STANDARD_MODEL.pool,
      lengthFt,
      widthFt,
      profile: profileFor(lengthFt, runs),
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
    },
    hydraulics: STANDARD_MODEL.hydraulics && {
      ...STANDARD_MODEL.hydraulics,
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

export const LUBBOCK_STANDARDS: readonly { readonly label: string; readonly job: Job }[] = [
  { label: `12' × 24'`, job: LUBBOCK_12X24 },
  { label: `15' × 30'`, job: LUBBOCK_15X30 },
  { label: `20' × 40'`, job: LUBBOCK_20X40 },
];
