/**
 * Finishes — build order step 8.
 *
 * Straight area and perimeter math off geometry that is already proven, with
 * one addition the base ISPSC has no concept of: the Lubbock amendments require
 * a 1 in minimum contrasting, slip-resistant stripe on the leading edge of every
 * bench, swimout and tanning ledge. That is a finishes quantity, and v2 of the
 * PRD never counted it.
 *
 * Every waste factor is its own line. Net and ordered are both reported.
 */

import { calc, fromCalc, inp, withWaste, type Calc, type NetAndWaste } from './calc.ts';
import type { GeometryResult } from './geometry.ts';
import type { FinishesParams, Job } from './types.ts';
import { inToFt } from './units.ts';

export interface FinishesResult {
  readonly waterlineTileLf: NetAndWaste;
  readonly waterlineTileSf: Calc;
  readonly copingLf: NetAndWaste;
  readonly copingPieces: Calc;
  readonly plasterSf: NetAndWaste;
  readonly contrastStripeLf: NetAndWaste;
  readonly contrastStripeSf: Calc;
  readonly notes: readonly string[];
}

export function computeFinishes(job: Job, geometry: GeometryResult): FinishesResult | null {
  const f: FinishesParams | undefined = job.finishes;
  if (!f) return null;

  const notes: string[] = [];


  // --- waterline tile ------------------------------------------------------

  const tileNet = calc({
    id: 'fin.tile.net',
    label: 'Waterline tile, net',
    formula: 'LF = P_wl',
    unit: 'lf',
    inputs: [fromCalc('P_wl', geometry.waterlinePerimeter)],
    compute: ({ P_wl }) => P_wl!,
  });
  const waterlineTileLf = withWaste(tileNet, f.tileWaste, 'fin.tile');

  const waterlineTileSf = calc({
    id: 'fin.tile.sf',
    label: 'Waterline tile area, order quantity',
    formula: 'SF = LF_ord x h / 12',
    unit: 'sf',
    inputs: [
      fromCalc('LF_ord', waterlineTileLf.ordered),
      inp('h', 'Waterline band height', f.waterlineBandHeightIn, 'in'),
    ],
    compute: ({ LF_ord, h }) => (LF_ord! * h!) / 12,
  });

  if (job.spa?.attachedToPool) {
    notes.push(
      'The waterline perimeter counts the shared spa dam wall on both bodies. Deduct it once here if the tile detail does not wrap it.',
    );
  }

  // --- coping --------------------------------------------------------------

  const copingNet = calc({
    id: 'fin.coping.net',
    label: 'Coping, net',
    formula: 'LF = P_wl',
    unit: 'lf',
    inputs: [fromCalc('P_wl', geometry.waterlinePerimeter)],
    compute: ({ P_wl }) => P_wl!,
  });
  const copingLf = withWaste(copingNet, f.copingWaste, 'fin.coping');

  const unitFt = inToFt(f.copingUnitLengthIn);
  const copingPieces = calc({
    id: 'fin.coping.pieces',
    label: 'Coping units',
    formula: 'N = CEIL(LF_ord / L_unit)',
    unit: 'ea',
    inputs: [
      fromCalc('LF_ord', copingLf.ordered),
      inp('L_unit', 'Coping unit face length', unitFt, 'ft'),
    ],
    compute: ({ LF_ord, L_unit }) => Math.ceil(LF_ord! / L_unit!),
    notes: [
      'Straight-run count. Mitred corners and radius units are cut from the same order quantity; the waste line above is what covers them.',
    ],
  });

  // --- plaster -------------------------------------------------------------

  const plasterNet = calc({
    id: 'fin.plaster.net',
    label: 'Plaster, net',
    formula: 'SF = A_wet',
    unit: 'sf',
    inputs: [fromCalc('A_wet', geometry.totalWettedArea)],
    compute: ({ A_wet }) => A_wet!,
    notes: ['Wetted surface area from the geometry module, floor measured on the slope.'],
  });
  const plasterSf = withWaste(plasterNet, f.plasterWaste, 'fin.plaster');

  // --- Lubbock leading-edge contrast stripe --------------------------------

  const seats = job.pool.seats;
  const stripeLength = seats.reduce((a, s) => a + s.leadingEdgeLengthFt, 0);

  const stripeNet = calc({
    id: 'fin.stripe.net',
    label: 'Leading-edge contrasting stripe, net',
    formula: 'LF = SUM(leading edge of each bench, swimout and ledge)',
    unit: 'lf',
    inputs:
      seats.length > 0
        ? seats.map((s) => inp(s.id, `${s.kind} ${s.id}`, s.leadingEdgeLengthFt, 'ft'))
        : [inp('n', 'Benches, swimouts and ledges on this job', 0, 'ea')],
    compute: () => stripeLength,
    source: 'Lubbock amended ISPSC 411.5.1 / 411.5.2',
    notes: ['Minimum 1 in, contrasting and slip-resistant. Required on every bench, swimout and tanning ledge.'],
  });
  const contrastStripeLf = withWaste(stripeNet, f.tileWaste, 'fin.stripe');

  const contrastStripeSf = calc({
    id: 'fin.stripe.sf',
    label: 'Contrast stripe area, order quantity',
    formula: 'SF = LF_ord x h / 12',
    unit: 'sf',
    inputs: [
      fromCalc('LF_ord', contrastStripeLf.ordered),
      inp('h', 'Stripe height', f.contrastStripeHeightIn, 'in'),
    ],
    compute: ({ LF_ord, h }) => (LF_ord! * h!) / 12,
  });

  if (f.contrastStripeHeightIn < 1) {
    notes.push(
      `Contrast stripe height is ${f.contrastStripeHeightIn} in, under the 1 in Lubbock minimum. The quantity below is what was entered, not what is compliant.`,
    );
  }
  if (seats.length === 0) {
    notes.push('No benches, swimouts or ledges on this job, so no contrast stripe is required.');
  }

  return {
    waterlineTileLf,
    waterlineTileSf,
    copingLf,
    copingPieces,
    plasterSf,
    contrastStripeLf,
    contrastStripeSf,
    notes,
  };
}
