/**
 * Bill of materials: what to order and what shows up on the truck.
 *
 * The takeoff sheet shows its working — every formula, every input, every code
 * check. That is the right output for defending a number and the wrong one for
 * ordering steel. This flattens the same results into lines a builder reads:
 *
 *   400 ft of #3 rebar
 *   1 pump, 2 hp variable speed
 *   5 return branches
 *
 * NOTHING IS COMPUTED HERE. Every figure is lifted from a takeoff the engine
 * already produced. If a module refused — no stored detail, out of envelope, no
 * hydraulics on the job — its lines are absent and `missing` says so by name,
 * because a short BOM that looks complete is how a job gets under-ordered.
 */

import type { TakeoffResult } from './index.ts';
import type { Job } from './types.ts';

export interface BomLine {
  /** What to order. */
  readonly item: string;
  readonly quantity: number;
  readonly unit: string;
  /** Where the number came from, for anyone who wants to chase it. */
  readonly basis: string;
  /** Ordered figures include waste; net ones do not. Stated, never implied. */
  readonly includesWaste?: boolean;
}

export interface BomGroup {
  readonly title: string;
  readonly lines: readonly BomLine[];
}

export interface Bom {
  readonly groups: readonly BomGroup[];
  /** Modules that produced nothing, and why. Never silently omitted. */
  readonly missing: readonly string[];
}

const round = (value: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
};

export function buildBom(job: Job, takeoff: TakeoffResult): Bom {
  const groups: BomGroup[] = [];
  const missing: string[] = [];

  // --- dig -------------------------------------------------------------------
  const x = takeoff.excavation;
  groups.push({
    title: 'Dig and haul',
    lines: [
      { item: 'Excavation, bank measure', quantity: round(x.totalBankCy.value, 1), unit: 'CY', basis: 'cut to the over-dig line' },
      { item: 'Spoil to haul, loose', quantity: round(x.spoilHaulLooseCy.value, 1), unit: 'LCY', basis: 'after swell' },
      {
        item: `Truck loads at ${job.excavation.truckCapacityLcy} LCY`,
        quantity: Math.ceil(x.spoilHaulLooseCy.value / job.excavation.truckCapacityLcy),
        unit: 'loads',
        basis: 'always rounds up',
      },
    ],
  });

  // --- shell -----------------------------------------------------------------
  const structure = takeoff.structure;
  if (structure.outcome === 'quantities') {
    const q = structure.quantities;
    const bar = q.detail.barSize;
    groups.push({
      title: 'Shell',
      lines: [
        { item: `Gunite, ordered`, quantity: round(q.guniteCy.value, 1), unit: 'CY', basis: 'shell, cove, bond beam plus rebound', includesWaste: true },
        { item: `${bar} rebar`, quantity: round(q.barLinearFeet.value), unit: 'ft', basis: `${q.detail.barSpacingIn}" o.c. each way, laps included` },
        { item: `${bar} stock bars at ${q.cutPlan.stockLengthFt} ft`, quantity: q.cutPlan.stockBars, unit: 'bars', basis: `cut plan, ${round(q.cutPlan.dropPct, 1)}% drop` },
        { item: 'Rebar ties', quantity: round(q.tieCount.value), unit: 'ea', basis: 'one per intersection' },
      ],
    });
    if (q.cutPlan.splices > 0) {
      groups[groups.length - 1] = {
        title: 'Shell',
        lines: [
          ...groups[groups.length - 1]!.lines,
          { item: 'Bar splices', quantity: q.cutPlan.splices, unit: 'ea', basis: 'bars longer than a stock length' },
        ],
      };
    }
  } else {
    missing.push(`Shell steel and gunite: ${structure.outcome === 'no-detail' ? 'no standard detail stored' : 'job is outside every stored detail envelope'}.`);
  }

  // --- plumbing --------------------------------------------------------------
  const hyd = takeoff.hydraulics;
  if (hyd) {
    const byRole = (role: string) => hyd.runs.filter((r) => r.run.role === role).length;
    const lines: BomLine[] = [
      { item: 'Suction outlets (main drains)', quantity: job.hydraulics?.mainDrains.count ?? 0, unit: 'ea', basis: 'dual outlets are mandatory' },
      { item: 'Skimmers', quantity: byRole('skimmer'), unit: 'ea', basis: 'one run each' },
      { item: 'Return inlets', quantity: byRole('return-branch'), unit: 'ea', basis: 'one run each' },
    ];
    const spaJets = byRole('spa-jet');
    if (spaJets > 0) lines.push({ item: 'Spa jet supply runs', quantity: spaJets, unit: 'ea', basis: 'from the pad' });

    // Pipe grouped by the size the engine actually selected, not by nominal
    // guess: two runs of the same role can size differently.
    const pipe = new Map<string, number>();
    for (const run of hyd.runs) {
      pipe.set(run.size, (pipe.get(run.size) ?? 0) + run.run.lengthFt);
    }
    for (const [size, lengthFt] of [...pipe].sort()) {
      lines.push({ item: `${size}" PVC pipe`, quantity: round(lengthFt), unit: 'ft', basis: 'measured run lengths, fittings not included' });
    }

    if (hyd.pumpModel) {
      const pump = hyd.pumpModel;
      lines.push({
        item: `Pump — ${pump.manufacturer} ${pump.series}, ${pump.totalHp} hp${hyd.speedOptions.length > 1 ? ' variable speed' : ''}`,
        quantity: 1,
        unit: 'ea',
        basis: hyd.selectedSpeed
          ? `runs at ${hyd.selectedSpeed.rpm} rpm${hyd.selectedSpeed.operatingPoint ? `, ${round(hyd.selectedSpeed.operatingPoint.gpm)} gpm` : ''}`
          : 'no operating point selected',
      });
    } else {
      missing.push('Pump: no pump model is specified on the job.');
    }
    if (job.hydraulics?.hydrostaticReliefValves) {
      lines.push({ item: 'Hydrostatic relief valve', quantity: job.hydraulics.hydrostaticReliefValves, unit: 'ea', basis: 'job input' });
    }
    groups.push({ title: 'Plumbing', lines });
  } else {
    missing.push('Plumbing: the job carries no hydraulics inputs.');
  }

  // --- equipment pad ---------------------------------------------------------
  const equipment = takeoff.equipment;
  if (equipment) {
    const lines: BomLine[] = (job.equipment?.padItems ?? []).map((item) => ({
      item: item.label,
      quantity: 1,
      unit: 'ea',
      basis: `${item.widthFt} × ${item.depthFt} ft on the pad`,
    }));
    if (job.equipment?.actuatedValves) lines.push({ item: 'Actuated valves', quantity: job.equipment.actuatedValves, unit: 'ea', basis: 'job input' });
    if (job.equipment?.manualValves) lines.push({ item: 'Manual valves', quantity: job.equipment.manualValves, unit: 'ea', basis: 'job input' });
    if (equipment.gas) {
      lines.push({
        item: `Gas line, ${equipment.gas.intendedSize.label ?? 'size unresolved'}`,
        quantity: round(job.equipment?.gas?.runLengthFt ?? 0),
        unit: 'ft',
        basis: 'measured run, fittings added as equivalent length',
      });
    }
    if (lines.length > 0) groups.push({ title: 'Equipment pad', lines });
  }

  // --- finishes --------------------------------------------------------------
  const finishes = takeoff.finishes;
  if (finishes) {
    groups.push({
      title: 'Finishes',
      lines: [
        { item: 'Plaster / pebble', quantity: round(finishes.plasterSf.ordered.value), unit: 'sf', basis: 'wetted area', includesWaste: true },
        { item: 'Waterline tile', quantity: round(finishes.waterlineTileLf.ordered.value), unit: 'ft', basis: `${job.finishes?.waterlineBandHeightIn ?? 0}" band`, includesWaste: true },
        { item: 'Coping', quantity: round(finishes.copingLf.ordered.value), unit: 'ft', basis: 'perimeter', includesWaste: true },
        { item: 'Coping pieces', quantity: round(finishes.copingPieces.value), unit: 'ea', basis: `${job.finishes?.copingUnitLengthIn ?? 0}" units` },
      ],
    });
  } else {
    missing.push('Finishes: the job carries no finishes inputs.');
  }

  // --- deck ------------------------------------------------------------------
  const yard = takeoff.yard;
  if (yard) {
    groups.push({
      title: 'Deck',
      lines: [
        { item: job.deck?.deckMaterial ?? 'Deck', quantity: round(yard.deckArea.value), unit: 'sf', basis: `${job.deck?.widthFt ?? 0} ft border` },
        { item: 'Deck drain', quantity: round(yard.deckDrainLf.value), unit: 'ft', basis: 'job input' },
      ],
    });
  }

  return { groups, missing };
}
