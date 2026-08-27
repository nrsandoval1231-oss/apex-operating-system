/**
 * Excavation engine — build order step 2.
 *
 * Three volume states, always labeled, never conflated:
 *   BCY  bank      — in place, what you dig
 *   LCY  loose     — what rides in the truck, bank x (1 + swell)
 *   CCY  compacted — what backfill actually yields
 *
 * Lubbock sits on a layered profile (sandy / clay loam over caliche at a depth
 * that varies by site), so cut volume is computed per layer and swelled per
 * layer. There is no single soil type and no single swell number.
 *
 * PRD open question 2: ripped caliche is not honestly defaultable — published
 * tables cover clay and blasted rock, not caliche, and hardness and depth vary
 * across the city. Every layer's swell factor is a required job input. The
 * engine supplies no caliche number.
 */

import { calc, fromCalc, inp, type Calc } from './calc.ts';
import { crossSectionArea, integrateDepthBand, maxDepth, type ProfileSegment } from './profile.ts';
import type { ExcavationParams, Job, SoilLayer } from './types.ts';
import { CF_PER_CY } from './units.ts';

export class ExcavationInputError extends Error {}

export interface LayerVolumes {
  readonly layer: SoilLayer;
  /** Depth band actually excavated within this layer. ft */
  readonly bandTopFt: number;
  readonly bandBottomFt: number;
  readonly cutCf: Calc;
  readonly bankCy: Calc;
  readonly looseCy: Calc;
}

export interface ExcavationResult {
  readonly cutSegments: readonly ProfileSegment[];
  readonly excavationLength: Calc;
  readonly excavationWidth: Calc;
  readonly maxCutDepth: Calc;
  /** Additional excavation outside the pool envelope for a deep-end attached spa. */
  readonly attachedSpaCutCf?: Calc;
  /** Extra top-band cut between the 6 in shell envelope and 12 in bond-beam form line. */
  readonly bondBeamOverdigCutCf: Calc;
  /** Linear feet of the outer 12 in bond-beam form line. */
  readonly bondBeamFormPerimeter: Calc;
  readonly totalCutCf: Calc;
  readonly layers: readonly LayerVolumes[];
  readonly totalBankCy: Calc;
  readonly totalLooseCy: Calc;
  readonly backfillVoidCf: Calc;
  readonly backfillCompactedCy: Calc;
  readonly backfillBankCy: Calc;
  readonly backfillLooseCy: Calc;
  readonly spoilHaulLooseCy: Calc;
  readonly truckCount: Calc;
  readonly notes: readonly string[];
}

/**
 * Build the excavation depth profile from the water profile.
 *
 * Cut depth at any station = freeboard (grade to waterline) + water depth
 * + shell thickness. The ordinary full-depth footprint is offset by the 6 in
 * shell thickness. The wider 12 in bond-beam zone is added separately so it can
 * never be applied through the full shell depth.
 */
export function buildCutSegments(
  waterSegments: readonly ProfileSegment[],
  params: ExcavationParams,
): ProfileSegment[] {
  const k = params.freeboardFt + params.shellThicknessFt;
  const ext = params.shellThicknessFt;

  const first = waterSegments[0];
  const last = waterSegments[waterSegments.length - 1];
  if (!first || !last) {
    throw new ExcavationInputError('No water profile segments to excavate.');
  }

  return [
    { name: 'Over-dig, shallow end', length: ext, d1: first.d1 + k, d2: first.d1 + k },
    ...waterSegments.map((s) => ({ name: s.name, length: s.length, d1: s.d1 + k, d2: s.d2 + k })),
    { name: 'Over-dig, deep end', length: ext, d1: last.d2 + k, d2: last.d2 + k },
  ];
}

function validateLayers(layers: readonly SoilLayer[]): void {
  if (layers.length === 0) {
    throw new ExcavationInputError(
      'No soil layers entered. Lubbock excavation requires a layered profile: depth to caliche, thickness, and a swell factor per layer.',
    );
  }
  let expectedTop = 0;
  for (const l of layers) {
    if (Math.abs(l.topDepthFt - expectedTop) > 0.01) {
      throw new ExcavationInputError(
        `Soil layer "${l.name}" starts at ${l.topDepthFt} ft but the layer above ends at ${expectedTop} ft. Layers must be contiguous from grade.`,
      );
    }
    if (!(l.swellFactor >= 0)) {
      throw new ExcavationInputError(
        `Soil layer "${l.name}" has no swell factor. Swell is a required input per layer — the engine does not default caliche.`,
      );
    }
    if (!(l.compactionYield > 0)) {
      throw new ExcavationInputError(`Soil layer "${l.name}" has no compaction yield.`);
    }
    expectedTop += l.thicknessFt;
  }
}

export function computeExcavation(
  job: Job,
  waterSegments: readonly ProfileSegment[],
  waterVolumeCf: number,
  wettedAreaSf: number,
): ExcavationResult {
  const params = job.excavation;
  validateLayers(params.soilLayers);
  if (!(params.shellThicknessFt > 0)) {
    throw new ExcavationInputError('Shell thickness must be greater than zero.');
  }
  if (!(params.bondBeamFormOffsetFt >= params.shellThicknessFt)) {
    throw new ExcavationInputError('Bond-beam form offset cannot be inside the ordinary shell excavation.');
  }
  if (!(params.bondBeamDepthFt > 0)) {
    throw new ExcavationInputError('Bond-beam excavation depth must be greater than zero.');
  }

  const cutSegments = buildCutSegments(waterSegments, params);
  const notes: string[] = [];
  const attachedSpa = job.spa?.attachedToPool === true && job.spa.insetIntoPool !== true
    ? job.spa
    : undefined;
  const excavationExtensionFt = params.shellThicknessFt;
  const attachedSpaCutDepthFt = attachedSpa
    ? params.freeboardFt + attachedSpa.depthFt + params.shellThicknessFt
    : 0;
  const attachedSpaAdditionalPlanAreaSf = attachedSpa
    ? attachedSpa.lengthFt * (attachedSpa.widthFt + 2 * excavationExtensionFt)
    : 0;

  const excavationLength = calc({
    id: 'exc.length',
    label: 'Excavation length at grade',
    formula: 'L_exc,shell = L + 2 x t_shell',
    unit: 'ft',
    inputs: [
      inp('L', 'Pool length', job.pool.lengthFt, 'ft'),
      inp('t_shell', 'Shell thickness', params.shellThicknessFt, 'ft'),
    ],
    compute: ({ L, t_shell }) => L! + 2 * t_shell!,
  });

  const excavationWidth = calc({
    id: 'exc.width',
    label: 'Excavation width at grade',
    formula: 'W_exc,shell = W + 2 x t_shell',
    unit: 'ft',
    inputs: [
      inp('W', 'Pool width', job.pool.widthFt, 'ft'),
      inp('t_shell', 'Shell thickness', params.shellThicknessFt, 'ft'),
    ],
    compute: ({ W, t_shell }) => W! + 2 * t_shell!,
  });

  const poolMaxCut = maxDepth(cutSegments);
  const maxCut = Math.max(poolMaxCut, attachedSpaCutDepthFt);
  const maxCutDepth = calc({
    id: 'exc.maxDepth',
    label: 'Maximum cut depth below grade',
    formula: attachedSpa ? 'D_max = MAX(D_pool, D_spa)' : 'D_max = f + d_dp + t_shell',
    unit: 'ft',
    inputs: [
      inp('f', 'Freeboard, grade to waterline', params.freeboardFt, 'ft'),
      inp('d_dp', 'Deep water depth', job.pool.profile.deepDepth, 'ft'),
      inp('t_shell', 'Shell thickness', params.shellThicknessFt, 'ft'),
      ...(attachedSpa ? [inp('D_spa', 'Attached spa cut depth', attachedSpaCutDepthFt, 'ft')] : []),
    ],
    compute: ({ f, d_dp, t_shell, D_spa }) =>
      Math.max(f! + d_dp! + t_shell!, D_spa ?? 0),
  });

  const cutSectionArea = crossSectionArea(cutSegments);
  const poolCutCf = calc({
    id: 'exc.poolCut',
    label: 'Pool cut volume',
    formula: 'V_cut = A_sec,exc x W_exc',
    unit: 'cf',
    inputs: [
      inp('A_sec,exc', 'Excavation section area', cutSectionArea, 'sf'),
      fromCalc('W_exc', excavationWidth),
    ],
    compute: (v) => v['A_sec,exc']! * v['W_exc']!,
    notes: ['Vertical sidewalls assumed. No benching, sloping, or shoring allowance — that is a means-and-methods call, not a takeoff number.'],
  });

  const attachedSpaCutCf = attachedSpa
    ? calc({
        id: 'exc.spa.attachedCut',
        label: 'Attached spa cut beyond the pool excavation envelope',
        formula: 'V_spa,add = L_spa x (W_spa + 2 x e) x D_spa',
        unit: 'cf',
        inputs: [
          inp('L_spa', 'Spa outward run from shared pool wall', attachedSpa.lengthFt, 'ft'),
          inp('W_spa', 'Spa width along shared pool wall', attachedSpa.widthFt, 'ft'),
          inp('e', 'Shell plus horizontal over-dig on each exposed side', excavationExtensionFt, 'ft'),
          inp('D_spa', 'Spa cut depth below grade', attachedSpaCutDepthFt, 'ft'),
        ],
        compute: ({ L_spa, W_spa, e, D_spa }) => L_spa! * (W_spa! + 2 * e!) * D_spa!,
        notes: [
          'The attached spa is centered on the pool deep-end wall, matching the plan view. The pool excavation already contains the shared-edge over-dig strip, so only the spa outward run is additive.',
        ],
      })
    : undefined;

  const planAreaAtOffset = (offsetFt: number) =>
    (job.pool.lengthFt + 2 * offsetFt) * (job.pool.widthFt + 2 * offsetFt) +
    (attachedSpa ? attachedSpa.lengthFt * (attachedSpa.widthFt + 2 * offsetFt) : 0);
  const shellExcavationPlanAreaSf = planAreaAtOffset(params.shellThicknessFt);
  const bondBeamExcavationPlanAreaSf = planAreaAtOffset(params.bondBeamFormOffsetFt);
  const bondBeamExtraPlanAreaSf = bondBeamExcavationPlanAreaSf - shellExcavationPlanAreaSf;

  const bondBeamOverdigCutCf = calc({
    id: 'exc.bondBeam.extraCut',
    label: 'Bond-beam-only overdig volume',
    formula: 'V_bb,extra = (A_exc,bb - A_exc,shell) x D_bb',
    unit: 'cf',
    inputs: [
      inp('A_exc,bb', 'Plan area at 12 in bond-beam form offset', bondBeamExcavationPlanAreaSf, 'sf'),
      inp('A_exc,shell', 'Plan area at 6 in ordinary shell offset', shellExcavationPlanAreaSf, 'sf'),
      inp('D_bb', 'Bond-beam excavation depth', params.bondBeamDepthFt, 'ft'),
    ],
    compute: (values) => (values['A_exc,bb']! - values['A_exc,shell']!) * values.D_bb!,
    notes: [
      'The 12 in form offset applies only through the bond-beam depth. The full-depth shell remains at the 6 in offset.',
    ],
  });

  const bondBeamFormPerimeter = calc({
    id: 'exc.bondBeam.formPerimeter',
    label: 'Bond-beam form perimeter',
    formula: 'P_form = P_exc,bond-beam',
    unit: 'ft',
    inputs: [
      inp('L', 'Finished pool length', job.pool.lengthFt, 'ft'),
      inp('W', 'Finished pool width', job.pool.widthFt, 'ft'),
      inp('o_bb', 'Bond-beam form offset from finished waterline', params.bondBeamFormOffsetFt, 'ft'),
      ...(attachedSpa ? [inp('L_spa', 'Attached spa outward run', attachedSpa.lengthFt, 'ft')] : []),
    ],
    compute: ({ L, W, o_bb, L_spa }) => 2 * (L! + 2 * o_bb! + W! + 2 * o_bb!) + 2 * (L_spa ?? 0),
    notes: [
      'Measures the outer form line at the 12 in bond-beam offset. An externally attached spa adds its two outward side runs; the shared wall and far wall replace equal lengths.',
    ],
  });

  const totalCutCf = calc({
    id: 'exc.totalCut',
    label: 'Total cut volume',
    formula: attachedSpaCutCf
      ? 'V_cut = V_pool,shell + V_spa,shell + V_bb,extra'
      : 'V_cut = V_pool,shell + V_bb,extra',
    unit: 'cf',
    inputs: [
      fromCalc('V_pool', poolCutCf),
      ...(attachedSpaCutCf ? [fromCalc('V_spa,add', attachedSpaCutCf)] : []),
      fromCalc('V_bb,extra', bondBeamOverdigCutCf),
    ],
    compute: ({ V_pool, 'V_spa,add': V_spa, 'V_bb,extra': V_bondBeam }) =>
      V_pool! + (V_spa ?? 0) + V_bondBeam!,
    notes: [
      'Vertical sidewalls assumed. No benching, sloping, or shoring allowance — that is a means-and-methods call, not a takeoff number.',
      'The wider 12 in excavation is isolated to the bond-beam depth; ordinary shell excavation uses the 6 in offset.',
    ],
  });

  // --- per layer ------------------------------------------------------------

  const layers: LayerVolumes[] = [];
  for (const layer of params.soilLayers) {
    const lo = layer.topDepthFt;
    const hi = Math.min(layer.topDepthFt + layer.thicknessFt, maxCut);
    const bandArea = hi > lo ? integrateDepthBand(cutSegments, lo, hi) : 0;
    const attachedSpaBandDepthFt = attachedSpa
      ? Math.max(0, Math.min(hi, attachedSpaCutDepthFt) - lo)
      : 0;
    const attachedSpaBandCutCf = attachedSpaAdditionalPlanAreaSf * attachedSpaBandDepthFt;
    const bondBeamBandDepthFt = Math.max(0, Math.min(hi, params.bondBeamDepthFt) - lo);
    const bondBeamBandCutCf = bondBeamExtraPlanAreaSf * bondBeamBandDepthFt;

    const cutCf = calc({
      id: `exc.layer.${slug(layer.name)}.cut`,
      label: `${layer.name} — cut volume`,
      formula: attachedSpa
        ? 'V = W_exc x INTEGRAL clamp(d(x) - z_top, 0, t_layer) dx + V_spa,band + V_bb,band'
        : 'V = W_exc x INTEGRAL clamp(d(x) - z_top, 0, t_layer) dx + V_bb,band',
      unit: 'cf',
      inputs: [
        fromCalc('W_exc', excavationWidth),
        inp('z_top', 'Depth to top of layer', lo, 'ft'),
        inp('t_layer', 'Layer thickness within the cut', hi - lo, 'ft'),
        inp('A_band', 'Section area of the cut inside this layer', bandArea, 'sf'),
        ...(attachedSpa ? [inp('V_spa,band', 'Attached spa cut inside this layer', attachedSpaBandCutCf, 'cf')] : []),
        inp('V_bb,band', 'Bond-beam-only cut inside this layer', bondBeamBandCutCf, 'cf'),
      ],
      compute: ({ A_band, W_exc, 'V_spa,band': V_spa, 'V_bb,band': V_bondBeam }) =>
        A_band! * W_exc! + (V_spa ?? 0) + V_bondBeam!,
      notes: [
        'Integrated analytically over the piecewise-linear cut profile — the sloped transition only reaches this layer over part of its run.',
      ],
    });

    const bankCy = calc({
      id: `exc.layer.${slug(layer.name)}.bank`,
      label: `${layer.name} — bank volume`,
      formula: 'BCY = V / 27',
      unit: 'BCY',
      inputs: [fromCalc('V', cutCf), inp('k', 'Cubic feet per cubic yard', CF_PER_CY, 'cf/cy')],
      compute: ({ V, k }) => V! / k!,
    });

    const looseCy = calc({
      id: `exc.layer.${slug(layer.name)}.loose`,
      label: `${layer.name} — loose volume`,
      formula: 'LCY = BCY x (1 + s)',
      unit: 'LCY',
      inputs: [fromCalc('BCY', bankCy), inp('s', 'Swell factor', layer.swellFactor, 'fraction')],
      compute: ({ BCY, s }) => BCY! * (1 + s!),
      source: layer.source ?? 'Swell is a job input, entered per layer — no source recorded',
    });

    layers.push({ layer, bandTopFt: lo, bandBottomFt: hi, cutCf, bankCy, looseCy });
  }

  const deepestLayer = params.soilLayers[params.soilLayers.length - 1]!;
  const bottomOfLayers = deepestLayer.topDepthFt + deepestLayer.thicknessFt;
  if (bottomOfLayers < maxCut - 0.01) {
    throw new ExcavationInputError(
      `Soil profile only describes the top ${bottomOfLayers.toFixed(2)} ft but the cut goes to ${maxCut.toFixed(2)} ft. ` +
        `Extend the bottom layer (thickness Infinity) or add a layer.`,
    );
  }

  const totalBankCy = calc({
    id: 'exc.totalBank',
    label: 'Total bank volume, all layers',
    formula: 'BCY_tot = SUM(BCY_layer)',
    unit: 'BCY',
    inputs: layers.map((l, i) => inp(`BCY_${i + 1}`, l.layer.name, l.bankCy.value, 'BCY')),
    compute: (v) => Object.values(v).reduce((a, b) => a + b, 0),
    notes: [
      'Every layer includes the 6 in full-depth shell excavation plus the 12 in bond-beam-only offset within the top bond-beam depth.',
    ],
  });

  const totalLooseCy = calc({
    id: 'exc.totalLoose',
    label: 'Total loose volume, all layers',
    formula: 'LCY_tot = SUM(LCY_layer)',
    unit: 'LCY',
    inputs: layers.map((l, i) => inp(`LCY_${i + 1}`, l.layer.name, l.looseCy.value, 'LCY')),
    compute: (v) => Object.values(v).reduce((a, b) => a + b, 0),
    notes: ['Loose totals are additive only because each layer was swelled with its own factor first.'],
  });

  // --- backfill and spoil balance ------------------------------------------

  const shellVolumeCf = wettedAreaSf * params.shellThicknessFt;
  notes.push(
    'Shell volume here is wetted area x shell thickness — a placeholder for the balance only. The structure module (step 4) supersedes it with the standard detail, including the bond beam.',
  );

  const backfillVoidCf = calc({
    id: 'exc.backfillVoid',
    label: 'Backfill void (space to refill outside the shell)',
    formula: 'V_void = V_cut - V_water - V_shell',
    unit: 'cf',
    inputs: [
      fromCalc('V_cut', totalCutCf),
      inp('V_water', 'Water volume', waterVolumeCf, 'cf'),
      inp('V_shell', 'Shell volume (placeholder: A_wet x t_shell)', shellVolumeCf, 'cf'),
    ],
    compute: ({ V_cut, V_water, V_shell }) => V_cut! - V_water! - V_shell!,
  });

  const backfillCompactedCy = calc({
    id: 'exc.backfillCcy',
    label: 'Backfill required, compacted in place',
    formula: 'CCY = V_void / 27',
    unit: 'CCY',
    inputs: [
      fromCalc('V_void', backfillVoidCf),
      inp('k', 'Cubic feet per cubic yard', CF_PER_CY, 'cf/cy'),
    ],
    compute: ({ V_void, k }) => V_void! / k!,
  });

  // Blend the excavated material by volume. Real jobs may import select fill or
  // reject caliche for backfill; that is a job decision, so it is stated, not assumed.
  const totalBank = totalBankCy.value;
  const blendYield =
    totalBank > 0
      ? layers.reduce((a, l) => a + l.bankCy.value * l.layer.compactionYield, 0) / totalBank
      : 1;
  const blendSwell =
    totalBank > 0
      ? layers.reduce((a, l) => a + l.bankCy.value * l.layer.swellFactor, 0) / totalBank
      : 0;
  notes.push(
    'Backfill is assumed to come from the excavated material, blended across layers by bank volume. If caliche is rejected for backfill or select fill is imported, this line changes and the haul count goes up.',
  );

  const backfillBankCy = calc({
    id: 'exc.backfillBcy',
    label: 'Bank volume consumed as backfill',
    formula: 'BCY_bf = CCY / y',
    unit: 'BCY',
    inputs: [
      fromCalc('CCY', backfillCompactedCy),
      inp('y', 'Compacted yield per bank volume (blended)', blendYield, 'CCY/BCY'),
    ],
    compute: ({ CCY, y }) => CCY! / y!,
  });

  const backfillLooseCy = calc({
    id: 'exc.backfillLcy',
    label: 'Loose volume consumed as backfill',
    formula: 'LCY_bf = BCY_bf x (1 + s_blend)',
    unit: 'LCY',
    inputs: [
      fromCalc('BCY_bf', backfillBankCy),
      inp('s_blend', 'Blended swell factor', blendSwell, 'fraction'),
    ],
    compute: ({ BCY_bf, s_blend }) => BCY_bf! * (1 + s_blend!),
  });

  const spoilHaulLooseCy = calc({
    id: 'exc.spoilHaul',
    label: 'Spoil to haul off',
    formula: 'LCY_haul = LCY_tot - LCY_bf',
    unit: 'LCY',
    inputs: [fromCalc('LCY_tot', totalLooseCy), fromCalc('LCY_bf', backfillLooseCy)],
    compute: ({ LCY_tot, LCY_bf }) => Math.max(0, LCY_tot! - LCY_bf!),
    notes: ['Backfill balance is figured in compacted volume; haul is figured in loose volume.'],
  });

  const truckCount = calc({
    id: 'exc.truckCount',
    label: 'Haul truck loads',
    formula: 'N = CEIL(LCY_haul / C)',
    unit: 'loads',
    inputs: [
      fromCalc('LCY_haul', spoilHaulLooseCy),
      inp('C', 'Truck capacity', params.truckCapacityLcy, 'LCY'),
    ],
    compute: ({ LCY_haul, C }) => Math.ceil(LCY_haul! / C!),
    notes: ['Always rounds up. A partial load is a load.'],
  });

  return {
    cutSegments,
    excavationLength,
    excavationWidth,
    maxCutDepth,
    ...(attachedSpaCutCf ? { attachedSpaCutCf } : {}),
    bondBeamOverdigCutCf,
    bondBeamFormPerimeter,
    totalCutCf,
    layers,
    totalBankCy,
    totalLooseCy,
    backfillVoidCf,
    backfillCompactedCy,
    backfillBankCy,
    backfillLooseCy,
    spoilHaulLooseCy,
    truckCount,
    notes,
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
