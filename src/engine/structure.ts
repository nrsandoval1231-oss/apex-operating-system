/**
 * Structure takeoff — build order step 4.
 *
 * This module designs nothing. It reads a stored standard detail and converts it
 * to quantities: gunite volume with rebound shown separately, bar schedule by
 * length with stock-length cut optimization, tie count, and pier concrete.
 *
 * Safety rule from the PRD, enforced by the return type: structural quantities
 * are produced only from a stored detail with a declared envelope. No detail, or
 * a job outside its envelope, means no numbers. The absence of a stamp
 * requirement does not license the tool to extrapolate.
 */

import { calc, fromCalc, inp, withWaste, type Calc, type NetAndWaste } from './calc.ts';
import { crossSectionArea, floorSlantLength, type ProfileSegment } from './profile.ts';
import {
  BAR_PROPERTIES,
  selectDetail,
  type DetailSelection,
  type EnvelopeMatch,
  type StandardDetail,
} from './standardDetail.ts';
import type { Job } from './types.ts';
import { CF_PER_CY, inToFt } from './units.ts';

// --- bar schedule -----------------------------------------------------------

export interface BarRequirement {
  readonly family: string;
  readonly count: number;
  /** Length of one bar, lap allowance included. ft */
  readonly lengthFt: number;
}

export interface CutPlan {
  readonly stockLengthFt: number;
  readonly stockBars: number;
  readonly requiredLf: number;
  readonly stockLf: number;
  readonly dropLf: number;
  readonly dropPct: number;
  /** Bars longer than a stock length, which have to be spliced. */
  readonly splices: number;
}

/**
 * First-fit-decreasing bin packing. Bars longer than a stock length consume
 * whole bars and carry a splice each; the remainder goes back in the pack.
 */
export function optimizeCuts(
  requirements: readonly BarRequirement[],
  stockLengthFt: number,
): CutPlan {
  const pieces: number[] = [];
  let wholeBars = 0;
  let splices = 0;
  let requiredLf = 0;

  for (const r of requirements) {
    for (let i = 0; i < r.count; i++) {
      requiredLf += r.lengthFt;
      let remaining = r.lengthFt;
      while (remaining > stockLengthFt + 1e-9) {
        wholeBars += 1;
        splices += 1;
        remaining -= stockLengthFt;
      }
      if (remaining > 1e-9) pieces.push(remaining);
    }
  }

  pieces.sort((a, b) => b - a);
  const bins: number[] = [];
  for (const p of pieces) {
    const idx = bins.findIndex((free) => free >= p - 1e-9);
    if (idx === -1) bins.push(stockLengthFt - p);
    else bins[idx] = bins[idx]! - p;
  }

  const stockBars = wholeBars + bins.length;
  const stockLf = stockBars * stockLengthFt;
  const dropLf = stockLf - requiredLf;

  return {
    stockLengthFt,
    stockBars,
    requiredLf,
    stockLf,
    dropLf,
    dropPct: stockLf > 0 ? dropLf / stockLf : 0,
    splices,
  };
}

/**
 * Build the bar schedule from the developed shell panels.
 *
 * The shell is taken off as flat panels — floor, two side walls, two end walls —
 * with real bar lengths per panel rather than a lump length-per-area figure, so
 * the cut plan has something to optimize against.
 */
export function buildBarSchedule(
  job: Job,
  segments: readonly ProfileSegment[],
  detail: StandardDetail,
): BarRequirement[] {
  const W = job.pool.widthFt;
  const p = job.pool.profile;
  const s = inToFt(detail.barSpacingIn);
  const lap = detail.barLapAllowanceFt;
  const slant = floorSlantLength(segments);
  const dMax = p.deepDepth;

  const n = (extent: number) => Math.floor(extent / s) + 1;
  const out: BarRequirement[] = [];

  // Floor, both directions.
  out.push({ family: 'Floor — transverse', count: n(slant), lengthFt: W + lap });
  out.push({ family: 'Floor — longitudinal', count: n(W), lengthFt: slant + lap });

  // Side walls. Verticals take the depth at their station; horizontals run only
  // as far as the wall is deep enough to carry them.
  const verticalLengths: number[] = [];
  for (let x = 0; x <= slant + 1e-9; x += s) {
    verticalLengths.push(depthAt(segments, Math.min(x, slant)) + lap);
  }
  // Grouped by actual length, not averaged — a wall that steps from 5 ft to
  // 7.5 ft packs into stock lengths differently than the same footage at one
  // average height.
  out.push(...groupByLength('Side walls — vertical (2 walls)', verticalLengths, 2));

  const horizontalLengths: number[] = [];
  for (let h = 0; h <= dMax + 1e-9; h += s) {
    const run = runDeeperThan(segments, h);
    if (run > 0) horizontalLengths.push(run + lap);
  }
  out.push(...groupByLength('Side walls — horizontal (2 walls)', horizontalLengths, 2));

  // End walls.
  for (const [name, d] of [
    ['Shallow end wall', p.shallowDepth],
    ['Deep end wall', p.deepDepth],
  ] as const) {
    out.push({ family: `${name} — horizontal`, count: n(d), lengthFt: W + lap });
    out.push({ family: `${name} — vertical`, count: n(W), lengthFt: d + lap });
  }

  // Supplemental bars at the cove and the breakover, at the tighter spacing.
  const zone = detail.stressPointZoneFt;
  const extraPerRun = Math.max(
    0,
    Math.ceil(zone / inToFt(detail.stressPointSpacingIn)) - Math.ceil(zone / s),
  );
  if (extraPerRun > 0) {
    out.push({ family: 'Cove supplemental — side walls', count: 2 * extraPerRun, lengthFt: slant + lap });
    out.push({ family: 'Cove supplemental — end walls', count: 2 * extraPerRun, lengthFt: W + lap });
    out.push({ family: 'Breakover supplemental', count: 2 * extraPerRun, lengthFt: W + lap });
  }

  return out;
}

/** Collapse a list of individual bar lengths into counted families, to the nearest inch. */
function groupByLength(family: string, lengths: readonly number[], multiplier: number): BarRequirement[] {
  const buckets = new Map<number, number>();
  for (const l of lengths) {
    const key = Math.round(l * 12) / 12;
    buckets.set(key, (buckets.get(key) ?? 0) + multiplier);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([lengthFt, count]) => ({ family, count, lengthFt }));
}

function depthAt(segments: readonly ProfileSegment[], x: number): number {
  let travelled = 0;
  for (const seg of segments) {
    if (x <= travelled + seg.length + 1e-9) {
      const t = seg.length === 0 ? 0 : (x - travelled) / seg.length;
      return seg.d1 + (seg.d2 - seg.d1) * Math.min(Math.max(t, 0), 1);
    }
    travelled += seg.length;
  }
  return segments[segments.length - 1]?.d2 ?? 0;
}

/** Run over which the profile is at least `h` deep. ft */
function runDeeperThan(segments: readonly ProfileSegment[], h: number): number {
  let run = 0;
  for (const seg of segments) {
    if (Math.abs(seg.d2 - seg.d1) < 1e-12) {
      if (seg.d1 >= h) run += seg.length;
      continue;
    }
    const t = (h - seg.d1) / (seg.d2 - seg.d1);
    const clamped = Math.min(Math.max(t, 0), 1);
    run += seg.d2 > seg.d1 ? seg.length * (1 - clamped) : seg.length * clamped;
  }
  return run;
}

// --- result -----------------------------------------------------------------

export interface StructureQuantities {
  readonly detail: StandardDetail;
  readonly envelope: EnvelopeMatch;
  readonly developedArea: Calc;
  readonly shellVolume: Calc;
  readonly coveVolume: Calc;
  readonly bondBeamVolume: Calc;
  readonly damWallVolume?: Calc;
  readonly gunite: NetAndWaste;
  readonly guniteCy: Calc;
  readonly barSchedule: readonly BarRequirement[];
  readonly barLinearFeet: Calc;
  readonly barWeight: Calc;
  readonly bondBeamBarLf: Calc;
  readonly cutPlan: CutPlan;
  readonly stockBars: Calc;
  readonly tieCount: Calc;
  readonly pierVolume?: Calc;
  readonly notes: readonly string[];
}

export type StructureResult =
  | { readonly outcome: 'no-detail'; readonly message: string }
  | {
      readonly outcome: 'out-of-envelope';
      readonly message: string;
      readonly attempts: readonly EnvelopeMatch[];
    }
  | { readonly outcome: 'quantities'; readonly quantities: StructureQuantities };

const NO_DETAIL_MESSAGE =
  'No standard detail is stored, so no structural quantities are produced. ' +
  'Enter the shell thickness, bar size and spacing, bond beam section, dam wall, ' +
  'cove and stress-point spacing you build to, plus the depth and plan-size range ' +
  'the detail is good for. That last part is the envelope, and without it there is ' +
  'nothing to check a job against.';

const OUT_OF_ENVELOPE_MESSAGE =
  'This job falls outside every stored standard detail. No structural quantities are ' +
  'produced. This is not a code requirement — no stamp is required for residential in ' +
  'Lubbock — it is that the job is outside what your detail covers. Bring in an ' +
  'engineer, extend the detail, or bring the job back inside the envelope. The tool ' +
  'states the condition and stops; it does not extrapolate.';

export function computeStructure(
  job: Job,
  segments: readonly ProfileSegment[],
  details: readonly StandardDetail[],
): StructureResult {
  const selection: DetailSelection = selectDetail(details, job);

  if (selection.outcome === 'no-detail') {
    return { outcome: 'no-detail', message: NO_DETAIL_MESSAGE };
  }
  if (selection.outcome === 'out-of-envelope') {
    return {
      outcome: 'out-of-envelope',
      message: OUT_OF_ENVELOPE_MESSAGE,
      attempts: selection.attempts,
    };
  }

  const { detail } = selection.match;
  const notes: string[] = [];
  const W = job.pool.widthFt;
  const p = job.pool.profile;
  const t = inToFt(detail.shellThicknessIn);
  const slant = floorSlantLength(segments);
  const sectionArea = crossSectionArea(segments);
  const perimeter = 2 * (job.pool.lengthFt + W);

  const developedArea = calc({
    id: 'str.developedArea',
    label: 'Developed shell area (floor, side walls, end walls)',
    formula: 'A_dev = (W x L_slant) + (2 x A_sec) + (W x d_sh) + (W x d_dp)',
    unit: 'sf',
    inputs: [
      inp('W', 'Pool width', W, 'ft'),
      inp('L_slant', 'Floor length on the slope', slant, 'ft'),
      inp('A_sec', 'Side wall section area', sectionArea, 'sf'),
      inp('d_sh', 'Shallow depth', p.shallowDepth, 'ft'),
      inp('d_dp', 'Deep depth', p.deepDepth, 'ft'),
    ],
    compute: ({ W, L_slant, A_sec, d_sh, d_dp }) =>
      W! * L_slant! + 2 * A_sec! + W! * d_sh! + W! * d_dp!,
    notes: ['Step and bench faces are not shot as separate shell area; they are formed within it.'],
  });

  const shellVolume = calc({
    id: 'str.shellVolume',
    label: 'Shell gunite, net',
    formula: 'V_shell = A_dev x t',
    unit: 'cf',
    inputs: [fromCalc('A_dev', developedArea), inp('t', 'Shell thickness', t, 'ft')],
    compute: ({ A_dev, t }) => A_dev! * t!,
    source: `Standard detail ${detail.id}, rev ${detail.versionDate}`,
  });

  const coveLeg = inToFt(detail.coveLegIn);
  const coveVolume = calc({
    id: 'str.coveVolume',
    label: 'Cove fillet at the floor-to-wall junction',
    formula: 'V_cove = 0.5 x leg^2 x P_cove',
    unit: 'cf',
    inputs: [
      inp('leg', 'Cove leg', coveLeg, 'ft'),
      inp('P_cove', 'Cove run (pool perimeter)', perimeter, 'ft'),
    ],
    compute: ({ leg, P_cove }) => 0.5 * leg! * leg! * P_cove!,
  });

  const bbW = inToFt(detail.bondBeamWidthIn);
  const bbD = inToFt(detail.bondBeamDepthIn);
  const bondBeamVolume = calc({
    id: 'str.bondBeam',
    label: 'Bond beam, volume beyond the wall section',
    formula: 'V_bb = (w_bb - t) x d_bb x P',
    unit: 'cf',
    inputs: [
      inp('w_bb', 'Bond beam width', bbW, 'ft'),
      inp('t', 'Shell thickness', t, 'ft'),
      inp('d_bb', 'Bond beam depth', bbD, 'ft'),
      inp('P', 'Pool perimeter', perimeter, 'ft'),
    ],
    compute: ({ w_bb, t, d_bb, P }) => Math.max(0, w_bb! - t!) * d_bb! * P!,
    notes: ['Only the volume beyond the wall section is added — the wall thickness is already in the shell line.'],
  });

  let damWallVolume: Calc | undefined;
  if (job.spa?.attachedToPool) {
    const damT = inToFt(detail.damWallThicknessIn);
    damWallVolume = calc({
      id: 'str.damWall',
      label: 'Spa dam wall',
      formula: 'V_dam = t_dam x h_dam x L_dam',
      unit: 'cf',
      inputs: [
        inp('t_dam', 'Dam wall thickness', damT, 'ft'),
        inp('h_dam', 'Dam wall height above pool water', job.spa.damWallHeightFt, 'ft'),
        inp('L_dam', 'Dam wall length (spa width)', job.spa.widthFt, 'ft'),
      ],
      compute: ({ t_dam, h_dam, L_dam }) => t_dam! * h_dam! * L_dam!,
      source: `Dam wall thickness from standard detail ${detail.id}`,
    });
    if (Math.abs(detail.damWallThicknessIn - job.spa.damWallThicknessIn) > 0.01) {
      notes.push(
        `Dam wall thickness differs between the job (${job.spa.damWallThicknessIn} in) and the standard detail (${detail.damWallThicknessIn} in). The detail governs; the job entry is ignored for quantities.`,
      );
    }
  }

  const guniteNet = calc({
    id: 'str.gunite.net',
    label: `Gunite, net in place (${detail.gunitePsi} psi)`,
    formula: damWallVolume
      ? 'V_net = V_shell + V_cove + V_bb + V_dam'
      : 'V_net = V_shell + V_cove + V_bb',
    unit: 'cf',
    inputs: [
      fromCalc('V_shell', shellVolume),
      fromCalc('V_cove', coveVolume),
      fromCalc('V_bb', bondBeamVolume),
      ...(damWallVolume ? [fromCalc('V_dam', damWallVolume)] : []),
    ],
    compute: ({ V_shell, V_cove, V_bb, V_dam }) => V_shell! + V_cove! + V_bb! + (V_dam ?? 0),
  });

  const gunite = withWaste(guniteNet, detail.reboundAllowance, 'str.gunite');
  const guniteCy = calc({
    id: 'str.gunite.cy',
    label: 'Gunite order quantity',
    formula: 'CY = V_ord / 27',
    unit: 'cy',
    inputs: [
      fromCalc('V_ord', gunite.ordered),
      inp('k', 'Cubic feet per cubic yard', CF_PER_CY, 'cf/cy'),
    ],
    compute: ({ V_ord, k }) => V_ord! / k!,
    notes: ['Rebound and overspray are the waste line above, never folded into the net volume.'],
  });

  // --- steel ---------------------------------------------------------------

  const barSchedule = buildBarSchedule(job, segments, detail);
  const barProps = BAR_PROPERTIES[detail.barSize];

  const barLinearFeet = calc({
    id: 'str.bar.lf',
    label: `Shell reinforcement ${detail.barSize} at ${detail.barSpacingIn} in o.c. each way`,
    formula: 'LF = SUM(count x length per family)',
    unit: 'lf',
    inputs: barSchedule.map((r, i) =>
      inp(`f${i + 1}`, `${r.family} — ${r.count} @ ${r.lengthFt.toFixed(2)} ft`, r.count * r.lengthFt, 'lf'),
    ),
    compute: (v) => Object.values(v).reduce((a, b) => a + b, 0),
    source: `Standard detail ${detail.id}, rev ${detail.versionDate}`,
    notes: [`Includes ${detail.barLapAllowanceFt} ft lap and hook allowance on every bar.`],
  });

  const bondBeamBarLf = calc({
    id: 'str.bondBeam.bar',
    label: `Bond beam continuous ${detail.bondBeamBarSize}`,
    formula: 'LF = n x P',
    unit: 'lf',
    inputs: [
      inp('n', 'Continuous bars in the bond beam', detail.bondBeamBarCount, 'ea'),
      inp('P', 'Pool perimeter', perimeter, 'ft'),
    ],
    compute: ({ n, P }) => n! * P!,
  });

  // Shell and bond beam are weighed on their own unit weights. They are often
  // different bars — a #4 beam over a #3 shell weighs nearly twice per foot, and
  // averaging the two would understate the order.
  const bbProps = BAR_PROPERTIES[detail.bondBeamBarSize];
  const barWeight = calc({
    id: 'str.bar.weight',
    label: 'Reinforcement weight',
    formula: 'w = (LF_shell x w_shell) + (LF_bb x w_bb)',
    unit: 'lb',
    inputs: [
      fromCalc('LF_shell', barLinearFeet),
      inp('w_shell', `${detail.barSize} unit weight`, barProps.lbPerFt, 'lb/ft'),
      fromCalc('LF_bb', bondBeamBarLf),
      inp('w_bb', `${detail.bondBeamBarSize} unit weight`, bbProps.lbPerFt, 'lb/ft'),
    ],
    compute: ({ LF_shell, w_shell, LF_bb, w_bb }) => LF_shell! * w_shell! + LF_bb! * w_bb!,
    notes:
      detail.bondBeamBarSize === detail.barSize
        ? undefined
        : [
            `Shell is ${detail.barSize} and the bond beam is ${detail.bondBeamBarSize}, so each is weighed on its own unit weight.`,
          ],
  });

  const cutPlan = optimizeCuts(
    [
      ...barSchedule,
      { family: 'Bond beam continuous', count: detail.bondBeamBarCount, lengthFt: perimeter },
    ],
    detail.stockBarLengthFt,
  );

  const stockBars = calc({
    id: 'str.bar.stock',
    label: `Stock bars to order (${detail.stockBarLengthFt} ft lengths)`,
    formula: 'N = first-fit-decreasing pack of the bar schedule into stock lengths',
    unit: 'ea',
    inputs: [
      inp('LF_req', 'Required bar length', cutPlan.requiredLf, 'lf'),
      inp('L_stock', 'Stock length', detail.stockBarLengthFt, 'ft'),
      inp('LF_drop', 'Drop', cutPlan.dropLf, 'lf'),
    ],
    compute: () => cutPlan.stockBars,
    notes: [
      `Drop ${cutPlan.dropLf.toFixed(1)} lf, ${(cutPlan.dropPct * 100).toFixed(1)}% of stock ordered.`,
      cutPlan.splices > 0
        ? `${cutPlan.splices} bars run longer than a ${detail.stockBarLengthFt} ft stock length and carry a splice.`
        : 'No bar exceeds a stock length; no splices.',
    ],
  });

  // Ties: one at each intersection of the two bar directions, per panel.
  const s = inToFt(detail.barSpacingIn);
  const intersections =
    (Math.floor(slant / s) + 1) * (Math.floor(W / s) + 1) + // floor
    2 * (Math.floor(slant / s) + 1) * (Math.floor(p.deepDepth / s) + 1) + // side walls
    (Math.floor(W / s) + 1) * (Math.floor(p.shallowDepth / s) + 1) +
    (Math.floor(W / s) + 1) * (Math.floor(p.deepDepth / s) + 1);

  const tieCount = calc({
    id: 'str.ties',
    label: 'Bar ties',
    formula: 'N_ties = N_intersections x f_tie',
    unit: 'ea',
    inputs: [
      inp('N_intersections', 'Bar intersections across all panels', intersections, 'ea'),
      inp('f_tie', 'Fraction of intersections tied', detail.tieFraction, 'fraction'),
    ],
    compute: ({ N_intersections, f_tie }) => Math.ceil(N_intersections! * f_tie!),
    notes: ['Side wall intersections use the deep-end wall height, so this is an upper bound on the sloped portion.'],
  });

  let pierVolume: Calc | undefined;
  if (detail.piers.length > 0) {
    const total = detail.piers.reduce(
      (a, pier) => a + (Math.PI / 4) * inToFt(pier.diameterIn) ** 2 * pier.depthFt * pier.count,
      0,
    );
    pierVolume = calc({
      id: 'str.piers',
      label: 'Pier concrete',
      formula: 'V = SUM( pi/4 x D^2 x h x n )',
      unit: 'cf',
      inputs: detail.piers.map((pier) =>
        inp(
          pier.label.replace(/\s+/g, '_'),
          `${pier.label}: ${pier.count} @ ${pier.diameterIn} in x ${pier.depthFt} ft`,
          (Math.PI / 4) * inToFt(pier.diameterIn) ** 2 * pier.depthFt * pier.count,
          'cf',
        ),
      ),
      compute: () => total,
      source: `Pier schedule from standard detail ${detail.id}`,
      notes: ['Pier design, soil bearing and uplift are the engineer’s scope. This is a concrete count only.'],
    });
  } else {
    notes.push('The standard detail carries no pier schedule, so no pier concrete is reported.');
  }

  if (!detail.envelopeConfirmed) {
    notes.push(
      `ENVELOPE NOT CONFIRMED. The depth range and plan limits on ${detail.id} were assumed, not stated. The quantities below are real, but the boundary that decides whether this detail covers a job has not been agreed — so the out-of-envelope refusal is only as good as a range nobody has checked. Confirming it is the single most valuable correction to this detail.`,
    );
  }
  if (detail.suppliedFields?.length) {
    notes.push(`Supplied by the builder: ${detail.suppliedFields.join('; ')}.`);
  }
  if (detail.assumedFields?.length) {
    notes.push(
      `Filled in on instruction and open to redline: ${detail.assumedFields.join('; ')}.`,
    );
  }
  if (detail.shellThicknessIn <= 6) {
    notes.push(
      `A ${detail.shellThicknessIn} in shell with centred steel sits right at the 3 in minimum cover between steel and earth. It is a common build, but there is no margin in it — worth a look if the subsurface on a lot is worse than the detail assumes.`,
    );
  }
  notes.push(
    'Nothing in this section is designed by the tool. Every dimension traces to the standard detail named on each line.',
  );

  return {
    outcome: 'quantities',
    quantities: {
      detail,
      envelope: selection.match,
      developedArea,
      shellVolume,
      coveVolume,
      bondBeamVolume,
      ...(damWallVolume ? { damWallVolume } : {}),
      gunite,
      guniteCy,
      barSchedule,
      barLinearFeet,
      barWeight,
      bondBeamBarLf,
      cutPlan,
      stockBars,
      tieCount,
      ...(pierVolume ? { pierVolume } : {}),
      notes,
    },
  };
}
