/**
 * Geometry & volume engine — build order step 1.
 *
 * Water volume in gallons and wetted surface area are the inputs to everything
 * downstream (hydraulics, plaster, tile), so they are proven first.
 *
 * Every output is a Calc. Nothing here returns a bare number.
 */

import { calc, fromCalc, inp, type Calc } from './calc.ts';
import { averageFloorDepthUnder } from './profile.ts';
import { seatFootprint, stepFootprint } from './placement.ts';
import { runGeometryCodeChecks, checkFoundationSetback, type CodeCheck } from './codeChecks.ts';
import {
  crossSectionArea,
  depthStations,
  floorSlantLength,
  segmentsFromProfile,
  totalRun,
  validateDepthStations,
  isStationDepthProfile,
  type ProfileSegment,
} from './profile.ts';
import type { Job, PoolBody, Seat, Spa, StepSet } from './types.ts';
import { CF_PER_CY, GAL_PER_CF, inToFt } from './units.ts';

export class GeometryInputError extends Error {}

/** A note the sheet must print — not a code check, an input reconciliation. */
export interface GeometryNote {
  readonly id: string;
  readonly severity: 'info' | 'warning';
  readonly message: string;
}

export interface GeometryResult {
  readonly segments: readonly ProfileSegment[];
  readonly checks: readonly CodeCheck[];
  readonly notes: readonly GeometryNote[];
  /** Maximum depth the 1:1 foundation setback allows on this site. ft */
  readonly maxAllowableDepthFt: number;

  readonly poolPlanArea: Calc;
  readonly poolPerimeter: Calc;
  readonly poolSectionArea: Calc;
  readonly poolGrossVolumeCf: Calc;
  readonly stepDisplacement: readonly Calc[];
  readonly seatDisplacement: readonly Calc[];
  readonly poolNetVolumeCf: Calc;
  readonly spaVolumeCf?: Calc;
  /** Present only when the spa is set into the pool footprint. */
  readonly spaInsetDeduction?: Calc;
  readonly totalVolumeCf: Calc;
  readonly totalVolumeGal: Calc;
  readonly averageDepth: Calc;

  readonly poolWettedArea: Calc;
  readonly spaWettedArea?: Calc;
  readonly totalWettedArea: Calc;
  readonly waterlinePerimeter: Calc;
}

/** Build the longitudinal segments from the depth profile, validating the runs. */
export function buildSegments(pool: PoolBody): ProfileSegment[] {
  const p = pool.profile;
  const errors = validateDepthStations(p, pool.lengthFt);
  if (errors.length > 0) throw new GeometryInputError(errors.join(' '));
  if (!isStationDepthProfile(p) && p.deepDepth < p.shallowDepth) {
    throw new GeometryInputError(
      `Deep depth ${p.deepDepth} ft is less than shallow depth ${p.shallowDepth} ft.`,
    );
  }
  const segments = segmentsFromProfile(p);

  const run = totalRun(segments);
  if (Math.abs(run - pool.lengthFt) > 0.01) {
    throw new GeometryInputError(
      `Depth profile runs total ${run.toFixed(2)} ft but the pool is ${pool.lengthFt.toFixed(2)} ft long. ` +
        'The final depth station must equal the pool length.',
    );
  }
  return segments;
}

export function computeGeometry(job: Job): GeometryResult {
  const pool = job.pool;
  const segments = buildSegments(pool);
  const notes: GeometryNote[] = [];

  const poolPlanArea = calc({
    id: 'geom.pool.planArea',
    label: 'Pool plan area (water surface)',
    formula: 'A_plan = L x W',
    unit: 'sf',
    inputs: [
      inp('L', 'Pool length', pool.lengthFt, 'ft'),
      inp('W', 'Pool width', pool.widthFt, 'ft'),
    ],
    compute: ({ L, W }) => L! * W!,
  });

  const poolPerimeter = calc({
    id: 'geom.pool.perimeter',
    label: 'Pool perimeter',
    formula: 'P = 2 x (L + W)',
    unit: 'ft',
    inputs: [
      inp('L', 'Pool length', pool.lengthFt, 'ft'),
      inp('W', 'Pool width', pool.widthFt, 'ft'),
    ],
    compute: ({ L, W }) => 2 * (L! + W!),
  });

  const stations = depthStations(pool.profile);
  const poolSectionArea = calc({
    id: 'geom.pool.sectionArea',
    label: 'Longitudinal section area (one side wall)',
    formula: 'A_sec = SUM(run x (depth_start + depth_end) / 2)',
    unit: 'sf',
    inputs: segments.map((segment, index) => inp(`A_${index + 1}`, segment.name, segment.length * (segment.d1 + segment.d2) / 2, 'sf')),
    compute: (values) => Object.values(values).reduce((total, value) => total + value, 0),
    notes: ['Trapezoidal rule on the piecewise-linear depth profile. Exact for straight slopes.'],
  });

  const poolGrossVolumeCf = calc({
    id: 'geom.pool.grossVolume',
    label: 'Pool gross water volume (before step and bench displacement)',
    formula: 'V_gross = A_sec x W',
    unit: 'cf',
    inputs: [fromCalc('A_sec', poolSectionArea), inp('W', 'Pool width', pool.widthFt, 'ft')],
    compute: ({ A_sec, W }) => A_sec! * W!,
  });

  /**
   * Floor depth is DERIVED from where the object sits, not read off the record.
   *
   * It used to be an entered number, and a new seat got `shallowDepth + 1`
   * regardless of where it was — so the bench on the standard model claimed a
   * 4'-6" floor while sitting over water 5'-8" deep and under-displaced by
   * roughly a third. Averaged across the footprint because the floor slopes: a
   * depth taken at one edge is wrong everywhere else.
   *
   * The consequence is deliberate and worth naming: MOVING AN OBJECT NOW CHANGES
   * THE TAKEOFF. A bench dragged from the shallow end to the deep end really
   * does displace more water, and the tool now says so.
   */
  const floorUnder = (rect: { x: number; widthFt: number }) =>
    averageFloorDepthUnder(pool.profile, rect.x, rect.x + rect.widthFt);
  const stepDisplacement = pool.steps.map((s) =>
    stepDisplacementCalc(s, floorUnder(stepFootprint(s, pool.lengthFt, pool.widthFt)), notes));
  const seatDisplacement = pool.seats.map((s) =>
    seatDisplacementCalc(s, floorUnder(seatFootprint(s, pool.lengthFt, pool.widthFt)), notes));

  const displacementTotal = [...stepDisplacement, ...seatDisplacement].reduce(
    (a, c) => a + c.value,
    0,
  );

  const poolNetVolumeCf = calc({
    id: 'geom.pool.netVolume',
    label: 'Pool net water volume',
    formula: 'V_net = V_gross - V_disp',
    unit: 'cf',
    inputs: [
      fromCalc('V_gross', poolGrossVolumeCf),
      inp('V_disp', 'Step + bench displacement', displacementTotal, 'cf'),
    ],
    compute: ({ V_gross, V_disp }) => V_gross! - V_disp!,
  });

  const spaVolumeCf = job.spa ? spaVolumeCalc(job.spa) : undefined;

  // A spa set into the pool's footprint takes water out of the pool. An attached
  // spa does not. Getting this backwards is worth about 1,900 gallons on a 6x6.
  const spaInsetDeduction =
    job.spa?.insetIntoPool === true
      ? calc({
          id: 'geom.spa.insetDeduction',
          label: 'Pool water displaced by the inset spa',
          formula: 'V = L_spa x W_spa x d_local',
          unit: 'cf',
          inputs: [
            inp('L_spa', 'Spa length', job.spa.lengthFt, 'ft'),
            inp('W_spa', 'Spa width', job.spa.widthFt, 'ft'),
            inp('d_local', 'Pool depth where the spa sits', stations[0]!.depthFt, 'ft'),
          ],
          compute: ({ L_spa, W_spa, d_local }) => L_spa! * W_spa! * d_local!,
          notes: [
            'The spa occupies part of the pool rectangle, so that water is not there. Its own volume is added back on its own line.',
          ],
        })
      : undefined;

  const totalVolumeCf = calc({
    id: 'geom.total.volumeCf',
    label: 'Total water volume',
    formula: spaInsetDeduction
      ? 'V = V_pool - V_inset + V_spa'
      : spaVolumeCf
        ? 'V = V_pool + V_spa'
        : 'V = V_pool',
    unit: 'cf',
    inputs: [
      fromCalc('V_pool', poolNetVolumeCf),
      ...(spaInsetDeduction ? [fromCalc('V_inset', spaInsetDeduction)] : []),
      ...(spaVolumeCf ? [fromCalc('V_spa', spaVolumeCf)] : []),
    ],
    compute: ({ V_pool, V_inset, V_spa }) => V_pool! - (V_inset ?? 0) + (V_spa ?? 0),
  });

  const totalVolumeGal = calc({
    id: 'geom.total.volumeGal',
    label: 'Total water volume',
    formula: 'V_gal = V_cf x 7.48052',
    unit: 'gal',
    inputs: [
      fromCalc('V_cf', totalVolumeCf),
      inp('k', 'US gallons per cubic foot', GAL_PER_CF, 'gal/cf'),
    ],
    compute: ({ V_cf, k }) => V_cf! * k!,
    notes: ['Root input for every hydraulic calculation downstream.'],
  });

  const averageDepth = calc({
    id: 'geom.pool.avgDepth',
    label: 'Pool average depth',
    formula: 'd_avg = V_net / A_plan',
    unit: 'ft',
    inputs: [fromCalc('V_net', poolNetVolumeCf), fromCalc('A_plan', poolPlanArea)],
    compute: ({ V_net, A_plan }) => V_net! / A_plan!,
  });

  // --- wetted surface -------------------------------------------------------

  const slant = floorSlantLength(segments);
  const insetPlanArea =
    job.spa?.insetIntoPool === true ? job.spa.lengthFt * job.spa.widthFt : 0;
  const sideFaceAdj = [...pool.steps, ...pool.seats].reduce(
    (a, item) => a + exposedSideFaceArea(item, pool),
    0,
  );

  const poolWettedArea = calc({
    id: 'geom.pool.wettedArea',
    label: 'Pool wetted surface area',
    formula: 'A_wet = (W x L_slant) + (2 x A_sec) + (W x d_start) + (W x d_end) + A_faces',
    unit: 'sf',
    inputs: [
      inp('W', 'Pool width', pool.widthFt, 'ft'),
      inp('L_slant', 'Floor length measured on the slope', slant, 'ft'),
      fromCalc('A_sec', poolSectionArea),
      inp('d_start', 'Depth at first end wall', stations[0]!.depthFt, 'ft'),
      inp('d_end', 'Depth at second end wall', stations.at(-1)!.depthFt, 'ft'),
      inp('A_faces', 'Exposed side faces of steps and benches', sideFaceAdj, 'sf'),
      inp('A_inset', 'Pool floor taken by an inset spa', insetPlanArea, 'sf'),
    ],
    compute: ({ W, L_slant, A_sec, d_start, d_end, A_faces, A_inset }) =>
      W! * L_slant! + 2 * A_sec! + W! * d_start! + W! * d_end! + A_faces! - A_inset!,
    notes: [
      'Floor uses the slope length, not the plan run.',
      'A step or bench against a wall covers as much surface as its tread and riser faces add, so only the exposed side faces are a net addition.',
    ],
  });

  const spaWettedArea = job.spa ? spaWettedAreaCalc(job.spa) : undefined;

  const totalWettedArea = calc({
    id: 'geom.total.wettedArea',
    label: 'Total wetted surface area (plaster basis)',
    formula: spaWettedArea ? 'A = A_pool + A_spa' : 'A = A_pool',
    unit: 'sf',
    inputs: [
      fromCalc('A_pool', poolWettedArea),
      ...(spaWettedArea ? [fromCalc('A_spa', spaWettedArea)] : []),
    ],
    compute: ({ A_pool, A_spa }) => A_pool! + (A_spa ?? 0),
  });

  const spaPerimeter = job.spa ? 2 * (job.spa.lengthFt + job.spa.widthFt) : 0;
  const waterlinePerimeter = calc({
    id: 'geom.total.waterlinePerimeter',
    label: 'Waterline perimeter (tile basis)',
    formula: job.spa ? 'P_wl = P_pool + P_spa' : 'P_wl = P_pool',
    unit: 'ft',
    inputs: [
      fromCalc('P_pool', poolPerimeter),
      ...(job.spa ? [inp('P_spa', 'Spa perimeter', spaPerimeter, 'ft')] : []),
    ],
    compute: ({ P_pool, P_spa }) => P_pool! + (P_spa ?? 0),
    notes: job.spa?.attachedToPool
      ? ['Spa is attached to the pool; the shared dam wall is counted on both bodies and must be deducted once in the finishes takeoff.']
      : undefined,
  });

  const setback = checkFoundationSetback(job);

  return {
    segments,
    checks: runGeometryCodeChecks(job),
    notes,
    maxAllowableDepthFt: setback.maxAllowableDepthFt,
    poolPlanArea,
    poolPerimeter,
    poolSectionArea,
    poolGrossVolumeCf,
    stepDisplacement,
    seatDisplacement,
    poolNetVolumeCf,
    ...(spaVolumeCf ? { spaVolumeCf } : {}),
    ...(spaInsetDeduction ? { spaInsetDeduction } : {}),
    totalVolumeCf,
    totalVolumeGal,
    averageDepth,
    poolWettedArea,
    ...(spaWettedArea ? { spaWettedArea } : {}),
    totalWettedArea,
    waterlinePerimeter,
  };
}

// --- displacement -----------------------------------------------------------

/**
 * Depth below the waterline of each tread, top tread first.
 * Risers are entered bottom-first, so the top riser is the last entry and the
 * deck-to-first-tread drop starts at the top.
 */
export function treadDepthsBelowWaterline(s: StepSet, freeboardFt: number): number[] {
  const topFirst = [...s.riserHeightsIn].reverse().map(inToFt);
  const depths: number[] = [];
  let cum = 0;
  for (let i = 0; i < s.treadCount; i++) {
    cum += topFirst[i] ?? 0;
    depths.push(cum - freeboardFt);
  }
  return depths;
}

function stepDisplacementCalc(s: StepSet, floorDepthFt: number, notes: GeometryNote[]): Calc {
  // Riser stack should reconcile with the floor depth at the steps. The top
  // riser starts at deck level, which sits a freeboard above the waterline, but
  // freeboard belongs to the excavation params — for displacement the stack is
  // measured from the waterline down, so we reconcile against floor depth only.
  const totalRise = s.riserHeightsIn.reduce((a, r) => a + inToFt(r), 0);
  if (s.riserHeightsIn.length !== s.treadCount + 1) {
    notes.push({
      id: `geom.steps.riserCount.${s.id}`,
      severity: 'warning',
      message: `Step set ${s.id}: ${s.treadCount} treads should have ${s.treadCount + 1} risers (deck down to floor); ${s.riserHeightsIn.length} entered. Displacement volume uses what was entered.`,
    });
  }

  const run = inToFt(s.treadRunIn);
  const width = inToFt(s.treadWidthIn);
  // Depths below the top of the stack, top tread first. Freeboard is handled by
  // reconciling the whole stack against the floor depth below.
  const topFirst = [...s.riserHeightsIn].reverse().map(inToFt);
  const freeboard = Math.max(0, totalRise - floorDepthFt);
  if (freeboard > 1.0) {
    notes.push({
      id: `geom.steps.riserStack.${s.id}`,
      severity: 'warning',
      message: `Step set ${s.id}: risers total ${totalRise.toFixed(2)} ft against a ${floorDepthFt.toFixed(2)} ft water depth, implying ${freeboard.toFixed(2)} ft of freeboard from deck to waterline. Check the riser entries.`,
    });
  }

  let sectionArea = 0;
  let cum = 0;
  for (let i = 0; i < s.treadCount; i++) {
    cum += topFirst[i] ?? 0;
    const depthBelowWl = Math.max(0, cum - freeboard);
    sectionArea += run * Math.max(0, floorDepthFt - depthBelowWl);
  }

  return calc({
    id: `geom.steps.displacement.${s.id}`,
    label: `Step set ${s.id} — water displaced`,
    formula: 'V = SUM[tread i]( run x (d_floor - d_i) ) x w',
    unit: 'cf',
    inputs: [
      inp('n', 'Tread count', s.treadCount, 'ea'),
      inp('run', 'Tread run', run, 'ft'),
      inp('w', 'Stair width', width, 'ft'),
      inp('d_floor', 'Water depth at the steps', floorDepthFt, 'ft'),
      inp('A_sec', 'Step section area (computed)', sectionArea, 'sf'),
    ],
    compute: ({ A_sec, w }) => A_sec! * w!,
    notes: [
      'd_i is the depth of tread i below the waterline, accumulated from the riser stack.',
      'Solid volume of the step structure inside the water envelope — deducted from gross volume.',
    ],
  });
}

function seatDisplacementCalc(s: Seat, floorDepthFt: number, notes: GeometryNote[]): Calc {
  const depth = inToFt(s.surfaceDepthIn);
  const width = inToFt(s.surfaceWidthIn);
  const belowWl = inToFt(s.depthBelowWaterlineIn);
  const height = floorDepthFt - belowWl;
  if (height <= 0) {
    notes.push({
      id: `geom.seats.height.${s.id}`,
      severity: 'warning',
      message: `Seat ${s.id}: surface sits ${belowWl.toFixed(2)} ft below the waterline at a ${floorDepthFt.toFixed(2)} ft water depth, which leaves no height under the seat. Check the floor depth at this location.`,
    });
  }

  const kind =
    s.kind === 'tanningLedge' ? 'Tanning ledge' : s.kind === 'swimout' ? 'Swimout' : 'Bench';

  return calc({
    id: `geom.seats.displacement.${s.id}`,
    label: `${kind} ${s.id} — water displaced`,
    formula: 'V = w x d x (d_floor - d_seat)',
    unit: 'cf',
    inputs: [
      inp('w', 'Unobstructed surface width', width, 'ft'),
      inp('d', 'Unobstructed surface depth', depth, 'ft'),
      inp('d_floor', 'Water depth at this location', floorDepthFt, 'ft'),
      inp('d_seat', 'Surface depth below waterline', belowWl, 'ft'),
    ],
    compute: ({ w, d, d_floor, d_seat }) => w! * d! * Math.max(0, d_floor! - d_seat!),
  });
}

/**
 * Net wetted-area addition from a step set or seat: the tread/riser faces trade
 * one-for-one against the wall and floor they cover, so only the exposed side
 * faces are new surface. Two faces when the item is narrower than the wall it
 * sits against, none when it spans wall to wall.
 */
function exposedSideFaceArea(item: StepSet | Seat, pool: PoolBody): number {
  const isStep = 'treadCount' in item;
  const width = inToFt(isStep ? item.treadWidthIn : item.surfaceWidthIn);
  const spansFullWidth = Math.abs(width - pool.widthFt) < 0.05;
  if (spansFullWidth) return 0;

  if (isStep) {
    const run = inToFt(item.treadRunIn);
    const topFirst = [...item.riserHeightsIn].reverse().map(inToFt);
    const totalRise = topFirst.reduce((a, r) => a + r, 0);
    const freeboard = Math.max(0, totalRise - item.floorDepthFt);
    let sectionArea = 0;
    let cum = 0;
    for (let i = 0; i < item.treadCount; i++) {
      cum += topFirst[i] ?? 0;
      sectionArea += run * Math.max(0, item.floorDepthFt - Math.max(0, cum - freeboard));
    }
    return 2 * sectionArea;
  }

  const depth = inToFt(item.surfaceDepthIn);
  const height = Math.max(0, item.floorDepthFt - inToFt(item.depthBelowWaterlineIn));
  return 2 * depth * height;
}

// --- spa --------------------------------------------------------------------

function spaVolumeCalc(spa: Spa): Calc {
  return calc({
    id: 'geom.spa.volume',
    label: 'Spa water volume',
    formula: 'V_spa = L x W x d',
    unit: 'cf',
    inputs: [
      inp('L', 'Spa length', spa.lengthFt, 'ft'),
      inp('W', 'Spa width', spa.widthFt, 'ft'),
      inp('d', 'Spa depth', spa.depthFt, 'ft'),
    ],
    compute: ({ L, W, d }) => L! * W! * d!,
    notes: ['Spa benches are not deducted in v1; enter them as seats on the pool body if they are significant.'],
  });
}

function spaWettedAreaCalc(spa: Spa): Calc {
  return calc({
    id: 'geom.spa.wettedArea',
    label: 'Spa wetted surface area',
    formula: 'A_spa = (L x W) + 2 x d x (L + W)',
    unit: 'sf',
    inputs: [
      inp('L', 'Spa length', spa.lengthFt, 'ft'),
      inp('W', 'Spa width', spa.widthFt, 'ft'),
      inp('d', 'Spa depth', spa.depthFt, 'ft'),
    ],
    compute: ({ L, W, d }) => L! * W! + 2 * d! * (L! + W!),
  });
}

/** Convenience for the takeoff sheet. */
export function cyFromCf(cf: number): number {
  return cf / CF_PER_CY;
}

export { crossSectionArea };
