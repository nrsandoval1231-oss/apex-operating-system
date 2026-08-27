/**
 * Hydraulics engine — build order step 5.
 *
 * Order of operations, and it is a loop rather than a pass:
 *   design flow -> pipe size -> TDH -> pump curve -> actual flow -> re-check velocity
 *
 * The operating point is where the system curve crosses the pump curve, which is
 * how ANSI/PHTA/ICC-7 s4.4.5.1 defines maximum system flow rate. Velocity is
 * reported per segment against all three thresholds, labeled with the standard
 * each one comes from, so nobody confuses the energy standard with the code.
 *
 * Safety rules that cannot be silently overridden:
 *   - Dual suction outlets only. The engine refuses to emit a single outlet.
 *   - Branch suction piping is sized on the single-blocked condition at 6 fps.
 *   - 8 fps residential is a hard fail. 6 fps raises a visible design flag.
 *   - The required SOFA cover rating is reported for the installer to confirm.
 */

import { calc, fromCalc, inp, type Calc } from './calc.ts';
import {
  fittingEquivalentLengthFt,
  frictionLossPer100Ft,
  HAYWARD_MAX_SYSTEM_FLOW_GPM,
  HAYWARD_MIN_STRAIGHT_PIPE_IN,
  HAYWARD_SOURCE,
  PIPE_SIZES,
  SCH40_ID,
  smallestSizeForVelocity,
  velocityFps,
  type NominalSize,
} from './pipe.ts';
import { headAtFlow, type PumpCurve, type PumpModel } from './pumpCatalog.ts';
import type { HydraulicsParams, Job, PlumbingRun } from './types.ts';

export class HydraulicsInputError extends Error {}

// --- thresholds -------------------------------------------------------------

/** ISPSC 311.3 residential: 8 fps in both suction and return. The code pass/fail. */
export const CODE_MAX_FPS = 8;
/** ANSI/PHTA/ICC-15 residential energy standard, filtration piping only. */
export const ENERGY_SUCTION_FPS = 6;
export const ENERGY_DISCHARGE_FPS = 8;
/** GENESIS design guidance, both sides. */
export const GENESIS_FPS = 5;
/** ANSI/PHTA/ICC-7: branch suction with one of a pair blocked. Governs branch sizing. */
export const BLOCKED_BRANCH_FPS = 6;

/** PHTA-5 2024 turnover bounds and the absolute minimum filtration rate. */
export const MAX_TURNOVER_MINUTES = 360; // 6 h — federal provisions prohibit faster
export const MIN_TURNOVER_MINUTES = 720; // 12 h
export const MIN_FLOW_GPM = 36;

/**
 * 'flag' is the 6 fps design flag the PRD sets. 'guidance' is stricter advice
 * that is neither code nor energy standard — it is reported but does not colour
 * the segment, because auto-sizing to the 6 fps target will sit above 5 fps by
 * construction and a permanent flag on every run would mean nothing.
 */
export type VelocityStatus = 'pass' | 'fail' | 'flag' | 'guidance';

export interface VelocityCheck {
  readonly standard: string;
  readonly limitFps: number;
  readonly actualFps: number;
  readonly status: VelocityStatus;
  readonly note: string;
}

// --- flow -------------------------------------------------------------------

export interface FlowResult {
  readonly maxFlow: Calc;
  readonly minFlow: Calc;
  readonly turnoverFlow: Calc;
  readonly designFlow: Calc;
  readonly achievedTurnover: Calc;
  readonly checks: readonly VelocityCheck[];
  readonly notes: readonly string[];
}

export function computeDesignFlow(volumeGal: number, turnoverHours: number): FlowResult {
  const notes: string[] = [];

  const maxFlow = calc({
    id: 'hyd.flow.max',
    label: 'Maximum filtration flow (6 h turnover)',
    formula: 'Q_max = V / t_min',
    unit: 'gpm',
    inputs: [
      inp('V', 'Total water volume', volumeGal, 'gal'),
      inp('t_min', 'Fastest permitted turnover', MAX_TURNOVER_MINUTES, 'min'),
    ],
    compute: ({ V, t_min }) => V! / t_min!,
    source: 'Federal energy provisions prohibit turnover faster than 6 h for residential',
  });

  const minFlow = calc({
    id: 'hyd.flow.min',
    label: 'Minimum filtration flow (12 h turnover)',
    formula: 'Q_min = V / t_max',
    unit: 'gpm',
    inputs: [
      inp('V', 'Total water volume', volumeGal, 'gal'),
      inp('t_max', 'Slowest permitted turnover', MIN_TURNOVER_MINUTES, 'min'),
    ],
    compute: ({ V, t_max }) => V! / t_max!,
    source: 'PHTA-5 2024',
  });

  const turnoverFlow = calc({
    id: 'hyd.flow.turnover',
    label: `Flow at the ${turnoverHours} h design turnover`,
    formula: 'Q_t = V / (h x 60)',
    unit: 'gpm',
    inputs: [
      inp('V', 'Total water volume', volumeGal, 'gal'),
      inp('h', 'Design turnover', turnoverHours, 'h'),
    ],
    compute: ({ V, h }) => V! / (h! * 60),
  });

  const designFlow = calc({
    id: 'hyd.flow.design',
    label: 'Design flow',
    formula: 'Q = MAX(Q_t, Q_floor)',
    unit: 'gpm',
    inputs: [
      fromCalc('Q_t', turnoverFlow),
      inp('Q_floor', 'Absolute minimum filtration rate', MIN_FLOW_GPM, 'gpm'),
    ],
    compute: ({ Q_t, Q_floor }) => Math.max(Q_t!, Q_floor!),
    notes: ['The 36 gpm floor applies regardless of what the turnover math says.'],
  });

  const achievedTurnover = calc({
    id: 'hyd.flow.achievedTurnover',
    label: 'Turnover achieved at the design flow',
    formula: 'h = V / (Q x 60)',
    unit: 'h',
    inputs: [inp('V', 'Total water volume', volumeGal, 'gal'), fromCalc('Q', designFlow)],
    compute: ({ V, Q }) => V! / (Q! * 60),
  });

  const checks: VelocityCheck[] = [];

  if (designFlow.value > maxFlow.value + 1e-9) {
    checks.push({
      standard: 'Federal energy provisions / PHTA-5 2024',
      limitFps: maxFlow.value,
      actualFps: designFlow.value,
      status: 'flag',
      note:
        `The 36 gpm floor (${designFlow.value.toFixed(1)} gpm) turns this pool over in ` +
        `${achievedTurnover.value.toFixed(2)} h, faster than the 6 h maximum (${maxFlow.value.toFixed(1)} gpm). ` +
        'Two rules conflict on a pool this small: the absolute minimum filtration rate and the ' +
        'maximum turnover rate. The tool reports both and resolves neither — that is a design call.',
    });
  }

  if (turnoverFlow.value < minFlow.value - 1e-9) {
    notes.push(
      `The ${turnoverHours} h design turnover is slower than the 12 h minimum; the design flow is governed by the floor.`,
    );
  }

  return { maxFlow, minFlow, turnoverFlow, designFlow, achievedTurnover, checks, notes };
}

// --- runs -------------------------------------------------------------------

export interface RunResult {
  readonly run: PlumbingRun;
  readonly size: NominalSize;
  readonly idIn: number;
  /** Flow the run carries in normal operation. gpm */
  readonly normalFlowGpm: number;
  /** Flow the run is SIZED on, which for a suction branch is the blocked case. */
  readonly governingFlowGpm: number;
  readonly governingCondition: string;
  readonly velocity: Calc;
  readonly equivalentLength: Calc;
  readonly frictionLoss: Calc;
  readonly checks: readonly VelocityCheck[];
}

function flowFor(run: PlumbingRun, systemGpm: number): number {
  if (run.flowBasis === 'full-system') return systemGpm;
  return systemGpm / run.flowBasis.dividedBy;
}

/**
 * Sizing flow. A suction branch is sized on the single-blocked condition — it
 * has to carry the whole system flow when its pair is covered — which is
 * stricter than anything the velocity tables say and is what actually sizes
 * main drain branch lines.
 */
function governingFlowFor(run: PlumbingRun, systemGpm: number): { gpm: number; condition: string } {
  if (run.role === 'suction-branch') {
    return {
      gpm: systemGpm,
      condition: 'one of the pair blocked — branch carries full system flow',
    };
  }
  if (run.role === 'skimmer') {
    return { gpm: systemGpm, condition: 'valved as the only open suction' };
  }
  return { gpm: flowFor(run, systemGpm), condition: 'normal operation' };
}

function targetVelocityFor(run: PlumbingRun): number {
  if (run.role === 'suction-branch') return BLOCKED_BRANCH_FPS;
  if (run.role === 'suction-trunk' || run.role === 'skimmer') return ENERGY_SUCTION_FPS;
  return ENERGY_SUCTION_FPS; // 6 fps is the design target on both sides
}

function checksFor(
  run: PlumbingRun,
  velocityAtGoverning: number,
  velocityNormal: number,
  size: NominalSize,
  governingGpm: number,
): VelocityCheck[] {
  const suction =
    run.role === 'suction-branch' || run.role === 'suction-trunk' || run.role === 'skimmer';
  const out: VelocityCheck[] = [];

  out.push({
    standard: 'ISPSC 311.3 residential (as adopted by Lubbock)',
    limitFps: CODE_MAX_FPS,
    actualFps: velocityAtGoverning,
    status: velocityAtGoverning > CODE_MAX_FPS ? 'fail' : 'pass',
    note:
      velocityAtGoverning > CODE_MAX_FPS
        ? 'Hard fail. 8 fps is the code limit in both suction and return.'
        : 'Within the 8 fps code limit.',
  });

  if (suction) {
    out.push({
      standard: 'ANSI/PHTA/ICC-15 residential energy (filtration piping only)',
      limitFps: ENERGY_SUCTION_FPS,
      actualFps: velocityAtGoverning,
      status: velocityAtGoverning > ENERGY_SUCTION_FPS ? 'flag' : 'pass',
      note: 'Design flag, not a code failure. Applies to filtration piping only.',
    });
  } else {
    out.push({
      standard: 'ANSI/PHTA/ICC-15 residential energy, discharge',
      limitFps: ENERGY_DISCHARGE_FPS,
      actualFps: velocityAtGoverning,
      status: velocityAtGoverning > ENERGY_DISCHARGE_FPS ? 'flag' : 'pass',
      note: 'Design flag, not a code failure.',
    });
  }

  if (run.role === 'suction-branch') {
    out.push({
      standard: 'ANSI/PHTA/ICC-7 branch suction, one of a pair blocked',
      limitFps: BLOCKED_BRANCH_FPS,
      actualFps: velocityAtGoverning,
      status: velocityAtGoverning > BLOCKED_BRANCH_FPS ? 'fail' : 'pass',
      note:
        `Governs this branch. With both outlets open the branch runs at about ` +
        `${velocityNormal.toFixed(2)} fps; the blocked case is what sizes it.`,
    });
  }

  // Pump manufacturer's own chart. Not code, not the energy standard — it sits
  // between them at roughly 7 fps, and a system the pump maker says is over its
  // recommended flow is worth knowing about even when the code is satisfied.
  const mfgLimit = HAYWARD_MAX_SYSTEM_FLOW_GPM[size];
  out.push({
    standard: `Hayward maximum recommended system flow, ${size} in (${HAYWARD_SOURCE})`,
    limitFps: mfgLimit,
    actualFps: governingGpm,
    status: governingGpm > mfgLimit ? 'flag' : 'pass',
    note:
      governingGpm > mfgLimit
        ? `${governingGpm.toFixed(1)} gpm through ${size} in exceeds Hayward's ${mfgLimit} gpm recommendation for that size. Pump manufacturer guidance, not a code limit.`
        : `${governingGpm.toFixed(1)} gpm is within Hayward's ${mfgLimit} gpm recommendation for ${size} in.`,
  });

  out.push({
    standard: 'GENESIS design guidance',
    limitFps: GENESIS_FPS,
    actualFps: velocityAtGoverning,
    status: velocityAtGoverning > GENESIS_FPS ? 'guidance' : 'pass',
    note:
      velocityAtGoverning > GENESIS_FPS
        ? 'Over the 5 fps GENESIS recommendation. Neither code nor energy standard — advisory only. Sizing to 5 fps instead of 6 would move this run up a pipe size.'
        : 'Within the 5 fps GENESIS recommendation.',
  });

  return out;
}

export type SizeMap = ReadonlyMap<string, NominalSize>;

/**
 * Choose a size for every run at a given flow. Sizes are chosen once, at the
 * flow the system is designed for, and then held fixed — the system curve has to
 * describe the pipe that is actually in the ground, not a different pipe at
 * every flow.
 */
export function sizeRuns(params: HydraulicsParams, gpm: number): SizeMap {
  const sizes = new Map<string, NominalSize>();
  for (const run of params.runs) {
    const governing = governingFlowFor(run, gpm);
    sizes.set(
      run.id,
      run.size ??
        smallestSizeForVelocity(governing.gpm, targetVelocityFor(run)) ??
        PIPE_SIZES[PIPE_SIZES.length - 1]!,
    );
  }
  return sizes;
}

function evaluateRun(run: PlumbingRun, systemGpm: number, sizes?: SizeMap): RunResult {
  const governing = governingFlowFor(run, systemGpm);
  const normalFlowGpm = flowFor(run, systemGpm);

  const target = targetVelocityFor(run);
  const size =
    sizes?.get(run.id) ??
    run.size ??
    smallestSizeForVelocity(governing.gpm, target) ??
    PIPE_SIZES[PIPE_SIZES.length - 1]!;
  const idIn = SCH40_ID[size];

  const velocity = calc({
    id: `hyd.run.${run.id}.velocity`,
    label: `${run.label} — velocity (${governing.condition})`,
    formula: 'v = 0.4085 x Q / d^2',
    unit: 'fps',
    inputs: [
      inp('Q', 'Flow in this run', governing.gpm, 'gpm'),
      inp('d', `Sch 40 ID, ${size} in nominal`, idIn, 'in'),
    ],
    compute: ({ Q, d }) => (0.4085 * Q!) / (d! * d!),
  });

  const eqLen = fittingEquivalentLengthFt(run.fittings, idIn);
  const equivalentLength = calc({
    id: `hyd.run.${run.id}.eqLength`,
    label: `${run.label} — equivalent length`,
    formula: 'L_eq = L_pipe + SUM( (L/D) x d / 12 )',
    unit: 'ft',
    inputs: [
      inp('L_pipe', 'Measured pipe length', run.lengthFt, 'ft'),
      inp('d', 'Pipe ID', idIn, 'in'),
      ...run.fittings.map((f) => inp(f.kind.replace(/-/g, '_'), `${f.kind} x ${f.count}`, f.count, 'ea')),
    ],
    compute: () => run.lengthFt + eqLen,
    notes: [`Fittings add ${eqLen.toFixed(2)} ft by the equivalent-length-in-diameters method.`],
  });

  const per100 = frictionLossPer100Ft(normalFlowGpm, idIn);
  const frictionLoss = calc({
    id: `hyd.run.${run.id}.friction`,
    label: `${run.label} — friction loss at normal flow`,
    formula: 'h = 0.2083 x (100/C)^1.852 x Q^1.852 / d^4.8655 x L_eq / 100',
    unit: 'ft',
    inputs: [
      inp('Q', 'Flow in normal operation', normalFlowGpm, 'gpm'),
      inp('d', 'Pipe ID', idIn, 'in'),
      inp('C', 'Hazen-Williams coefficient, PVC', 150, '-'),
      fromCalc('L_eq', equivalentLength),
    ],
    compute: ({ L_eq }) => (per100 * L_eq!) / 100,
  });

  return {
    run,
    size,
    idIn,
    normalFlowGpm,
    governingFlowGpm: governing.gpm,
    governingCondition: governing.condition,
    velocity,
    equivalentLength,
    frictionLoss,
    checks: checksFor(run, velocity.value, velocityFps(normalFlowGpm, idIn), size, governing.gpm),
  };
}

// --- system curve and operating point --------------------------------------

function systemHeadAt(gpm: number, params: HydraulicsParams, sizes: SizeMap): number {
  const runs = params.runs.map((r) => evaluateRun(r, gpm, sizes));

  const lossOf = (rs: RunResult[]) =>
    rs.reduce(
      (a, r) => a + (frictionLossPer100Ft(r.normalFlowGpm, r.idIn) * r.equivalentLength.value) / 100,
      0,
    );
  const maxLossOf = (rs: RunResult[]) =>
    rs.length === 0
      ? 0
      : Math.max(
          ...rs.map(
            (r) => (frictionLossPer100Ft(r.normalFlowGpm, r.idIn) * r.equivalentLength.value) / 100,
          ),
        );

  const byRole = (role: string) => runs.filter((r) => r.run.role === role);

  const suction =
    Math.max(maxLossOf(byRole('suction-branch')), maxLossOf(byRole('skimmer'))) +
    lossOf(byRole('suction-trunk'));
  const ret = maxLossOf(byRole('return-branch')) + lossOf(byRole('return-trunk'));

  const equipment = params.equipmentLosses.reduce(
    (a, e) => a + e.headFt * Math.pow(gpm / e.atGpm, 2),
    0,
  );

  return suction + ret + equipment + params.staticLiftFt;
}

export interface SpeedOption {
  readonly rpm: number;
  readonly curve: PumpCurve;
  readonly operatingPoint: OperatingPoint | null;
  readonly meetsDesignFlow: boolean;
}

export interface OperatingPoint {
  readonly gpm: number;
  readonly headFt: number;
  readonly curve: PumpCurve;
}

/** Where the system curve crosses the pump curve. Bisection on head difference. */
export function findOperatingPoint(
  params: HydraulicsParams,
  curve: PumpCurve,
  sizes: SizeMap = sizeRuns(params, curve.points[Math.floor(curve.points.length / 2)]!.gpm),
): OperatingPoint | null {
  const lo = curve.points[0]!.gpm;
  const hi = curve.points[curve.points.length - 1]!.gpm;
  const f = (q: number) => {
    const pump = headAtFlow(curve, q);
    return pump === null ? null : pump - systemHeadAt(q, params, sizes);
  };

  let a = Math.max(lo, 1);
  let b = hi;
  const fa = f(a);
  const fb = f(b);
  if (fa === null || fb === null) return null;
  // No crossing inside the published range.
  if (fa < 0 || fb > 0) return null;

  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === null) return null;
    if (fm > 0) a = m;
    else b = m;
  }
  const gpm = (a + b) / 2;
  return { gpm, headFt: systemHeadAt(gpm, params, sizes), curve };
}

// --- result -----------------------------------------------------------------

export interface HydraulicsResult {
  readonly flow: FlowResult;
  /** Flow the system actually runs at: the operating point, or the design flow. */
  readonly systemFlowGpm: number;
  readonly systemFlowBasis: string;
  readonly runs: readonly RunResult[];
  readonly tdh: Calc;
  readonly tdhBreakdown: readonly Calc[];
  readonly systemCurve: readonly { gpm: number; headFt: number }[];
  readonly operatingPoint: OperatingPoint | null;
  readonly operatingPointNote: string;
  readonly iterations: number;
  readonly convergenceLog: readonly string[];
  readonly sofaRequirement: Calc;
  readonly outletChecks: readonly VelocityCheck[];
  /** Turnover bounds re-checked at the flow the pump actually delivers. */
  readonly operatingChecks: readonly VelocityCheck[];
  /** Named pump, when the job specifies one. */
  readonly pumpModel: PumpModel | null;
  /** For a variable-speed pump: what each published speed delivers. */
  readonly speedOptions: readonly SpeedOption[];
  /** The speed chosen to run at, and why. */
  readonly selectedSpeed: SpeedOption | null;
  readonly speedSelectionNote: string;
  /**
   * Speed to actually set, when no published speed lands inside the turnover
   * band. A variable-speed pump runs at any speed; the published curves are
   * only samples. Interpolated, and labeled as such.
   */
  readonly recommendedRpm: number | null;
  /** Manufacturer installation requirements that are not velocity checks. */
  readonly installationRequirements: readonly string[];
  readonly hydrostaticValves: Calc;
  readonly notes: readonly string[];
}

export function computeHydraulics(job: Job, volumeGal: number): HydraulicsResult | null {
  const params = job.hydraulics;
  if (!params) return null;

  // Safety rule, enforced before anything is computed: the tool never emits a
  // single-suction-outlet configuration.
  if (params.mainDrains.count < 2) {
    throw new HydraulicsInputError(
      `Suction outlets: ${params.mainDrains.count} entered. ANSI/PHTA/ICC-7 requires dual outlets. ` +
        'The tool does not produce a single-suction-outlet configuration.',
    );
  }

  const flow = computeDesignFlow(volumeGal, params.turnoverHours);
  const convergenceLog: string[] = [];

  // A variable-speed pump publishes a curve per speed. The question is not
  // "does it fit" but "how slowly can it run and still make design flow" —
  // running slower is the whole point of a VS pump.
  //
  // Speed selection and the reported system curve MUST use the same pipe sizes.
  // Sizing at design flow and then reporting a curve sized at the converged flow
  // is how the two disagree about which speed is needed: bigger pipe is less
  // restrictive, so it flatters a lower speed.
  let speedOptions: SpeedOption[] = [];
  let chosenCurve: PumpCurve | null = params.pumpCurve ?? null;
  let selectedSpeed: SpeedOption | null = null;
  let speedSelectionNote = '';

  const pickSpeed = (sizes: SizeMap) => {
    const options: SpeedOption[] = [];
    for (const curve of params.pumpModel!.curves!) {
      const rpm = Number.parseInt(curve.speed, 10);
      const op = findOperatingPoint(params, curve, sizes);
      options.push({
        rpm,
        curve,
        operatingPoint: op,
        meetsDesignFlow: op !== null && op.gpm >= flow.designFlow.value,
      });
    }
    options.sort((a, b) => a.rpm - b.rpm);
    return options;
  };

  interface Pick {
    options: SpeedOption[];
    selected: SpeedOption | null;
    curve: PumpCurve | null;
    note: string;
  }

  const decide = (options: SpeedOption[]): Pick => {
    const selected = options.find((o) => o.meetsDesignFlow) ?? null;
    if (selected) {
      return {
        options,
        selected,
        curve: selected.curve,
        note:
          `Lowest published speed that makes the ${flow.designFlow.value.toFixed(1)} gpm design flow ` +
          `against this plumbing: ${selected.rpm} rpm, delivering ` +
          `${selected.operatingPoint!.gpm.toFixed(1)} gpm at ${selected.operatingPoint!.headFt.toFixed(1)} ft. ` +
          'Running a variable-speed pump at the lowest speed that meets turnover is the point of specifying one.',
      };
    }
    const best = [...options].reverse().find((o) => o.operatingPoint);
    return {
      options,
      selected: null,
      curve: best?.curve ?? null,
      note: best
        ? `No published speed makes the ${flow.designFlow.value.toFixed(1)} gpm design flow against this plumbing. ` +
          `The highest, ${best.rpm} rpm, delivers ${best.operatingPoint!.gpm.toFixed(1)} gpm. ` +
          'Either the plumbing is too restrictive or the pump is too small for this pool.'
        : 'No published speed produces an operating point against this plumbing.',
    };
  };

  const hasSpeeds = !params.pumpCurve && !!params.pumpModel?.curves?.length;
  if (hasSpeeds) {
    const p1 = decide(pickSpeed(sizeRuns(params, flow.designFlow.value)));
    speedOptions = p1.options;
    selectedSpeed = p1.selected;
    chosenCurve = p1.curve;
    speedSelectionNote = p1.note;
  }

  // Flow -> size -> TDH -> pump curve -> actual flow -> re-check. Loop until the
  // flow the sizing was done at matches the flow the pump actually delivers.
  let current = flow.designFlow.value;
  let iterations = 0;
  let operatingPoint: OperatingPoint | null = null;

  if (chosenCurve) {
    for (let i = 0; i < 12; i++) {
      iterations = i + 1;
      const sizes = sizeRuns(params, current);
      const op = findOperatingPoint(params, chosenCurve, sizes);
      if (!op) {
        convergenceLog.push(
          `Iteration ${iterations}: the system curve does not cross the published pump curve inside its flow range.`,
        );
        break;
      }
      const delta = Math.abs(op.gpm - current);
      convergenceLog.push(
        `Iteration ${iterations}: sized at ${current.toFixed(1)} gpm, pump delivers ${op.gpm.toFixed(1)} gpm against ${op.headFt.toFixed(1)} ft TDH (delta ${delta.toFixed(2)} gpm).`,
      );
      operatingPoint = op;
      current = op.gpm;
      if (delta < 0.25) {
        convergenceLog.push(`Converged after ${iterations} iterations.`);
        break;
      }
    }
  } else {
    convergenceLog.push(
      'No pump curve available, so no operating point was converged. Flow, velocity and TDH below stand on the design flow.',
    );
  }

  // Second pass: now that the flow is known, the pipe is sized for it. Re-pick
  // the speed against THAT pipe, and if the answer changed, converge again on it.
  if (hasSpeeds && operatingPoint) {
    const settledSizes = sizeRuns(params, operatingPoint.gpm);
    const previous = selectedSpeed;
    const p2 = decide(pickSpeed(settledSizes));
    speedOptions = p2.options;
    selectedSpeed = p2.selected;
    chosenCurve = p2.curve;
    speedSelectionNote = p2.note;
    const now = p2.selected;
    if (now && previous && now.rpm !== previous.rpm) {
      convergenceLog.push(
        `Re-checked speed against the pipe sized for ${operatingPoint.gpm.toFixed(1)} gpm: ` +
          `${previous.rpm} rpm becomes ${now.rpm} rpm. Larger pipe is less restrictive, so a lower speed carries it.`,
      );
      // Continue from the flow already settled on, not from the design flow:
      // restarting would re-size down to the smaller pipe and walk straight back
      // to the speed we just moved away from.
      current = operatingPoint.gpm;
      for (let i = 0; i < 12; i++) {
        const sizes = sizeRuns(params, current);
        const op = findOperatingPoint(params, chosenCurve!, sizes);
        if (!op) break;
        const delta = Math.abs(op.gpm - current);
        operatingPoint = op;
        current = op.gpm;
        iterations += 1;
        convergenceLog.push(
          `Iteration ${iterations}: sized at ${current.toFixed(1)} gpm on the ${now.rpm} rpm curve, delivering ${op.gpm.toFixed(1)} gpm at ${op.headFt.toFixed(1)} ft.`,
        );
        if (delta < 0.25) break;
      }
    }
  }

  const systemFlowGpm = operatingPoint ? operatingPoint.gpm : flow.designFlow.value;
  const systemFlowBasis = operatingPoint
    ? `converged operating point, system curve x ${operatingPoint.curve.manufacturer} ${operatingPoint.curve.model}`
    : 'design flow (no pump curve entered)';

  // Final velocity re-check happens here, at the flow the system actually runs.
  const finalSizes = sizeRuns(params, systemFlowGpm);
  const runs = params.runs.map((r) => evaluateRun(r, systemFlowGpm, finalSizes));

  const suctionRuns = runs.filter((r) =>
    ['suction-branch', 'suction-trunk', 'skimmer'].includes(r.run.role),
  );
  const returnRuns = runs.filter((r) => ['return-trunk', 'return-branch'].includes(r.run.role));

  const suctionLoss = Math.max(
    ...[0, ...runs.filter((r) => r.run.role === 'suction-branch').map((r) => r.frictionLoss.value)],
    ...[0, ...runs.filter((r) => r.run.role === 'skimmer').map((r) => r.frictionLoss.value)],
  ) + runs.filter((r) => r.run.role === 'suction-trunk').reduce((a, r) => a + r.frictionLoss.value, 0);

  const returnLoss =
    Math.max(...[0, ...runs.filter((r) => r.run.role === 'return-branch').map((r) => r.frictionLoss.value)]) +
    runs.filter((r) => r.run.role === 'return-trunk').reduce((a, r) => a + r.frictionLoss.value, 0);

  const suctionHead = calc({
    id: 'hyd.tdh.suction',
    label: 'Suction side friction, governing path',
    formula: 'h_s = MAX(branch, skimmer) + SUM(trunk)',
    unit: 'ft',
    inputs: suctionRuns.map((r) => inp(r.run.id, r.run.label, r.frictionLoss.value, 'ft')),
    compute: () => suctionLoss,
    notes: ['Parallel branches do not add. The worst branch plus the trunk it feeds is the path that governs.'],
  });

  const returnHead = calc({
    id: 'hyd.tdh.return',
    label: 'Return side friction, governing path',
    formula: 'h_r = MAX(branch) + SUM(trunk)',
    unit: 'ft',
    inputs: returnRuns.map((r) => inp(r.run.id, r.run.label, r.frictionLoss.value, 'ft')),
    compute: () => returnLoss,
  });

  const equipmentTotal = params.equipmentLosses.reduce(
    (a, e) => a + e.headFt * Math.pow(systemFlowGpm / e.atGpm, 2),
    0,
  );
  const equipmentHead = calc({
    id: 'hyd.tdh.equipment',
    label: 'Equipment head loss',
    formula: 'h_e = SUM( h_i x (Q / Q_i)^2 )',
    unit: 'ft',
    inputs: [
      ...params.equipmentLosses.map((e) =>
        inp(e.label.replace(/\s+/g, '_'), `${e.label} (${e.headFt} ft at ${e.atGpm} gpm) — ${e.source}`, e.headFt, 'ft'),
      ),
      inp('Q', 'System flow', systemFlowGpm, 'gpm'),
    ],
    compute: () => equipmentTotal,
    notes: ['Manufacturer losses are read at a stated flow and scaled as the square of flow.'],
  });

  const staticHead = calc({
    id: 'hyd.tdh.static',
    label: 'Static lift',
    formula: 'h_z = z',
    unit: 'ft',
    inputs: [inp('z', 'Water level to the highest point in the system', params.staticLiftFt, 'ft')],
    compute: ({ z }) => z!,
  });

  const tdh = calc({
    id: 'hyd.tdh',
    label: 'Total dynamic head',
    formula: 'TDH = h_s + h_r + h_e + h_z',
    unit: 'ft',
    inputs: [
      fromCalc('h_s', suctionHead),
      fromCalc('h_r', returnHead),
      fromCalc('h_e', equipmentHead),
      fromCalc('h_z', staticHead),
    ],
    compute: ({ h_s, h_r, h_e, h_z }) => h_s! + h_r! + h_e! + h_z!,
    source: 'Equivalent-length method',
  });

  const systemCurve: { gpm: number; headFt: number }[] = [];
  for (let q = 10; q <= 120; q += 5) {
    systemCurve.push({ gpm: q, headFt: systemHeadAt(q, params, finalSizes) });
  }

  const sofaRequirement = calc({
    id: 'hyd.sofa',
    label: 'Required certified flow rating per suction outlet cover',
    formula: 'R >= Q_max,system',
    unit: 'gpm',
    inputs: [inp('Q_max,system', 'Maximum system flow', systemFlowGpm, 'gpm')],
    compute: ({ 'Q_max,system': q }) => q!,
    source: 'ANSI/PHTA/ICC-7 and ANSI/APSP-16',
    notes: [
      'Each installed cover has to be certified for at least this flow, because either outlet can see the whole system flow when its pair is blocked.',
      'This is a lookup against the cover the installer actually fits. The tool reports the requirement and does not select a cover.',
    ],
  });

  const outletChecks: VelocityCheck[] = [
    {
      standard: 'ANSI/PHTA/ICC-7 dual outlets',
      limitFps: 2,
      actualFps: params.mainDrains.count,
      status: params.mainDrains.count >= 2 ? 'pass' : 'fail',
      note: `${params.mainDrains.count} suction outlets. Dual outlets are mandatory; the tool never emits a single-outlet configuration.`,
    },
    {
      standard: 'ANSI/PHTA/ICC-7 outlet separation',
      limitFps: 3,
      actualFps: params.mainDrains.separationFt,
      status:
        params.mainDrains.separationFt >= 3 || params.mainDrains.onDifferentSurfaces ? 'pass' : 'fail',
      note: params.mainDrains.onDifferentSurfaces
        ? 'Outlets are on two different surfaces, which satisfies the rule independently of separation.'
        : `Minimum 3 ft separation, or two different surfaces. Entered separation ${params.mainDrains.separationFt} ft.`,
    },
  ];

  if (params.mainDrains.intendedCoverRatingGpm !== undefined) {
    outletChecks.push({
      standard: 'ANSI/APSP-16 cover rating vs maximum system flow',
      limitFps: sofaRequirement.value,
      actualFps: params.mainDrains.intendedCoverRatingGpm,
      status: params.mainDrains.intendedCoverRatingGpm >= sofaRequirement.value ? 'pass' : 'fail',
      note: 'Confirm against the cover actually installed, not the one specified.',
    });
  }

  // The design flow is what the system was sized for; the operating point is
  // what the pump actually delivers. They are not the same number, and the
  // turnover bounds apply to the one that is real.
  const operatingChecks: VelocityCheck[] = [];
  if (operatingPoint) {
    const operatingTurnoverH = volumeGal / (systemFlowGpm * 60);
    if (systemFlowGpm > flow.maxFlow.value + 1e-9) {
      operatingChecks.push({
        standard: 'Federal energy provisions / 6 h maximum turnover',
        limitFps: flow.maxFlow.value,
        actualFps: systemFlowGpm,
        status: 'fail',
        note:
          `The pump delivers ${systemFlowGpm.toFixed(1)} gpm against this system, turning the water over in ` +
          `${operatingTurnoverH.toFixed(2)} h — faster than the 6 h maximum (${flow.maxFlow.value.toFixed(1)} gpm). ` +
          'The system was sized for ' +
          `${flow.designFlow.value.toFixed(1)} gpm. This pump is oversized for this plumbing, or it needs to run at a lower speed. ` +
          'Sizing to the design flow does not make the installed flow compliant.',
      });
    } else if (systemFlowGpm < flow.minFlow.value - 1e-9) {
      operatingChecks.push({
        standard: 'PHTA-5 2024 / 12 h minimum turnover',
        limitFps: flow.minFlow.value,
        actualFps: systemFlowGpm,
        status: 'fail',
        note:
          `The pump delivers only ${systemFlowGpm.toFixed(1)} gpm, turning the water over in ` +
          `${operatingTurnoverH.toFixed(2)} h — slower than the 12 h minimum.`,
      });
    } else {
      operatingChecks.push({
        standard: 'Turnover at the operating point',
        limitFps: flow.maxFlow.value,
        actualFps: systemFlowGpm,
        status: 'pass',
        note: `${systemFlowGpm.toFixed(1)} gpm turns the water over in ${operatingTurnoverH.toFixed(2)} h, inside the 6 h to 12 h band.`,
      });
    }
  }

  // A VS pump runs at any speed, so landing between two published curves is a
  // setting, not a problem — but the tool has to say which setting.
  const speedNotes: string[] = [];
  let recommendedRpm: number | null = null;
  if (selectedSpeed?.operatingPoint && selectedSpeed.operatingPoint.gpm > flow.maxFlow.value) {
    const below = [...speedOptions]
      .filter((o) => o.operatingPoint && o.rpm < selectedSpeed!.rpm)
      .sort((a, b) => b.rpm - a.rpm)[0];
    if (below?.operatingPoint) {
      const qLo = below.operatingPoint.gpm;
      const qHi = selectedSpeed.operatingPoint.gpm;
      const target = Math.min(flow.maxFlow.value, Math.max(flow.designFlow.value, qLo));
      const t = qHi === qLo ? 0 : (target - qLo) / (qHi - qLo);
      recommendedRpm = Math.round(below.rpm + (selectedSpeed.rpm - below.rpm) * t);
      speedNotes.push(
        `At ${selectedSpeed.rpm} rpm this pump delivers ${qHi.toFixed(1)} gpm, over the ${flow.maxFlow.value.toFixed(1)} gpm that a 6 h turnover allows. ` +
          `At ${below.rpm} rpm it delivers ${qLo.toFixed(1)} gpm. A variable-speed pump runs at any speed, so set it near ` +
          `${recommendedRpm} rpm to land inside the turnover band. That figure is interpolated between two published curves, ` +
          'not read off one — set it, then verify the actual flow with a meter.',
      );
    }
  }

  const hydrostaticValves = calc({
    id: 'hyd.hydrostatic',
    label: 'Hydrostatic relief valves',
    formula: 'N = as scheduled',
    unit: 'ea',
    inputs: [inp('N', 'Valves in the shell floor', params.hydrostaticReliefValves, 'ea')],
    compute: ({ N }) => N!,
    notes: [
      'Relieves uplift when the shell is drained against a high water table. West Texas failure mode is collapsible, hydro-compactive soil wetted by irrigation or a leak rather than perched groundwater, but the valve is cheap and the shell is not.',
    ],
  });

  // Minimum straight pipe before the pump suction inlet, from the same Hayward
  // chart. Reported rather than checked: the tool has no pad layout geometry yet.
  const suctionSizes = new Set(
    runs.filter((r) => r.run.role === 'suction-trunk' || r.run.role === 'skimmer').map((r) => r.size),
  );
  const installationRequirements = [...suctionSizes].map(
    (sz) =>
      `${sz} in suction into the pump needs at least ${HAYWARD_MIN_STRAIGHT_PIPE_IN[sz]} in of straight pipe (5 pipe diameters) between the inlet and any elbow, tee or valve. ${HAYWARD_SOURCE}.`,
  );

  const pumpModel = params.pumpModel ?? null;
  if (speedSelectionNote) convergenceLog.unshift(speedSelectionNote);

  const notes: string[] = [...flow.notes, ...speedNotes];
  if (pumpModel && !chosenCurve) {
    notes.push(
      `Pump specified as ${pumpModel.manufacturer} ${pumpModel.series} ${pumpModel.id} (${pumpModel.totalHp} THP), from ${pumpModel.source}. No head/flow performance curve is attached to it, so it cannot produce an operating point — a performance chart or data sheet is what is needed.`,
    );
  }
  if (!chosenCurve) {
    notes.push(
      'No pump curve entered. Equipment selection (step 6) needs the converged operating point, so it cannot run until a curve is read off the manufacturer chart and entered with its revision date.',
    );
  }
  const autoSized = runs.filter((r) => !r.run.size);
  if (autoSized.length > 0 && autoSized.every((r) => r.size === '1.5')) {
    notes.push(
      'Every auto-sized run landed on 1.5 in, because at this flow that is the smallest size meeting the 6 fps target. The tool applies the velocity rule and nothing else — it carries no shop minimum pipe size. If you plumb 2 in as a standard regardless of velocity, set the size on the run rather than letting it size itself.',
    );
  }
  notes.push(
    'Spa jet runs are reported but are not in the pool TDH: spa mode is a separate operating condition and is not converged in v1.',
  );

  return {
    flow,
    systemFlowGpm,
    systemFlowBasis,
    runs,
    tdh,
    tdhBreakdown: [suctionHead, returnHead, equipmentHead, staticHead],
    systemCurve,
    operatingPoint,
    operatingPointNote: operatingPoint
      ? `Operating point is where the system curve crosses the pump curve, which is how ANSI/PHTA/ICC-7 s4.4.5.1 defines maximum system flow rate. Curve source: ${operatingPoint.curve.source}, rev ${operatingPoint.curve.revisionDate}.`
      : 'No operating point. Velocities and TDH below are at the design flow, not at a converged flow.',
    iterations,
    convergenceLog,
    sofaRequirement,
    outletChecks,
    operatingChecks,
    pumpModel,
    speedOptions,
    selectedSpeed,
    speedSelectionNote,
    recommendedRpm,
    installationRequirements,
    hydrostaticValves,
    notes,
  };
}
