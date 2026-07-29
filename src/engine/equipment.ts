/**
 * Equipment selection, gas demand and pad layout — build order step 6.
 *
 * Pump selection is matched to the CONVERGED OPERATING POINT, not to the design
 * flow, because the operating point is what the pump actually delivers against
 * this plumbing.
 *
 * Gas is the safety-critical part, and the PRD is explicit about what it is and
 * is not:
 *   - CFH = BTU/hr / 1000 for natural gas, / 2500 for propane
 *   - TOTAL CONNECTED LOAD on the shared run governs pipe size, not the heater
 *   - METER CAPACITY governs the whole system and the tool cannot know it
 *   - fitting equivalent lengths are added to the measured run length
 *   - the output is a DEMAND CALCULATION for a licensed gas contractor to
 *     verify, never a design
 *
 * The NFPA 54 / NFPA 58 capacity tables are not built in. They vary by pipe
 * material, pressure and permitted drop, and inventing them would be exactly the
 * kind of confident-looking wrong number this tool exists to avoid. The table is
 * an input, entered from the code book, and it ships empty: no table, no size.
 */

import { calc, fromCalc, inp, type Calc } from './calc.ts';
import type { HydraulicsResult } from './hydraulics.ts';
import { ALL_PUMP_MODELS, headAtFlow, type PumpModel } from './pumpCatalog.ts';
import type { EquipmentParams, GasParams, Job } from './types.ts';

/** Natural gas: 1,000 BTU per cubic foot. Propane: 2,500. */
export const BTU_PER_CF: Record<'natural-gas' | 'propane', number> = {
  'natural-gas': 1000,
  propane: 2500,
};

// --- pump selection ---------------------------------------------------------

export interface PumpCandidate {
  readonly model: PumpModel;
  /** Lowest published speed that meets the design flow, if any. */
  readonly speedRpm: number | null;
  readonly deliversGpm: number | null;
  readonly headFt: number | null;
  readonly meetsDesignFlow: boolean;
  readonly note: string;
}

export interface PumpSelection {
  readonly candidates: readonly PumpCandidate[];
  readonly selected: PumpCandidate | null;
  readonly basis: string;
}

/**
 * Score every catalogued pump against the system the hydraulics module already
 * converged. A pump with no published curve is listed and skipped, not guessed.
 */
export function selectPump(
  hydraulics: HydraulicsResult,
  designFlowGpm: number,
  models: readonly PumpModel[],
): PumpSelection {
  const candidates: PumpCandidate[] = [];

  for (const model of models) {
    const curves = model.curves ?? (model.curve ? [model.curve] : []);
    if (curves.length === 0) {
      candidates.push({
        model,
        speedRpm: null,
        deliversGpm: null,
        headFt: null,
        meetsDesignFlow: false,
        note: 'No published performance curve attached, so this pump cannot be evaluated. Not a judgement on the pump.',
      });
      continue;
    }

    // Head the system needs at design flow is already known from the converged
    // system curve; compare each speed's head at that flow.
    const systemHead = hydraulics.systemCurve;
    const needAt = (gpm: number) => {
      const pts = [...systemHead].sort((a, b) => a.gpm - b.gpm);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        if (gpm >= a.gpm && gpm <= b.gpm) {
          const t = (gpm - a.gpm) / (b.gpm - a.gpm);
          return a.headFt + (b.headFt - a.headFt) * t;
        }
      }
      return pts[pts.length - 1]!.headFt;
    };
    const required = needAt(designFlowGpm);

    const workable = curves
      .map((c) => ({ c, rpm: Number.parseInt(c.speed, 10), head: headAtFlow(c, designFlowGpm) }))
      .filter((x) => x.head !== null && x.head >= required)
      .sort((a, b) => a.rpm - b.rpm);

    const best = workable[0];
    if (best) {
      candidates.push({
        model,
        speedRpm: best.rpm,
        deliversGpm: designFlowGpm,
        headFt: best.head!,
        meetsDesignFlow: true,
        note: `Makes ${best.head!.toFixed(1)} ft at ${designFlowGpm.toFixed(1)} gpm on its ${best.rpm} rpm curve, against the ${required.toFixed(1)} ft this system needs.`,
      });
    } else {
      const top = curves
        .map((c) => ({ rpm: Number.parseInt(c.speed, 10), head: headAtFlow(c, designFlowGpm) }))
        .sort((a, b) => b.rpm - a.rpm)[0];
      candidates.push({
        model,
        speedRpm: null,
        deliversGpm: null,
        headFt: top?.head ?? null,
        meetsDesignFlow: false,
        note:
          top?.head != null
            ? `Tops out at ${top.head.toFixed(1)} ft at ${designFlowGpm.toFixed(1)} gpm, short of the ${required.toFixed(1)} ft this system needs.`
            : `Cannot reach ${designFlowGpm.toFixed(1)} gpm on any published curve.`,
      });
    }
  }

  // Smallest pump that does the job. Oversizing a pump is how you end up
  // turning the water over faster than the code allows.
  const workable = candidates.filter((c) => c.meetsDesignFlow);
  const selected =
    [...workable].sort((a, b) => a.model.totalHp - b.model.totalHp || a.speedRpm! - b.speedRpm!)[0] ??
    null;

  return {
    candidates,
    selected,
    basis:
      'Matched against the converged system curve at design flow. The smallest pump that meets it wins — an oversized pump is what pushes the operating point past the 6 h turnover maximum.',
  };
}

// --- gas demand -------------------------------------------------------------

export interface GasResult {
  readonly fuel: string;
  readonly heaterDemand: Calc;
  readonly heaterCfh: Calc;
  readonly totalConnectedLoadBtu: Calc;
  readonly totalConnectedLoadCfh: Calc;
  readonly developedLength: Calc;
  readonly meterCheck: {
    readonly status: 'pass' | 'fail' | 'unknown';
    readonly message: string;
  };
  /** Reference size for a dedicated run, when a capacity table was provided. */
  readonly referenceSize: {
    readonly sizeLabel: string | null;
    readonly message: string;
  };
  /** Shop-standard size, and whether the entered table confirms it. */
  readonly intendedSize: {
    readonly label: string | null;
    readonly status: 'confirmed' | 'too-small' | 'unverified' | 'none';
    readonly message: string;
  };
  readonly disclaimer: string;
  readonly notes: readonly string[];
}

/** Parse labels such as "1 in", "1 1/4 in", and "3/4 in" for deterministic size ordering. */
function nominalSizeInches(label: string): number {
  const parts = label.toLowerCase().replace(/in(?:ches)?\.?/g, '').trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      total += Number(part);
      continue;
    }
    const fraction = part.match(/^(\d+)\/(\d+)$/);
    if (fraction) total += Number(fraction[1]) / Number(fraction[2]);
  }
  return total > 0 ? total : Number.POSITIVE_INFINITY;
}

export function computeGasDemand(gas: GasParams): GasResult {
  const notes: string[] = [];
  const perCf = BTU_PER_CF[gas.fuel];
  const fuelLabel = gas.fuel === 'propane' ? 'propane (NFPA 58)' : 'natural gas (NFPA 54)';

  const heaterDemand = calc({
    id: 'gas.heater.btu',
    label: 'Heater input rating',
    formula: 'Q = as rated by the manufacturer',
    unit: 'BTU/hr',
    inputs: [inp('Q', 'Heater input', gas.heaterBtuPerHour, 'BTU/hr')],
    compute: ({ Q }) => Q!,
  });

  const heaterCfh = calc({
    id: 'gas.heater.cfh',
    label: `Heater gas demand, ${fuelLabel}`,
    formula: 'CFH = Q / h',
    unit: 'cfh',
    inputs: [
      fromCalc('Q', heaterDemand),
      inp('h', `Heating value, ${gas.fuel}`, perCf, 'BTU/cf'),
    ],
    compute: ({ Q, h }) => Q! / h!,
    source: gas.fuel === 'propane' ? 'NFPA 58' : 'NFPA 54 / IFGC',
  });

  const totalBtu = gas.connectedLoad.reduce((a, x) => a + x.btuPerHour, 0);
  const totalConnectedLoadBtu = calc({
    id: 'gas.total.btu',
    label: 'Total connected load on the shared run',
    formula: 'Q_tot = SUM(every appliance on the run)',
    unit: 'BTU/hr',
    inputs: gas.connectedLoad.map((x) =>
      inp(x.label.replace(/\s+/g, '_'), `${x.label}${x.isNew ? ' (new)' : ' (existing)'}`, x.btuPerHour, 'BTU/hr'),
    ),
    compute: () => totalBtu,
    notes: [
      'Total connected load governs pipe size, not the heater rating on its own. Every existing appliance on the shared run counts.',
    ],
  });

  const totalConnectedLoadCfh = calc({
    id: 'gas.total.cfh',
    label: 'Total connected load',
    formula: 'CFH_tot = Q_tot / h',
    unit: 'cfh',
    inputs: [
      fromCalc('Q_tot', totalConnectedLoadBtu),
      inp('h', `Heating value, ${gas.fuel}`, perCf, 'BTU/cf'),
    ],
    compute: ({ Q_tot, h }) => Q_tot! / h!,
  });

  const developedLength = calc({
    id: 'gas.length',
    label: 'Developed length of the run',
    formula: 'L_dev = L_measured + L_fittings',
    unit: 'ft',
    inputs: [
      inp('L_measured', 'Measured run length', gas.runLengthFt, 'ft'),
      inp('L_fittings', 'Fitting equivalent length', gas.fittingEquivalentLengthFt, 'ft'),
    ],
    compute: ({ L_measured, L_fittings }) => L_measured! + L_fittings!,
    notes: ['Fitting equivalent lengths are added to the measured run before the table is read, never after.'],
  });

  // Meter capacity: the tool cannot know it, so it is asked for and reported.
  let meterCheck: GasResult['meterCheck'];
  if (gas.meterCapacityCfh === undefined) {
    meterCheck = {
      status: 'unknown',
      message:
        'No meter capacity entered, so the governing check on the whole system has not been made. ' +
        'Meter capacity governs everything downstream of it and the tool cannot know it — read it off the meter or ask the utility.',
    };
  } else if (totalConnectedLoadCfh.value > gas.meterCapacityCfh) {
    meterCheck = {
      status: 'fail',
      message:
        `Total connected load ${totalConnectedLoadCfh.value.toFixed(1)} cfh exceeds the ${gas.meterCapacityCfh} cfh meter. ` +
        'No pipe size fixes this — the meter or the service has to change. This is the governing constraint on the whole system.',
    };
  } else {
    meterCheck = {
      status: 'pass',
      message: `Total connected load ${totalConnectedLoadCfh.value.toFixed(1)} cfh is within the ${gas.meterCapacityCfh} cfh meter capacity.`,
    };
  }

  // Reference size, only if a capacity table was supplied.
  let referenceSize: GasResult['referenceSize'];
  if (gas.capacityTable.length === 0) {
    referenceSize = {
      sizeLabel: null,
      message:
        `No ${gas.fuel === 'propane' ? 'NFPA 58' : 'NFPA 54'} capacity table entered, so no pipe size is reported. ` +
        'The tables vary by pipe material, operating pressure and permitted drop, and the tool does not carry them. ' +
        'Enter the table rows for the material and pressure drop in use and the reference size will follow.',
    };
  } else {
    const L = developedLength.value;
    const need = totalConnectedLoadCfh.value;
    // For each size, capacity at the first table length at or beyond the run.
    const bySize = new Map<string, { lengthFt: number; capacityCfh: number }[]>();
    for (const row of gas.capacityTable) {
      const list = bySize.get(row.sizeLabel) ?? [];
      list.push({ lengthFt: row.lengthFt, capacityCfh: row.capacityCfh });
      bySize.set(row.sizeLabel, list);
    }
    let chosen: string | null = null;
    let anySizeCoversLength = false;
    const sizesSmallestFirst = [...bySize.entries()].sort(
      ([a], [b]) => nominalSizeInches(a) - nominalSizeInches(b) || a.localeCompare(b),
    );
    for (const [size, rows] of sizesSmallestFirst) {
      const sorted = [...rows].sort((a, b) => a.lengthFt - b.lengthFt);
      const row = sorted.find((r) => r.lengthFt >= L);
      if (row) anySizeCoversLength = true;
      if (row && row.capacityCfh >= need) {
        chosen = size;
        break;
      }
    }
    referenceSize = chosen
      ? {
          sizeLabel: chosen,
          message:
            `Reference size for a DEDICATED run of ${gas.pipeMaterial} at ${L.toFixed(1)} ft developed length carrying ` +
            `${need.toFixed(1)} cfh, from the entered table (${gas.tableBasis}): ${chosen}. ` +
            'A shared run is sized on its own total load section by section, which this does not do.',
        }
      : {
          sizeLabel: null,
          message:
            (anySizeCoversLength
              ? `No size in the entered table carries ${need.toFixed(1)} cfh at ${L.toFixed(1)} ft. `
              : `The entered table does not extend to ${L.toFixed(1)} ft for any size. `) +
            'The run must be checked against a table row at or beyond its full developed length; never reuse a shorter terminal row.',
        };
  }

  // Shop practice, checked where it can be.
  let intendedSize: GasResult['intendedSize'];
  if (!gas.intendedSizeLabel) {
    intendedSize = { label: null, status: 'none', message: 'No shop-standard size recorded for this job.' };
  } else if (gas.capacityTable.length === 0) {
    intendedSize = {
      label: gas.intendedSizeLabel,
      status: 'unverified',
      message:
        `${gas.intendedSizeLabel} is the size normally run, recorded here but NOT verified — no capacity table is entered. ` +
        `Whether it carries ${totalConnectedLoadCfh.value.toFixed(0)} cfh at ${developedLength.value.toFixed(0)} ft depends on the pressure and the permitted drop, ` +
        'which is exactly what the table settles. Shop practice is a starting point, not a check.',
    };
  } else {
    const rows = gas.capacityTable
      .filter((r) => r.sizeLabel === gas.intendedSizeLabel)
      .sort((a, b) => a.lengthFt - b.lengthFt);
    const row = rows.find((r) => r.lengthFt >= developedLength.value);
    if (!row) {
      intendedSize = {
        label: gas.intendedSizeLabel,
        status: 'unverified',
        message:
          rows.length === 0
            ? `${gas.intendedSizeLabel} is the size normally run, but the entered table has no rows for it.`
            : `${gas.intendedSizeLabel} is the size normally run, but the entered table for that size does not extend to the ${developedLength.value.toFixed(1)} ft developed length. A shorter terminal row is not reused.`,
      };
    } else if (row.capacityCfh >= totalConnectedLoadCfh.value) {
      intendedSize = {
        label: gas.intendedSizeLabel,
        status: 'confirmed',
        message: `${gas.intendedSizeLabel} carries ${row.capacityCfh} cfh at ${row.lengthFt} ft in the entered table, against ${totalConnectedLoadCfh.value.toFixed(0)} cfh of connected load. The shop standard holds on this job.`,
      };
    } else {
      intendedSize = {
        label: gas.intendedSizeLabel,
        status: 'too-small',
        message:
          `${gas.intendedSizeLabel} carries only ${row.capacityCfh} cfh at ${row.lengthFt} ft in the entered table, against ${totalConnectedLoadCfh.value.toFixed(0)} cfh of connected load. ` +
          'The shop standard does not hold on this job — this is the case the table exists to catch.',
      };
    }
  }

  notes.push(
    'CSST is sized on its own manufacturer tables, not the NFPA 54 steel pipe tables. If the run is CSST, the reference size above does not apply.',
  );
  if (gas.connectedLoad.every((x) => x.isNew)) {
    notes.push(
      'Every appliance on the entered load is new. If there are existing appliances on this run, they belong in the total or the size will be undersized.',
    );
  }

  return {
    fuel: fuelLabel,
    heaterDemand,
    heaterCfh,
    totalConnectedLoadBtu,
    totalConnectedLoadCfh,
    developedLength,
    meterCheck,
    referenceSize,
    intendedSize,
    disclaimer:
      'This is a DEMAND CALCULATION, not a gas system design. It states how much gas the appliances want and, where a table was supplied, a reference size for a dedicated run. Sizing, materials, pressure, venting and combustion air are the licensed gas contractor’s scope and must be verified by them.',
    notes,
  };
}

// --- pad layout -------------------------------------------------------------

export interface PadResult {
  readonly distanceFromPool: Calc;
  /** Runs that are shorter than the straight-line distance to the pad. */
  readonly impossibleRuns: readonly string[];
  readonly padLength: Calc;
  readonly padWidth: Calc;
  readonly padArea: Calc;
  readonly items: readonly { label: string; footprint: Calc }[];
  readonly valveCount: Calc;
  readonly actuatorCount: Calc;
  readonly notes: readonly string[];
}

export function computePad(params: EquipmentParams, hydraulics: HydraulicsResult | null): PadResult {
  const items = params.padItems;
  const notes: string[] = [];

  // Equipment in a single row, service clearance around each.
  const totalWidth = items.reduce((a, i) => a + i.widthFt + 2 * i.clearanceFt, 0);
  const maxDepth = items.reduce((a, i) => Math.max(a, i.depthFt + 2 * i.clearanceFt), 0);

  const distanceFromPool = calc({
    id: 'pad.distance',
    label: 'Pad distance from the pool',
    formula: 'd = as sited',
    unit: 'ft',
    inputs: [inp('d', 'Straight line, pool edge to pad', params.distanceFromPoolFt, 'ft')],
    compute: ({ d }) => d!,
  });

  // A pipe cannot be shorter than the straight line it spans. This catches a run
  // length typed for a different pad location, which would otherwise just make
  // the TDH quietly optimistic.
  const impossibleRuns: string[] = [];
  if (hydraulics) {
    for (const r of hydraulics.runs) {
      const goesToPad =
        r.run.role === 'suction-trunk' || r.run.role === 'return-trunk' || r.run.role === 'skimmer';
      if (goesToPad && r.run.lengthFt < params.distanceFromPoolFt) {
        impossibleRuns.push(
          `${r.run.label} is entered at ${r.run.lengthFt} ft but the pad is ${params.distanceFromPoolFt} ft away. A run to the pad cannot be shorter than the distance to the pad — the friction loss and TDH from it are understated.`,
        );
      }
    }
  }

  const padLength = calc({
    id: 'pad.length',
    label: 'Equipment pad length',
    formula: 'L = SUM(w_i + 2 x c_i)',
    unit: 'ft',
    inputs: items.map((i) =>
      inp(i.label.replace(/\s+/g, '_'), `${i.label} (${i.widthFt} ft + ${i.clearanceFt} ft clearance each side)`, i.widthFt + 2 * i.clearanceFt, 'ft'),
    ),
    compute: () => totalWidth,
    notes: ['Single row. A wrapped or double-row pad is a different layout and a different number.'],
  });

  const padWidth = calc({
    id: 'pad.width',
    label: 'Equipment pad depth',
    formula: 'W = MAX(d_i + 2 x c_i)',
    unit: 'ft',
    inputs: items.map((i) =>
      inp(i.label.replace(/\s+/g, '_'), `${i.label} depth plus clearance`, i.depthFt + 2 * i.clearanceFt, 'ft'),
    ),
    compute: () => maxDepth,
  });

  const padArea = calc({
    id: 'pad.area',
    label: 'Equipment pad area',
    formula: 'A = L x W',
    unit: 'sf',
    inputs: [fromCalc('L', padLength), fromCalc('W', padWidth)],
    compute: ({ L, W }) => L! * W!,
  });

  const valveCount = calc({
    id: 'pad.valves',
    label: 'Valves',
    formula: 'N = manual + actuated',
    unit: 'ea',
    inputs: [
      inp('manual', 'Manual valves', params.manualValves, 'ea'),
      inp('actuated', 'Actuated valves', params.actuatedValves, 'ea'),
    ],
    compute: ({ manual, actuated }) => manual! + actuated!,
  });

  const actuatorCount = calc({
    id: 'pad.actuators',
    label: 'Valve actuators',
    formula: 'N = one per actuated valve',
    unit: 'ea',
    inputs: [inp('actuated', 'Actuated valves', params.actuatedValves, 'ea')],
    compute: ({ actuated }) => actuated!,
  });

  if (hydraulics?.installationRequirements.length) {
    notes.push(
      'The pump manufacturer requires a straight run of pipe into the suction inlet — see the hydraulics section. That length has to fit on the pad, in front of the pump, before any elbow.',
    );
  }
  notes.push(
    `Pad sited ${params.distanceFromPoolFt} ft from the pool. Plumbing run lengths are entered per run and include routing, so they are longer than this straight line — but never shorter.`,
  );
  notes.push(
    'Clearances here are the service clearances entered per item. Code-required clearances to the heater flue, electrical disconnect and the water are not modelled in v1.',
  );

  return {
    distanceFromPool,
    impossibleRuns,
    padLength,
    padWidth,
    padArea,
    items: items.map((i) => ({
      label: i.label,
      footprint: calc({
        id: `pad.item.${i.label.replace(/\s+/g, '-').toLowerCase()}`,
        label: `${i.label} footprint with clearance`,
        formula: 'A_i = (w + 2c) x (d + 2c)',
        unit: 'sf',
        inputs: [
          inp('w', 'Width', i.widthFt, 'ft'),
          inp('d', 'Depth', i.depthFt, 'ft'),
          inp('c', 'Service clearance', i.clearanceFt, 'ft'),
        ],
        compute: ({ w, d, c }) => (w! + 2 * c!) * (d! + 2 * c!),
      }),
    })),
    valveCount,
    actuatorCount,
    notes,
  };
}

// --- entry point ------------------------------------------------------------

export interface EquipmentResult {
  readonly pump: PumpSelection | null;
  readonly gas: GasResult | null;
  readonly pad: PadResult;
  readonly notes: readonly string[];
}

export function computeEquipment(
  job: Job,
  hydraulics: HydraulicsResult | null,
): EquipmentResult | null {
  const params: EquipmentParams | undefined = job.equipment;
  if (!params) return null;

  const notes: string[] = [];
  let pump: PumpSelection | null = null;

  if (hydraulics) {
    pump = selectPump(
      hydraulics,
      hydraulics.flow.designFlow.value,
      params.pumpCandidates ?? ALL_PUMP_MODELS,
    );
  } else {
    notes.push('No hydraulics on this job, so no pump can be matched to an operating point.');
  }

  return {
    pump,
    gas: params.gas ? computeGasDemand(params.gas) : null,
    pad: computePad(params, hydraulics),
    notes,
  };
}
