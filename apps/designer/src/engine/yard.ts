/**
 * Yard & drainage — build order step 8.
 *
 * Deck area, the ISPSC 306.5 slope band, deck drain footage and grade
 * transitions.
 *
 * 306.5 is a band, not a single number: the minimum comes from Table 306.5 and
 * depends on the deck material, and the maximum is 1/2 in per foot for non-wood
 * surfaces. There is also an alternative performance path — no standing water
 * deeper than 1/8 in twenty minutes after the water stops. The module checks the
 * band and reports which path the job is using.
 */

import { calc, inp, type Calc } from './calc.ts';
import type { CodeCheck } from './codeChecks.ts';
import type { GeometryResult } from './geometry.ts';
import type { DeckParams, Job } from './types.ts';
import { placementRect } from './placement.ts';
import {
  assertDeckOutlineContainsPool,
  deckNetArea,
  longestDeckRunFt,
  rectArea,
  type DeckRect,
} from './deck.ts';

/** ISPSC 306.5, non-wood surfaces. */
export const MAX_DECK_SLOPE_IN_PER_FT = 0.5;
/** The alternative performance path's standing water limit. inches. */
export const PERFORMANCE_PATH_DEPTH_IN = 0.125;

export interface YardResult {
  readonly deckArea: Calc;
  readonly deckPerimeter: Calc;
  readonly deckDrainLf: Calc;
  readonly gradeTransitions: Calc;
  readonly fallAcrossDeck: Calc;
  readonly checks: readonly CodeCheck[];
  readonly compliancePath: string;
  readonly notes: readonly string[];
}

export function computeYard(job: Job, geometry: GeometryResult): YardResult | null {
  const d: DeckParams | undefined = job.deck;
  if (!d) return null;

  const notes: string[] = [];
  const L = job.pool.lengthFt;
  const W = job.pool.widthFt;

  // The slab is drawn, not derived from a border width. Refuse one that cuts
  // through the water before computing anything from it.
  const outline = d.outline;
  assertDeckOutlineContainsPool(outline, L, W);

  /**
   * What stands in the slab and is not concrete.
   *
   * The pool always. An attached spa when it sits outside the pool wall — an
   * inset spa is already inside the pool rectangle and would be subtracted
   * twice. This is the correction that moves the number: the old formula
   * counted an attached spa's footprint as deck.
   */
  const obstructions: DeckRect[] = [{ xFt: 0, yFt: 0, widthFt: L, heightFt: W }];
  const spa = job.spa;
  if (spa && !spa.insetIntoPool) {
    const place = spa.placement ?? { wall: 'deep' as const, alongFt: (W - spa.widthFt) / 2 };
    const r = placementRect(place, spa.widthFt, spa.lengthFt, L, W, true);
    obstructions.push({ xFt: r.x, yFt: r.y, widthFt: r.widthFt, heightFt: r.heightFt });
  }

  const grossArea = rectArea(outline);
  const removedArea = grossArea - deckNetArea(outline, obstructions);

  const deckArea = calc({
    id: 'yard.deckArea',
    label: 'Deck area',
    formula: 'A_deck = A_slab - A_standing-in-it',
    unit: 'sf',
    inputs: [
      inp('A_slab', 'Slab as drawn', grossArea, 'sf'),
      inp('A_standing-in-it', 'Water and attached spa inside the slab', removedArea, 'sf'),
    ],
    compute: ({ A_slab, 'A_standing-in-it': removed }) => A_slab! - removed!,
    notes: [
      'The slab as drawn, less everything standing in it. Each obstruction is clipped to the slab first, so a spa that overhangs the concrete only removes the part actually inside it.',
      'Patios, walks and pad slabs outside this outline are separate takeoffs.',
    ],
  });

  const deckPerimeterCalc = calc({
    id: 'yard.deckPerimeter',
    label: 'Deck outer perimeter',
    formula: 'P_out = 2 x (w_slab + h_slab)',
    unit: 'ft',
    inputs: [
      inp('w_slab', 'Slab width as drawn', outline.widthFt, 'ft'),
      inp('h_slab', 'Slab depth as drawn', outline.heightFt, 'ft'),
    ],
    compute: ({ w_slab, h_slab }) => 2 * (w_slab! + h_slab!),
  });

  /**
   * Fall is computed over the LONGEST run from water to slab edge.
   *
   * The old model used the single deck width. On a slab that is 4 ft on three
   * sides and 14 ft on the fourth that understated the fall more than
   * threefold — and fall is what decides whether the deck drains or ponds.
   */
  const runFt = longestDeckRunFt(outline, L, W);
  const fallAcrossDeck = calc({
    id: 'yard.fall',
    label: 'Fall across the deck at the entered slope',
    formula: 'f = s x r',
    unit: 'in',
    inputs: [
      inp('s', 'Deck slope', d.slopeInPerFt, 'in/ft'),
      inp('r', 'Longest run from the water to the slab edge', runFt, 'ft'),
    ],
    compute: ({ s, r }) => s! * r!,
  });

  const deckDrainLf = calc({
    id: 'yard.deckDrain',
    label: 'Deck drain run',
    formula: 'LF = as laid out',
    unit: 'lf',
    inputs: [inp('LF', 'Deck drain length', d.deckDrainLengthFt, 'ft')],
    compute: ({ LF }) => LF!,
  });

  const gradeTransitions = calc({
    id: 'yard.gradeTransitions',
    label: 'Grade transitions',
    formula: 'N = as laid out',
    unit: 'ea',
    inputs: [inp('N', 'Steps, ramps and retaining around the deck', d.gradeTransitions, 'ea')],
    compute: ({ N }) => N!,
  });

  // --- 306.5 slope band ----------------------------------------------------

  const checks: CodeCheck[] = [];
  const overMax = d.slopeInPerFt > MAX_DECK_SLOPE_IN_PER_FT;
  const underMin = d.slopeInPerFt < d.tableMinimumSlopeInPerFt;

  checks.push({
    id: 'ispsc.306.5.max',
    section: 'ISPSC 306.5',
    title: 'Maximum deck slope, non-wood surface',
    status: overMax ? 'fail' : 'pass',
    governingLimit: `max ${MAX_DECK_SLOPE_IN_PER_FT} in per ft`,
    actual: `${d.slopeInPerFt} in per ft (${d.deckMaterial})`,
    message: overMax
      ? `VIOLATION. Deck slope ${d.slopeInPerFt} in per ft exceeds the ${MAX_DECK_SLOPE_IN_PER_FT} in per ft maximum for non-wood surfaces.`
      : `Deck slope ${d.slopeInPerFt} in per ft is within the ${MAX_DECK_SLOPE_IN_PER_FT} in per ft maximum.`,
  });

  if (d.usesPerformancePath) {
    checks.push({
      id: 'ispsc.306.5.performance',
      section: 'ISPSC 306.5 alternative',
      title: 'Performance path in place of the minimum slope',
      status: 'flag',
      governingLimit: `no standing water deeper than ${PERFORMANCE_PATH_DEPTH_IN} in, 20 minutes after the water stops`,
      actual: `${d.slopeInPerFt} in per ft, accepted on the performance path`,
      message:
        'This deck is being accepted on the performance path, so the Table 306.5 minimum does not govern. The test is a field observation and has to be made after the deck is poured — the tool cannot predict it.',
    });
  } else {
    checks.push({
      id: 'ispsc.306.5.min',
      section: 'ISPSC 306.5 / Table 306.5',
      title: 'Minimum deck slope',
      status: underMin ? 'fail' : 'pass',
      governingLimit: `min ${d.tableMinimumSlopeInPerFt} in per ft (Table 306.5, ${d.deckMaterial})`,
      actual: `${d.slopeInPerFt} in per ft`,
      message: underMin
        ? `VIOLATION. Deck slope ${d.slopeInPerFt} in per ft is under the Table 306.5 minimum for ${d.deckMaterial}. Either steepen the deck or take the performance path.`
        : `Deck slope ${d.slopeInPerFt} in per ft meets the Table 306.5 minimum for ${d.deckMaterial}.`,
      ...(underMin
        ? {
            compliancePath: `Alternative performance path: no standing water deeper than ${PERFORMANCE_PATH_DEPTH_IN} in twenty minutes after the water stops.`,
          }
        : {}),
    });
    notes.push(
      `The Table 306.5 minimum is material-dependent, so it is entered per job (${d.tableMinimumSlopeInPerFt} in per ft for ${d.deckMaterial}) rather than hardcoded. Confirm it against the table for the deck actually being poured.`,
    );
  }

  const compliancePath = d.usesPerformancePath
    ? 'Performance path — no standing water deeper than 1/8 in, 20 minutes after the water stops'
    : `Slope band — Table 306.5 minimum to ${MAX_DECK_SLOPE_IN_PER_FT} in per ft maximum`;

  notes.push(
    `Deck drainage carries away from the water on all sides at ${d.slopeInPerFt} in per ft, ${fallAcrossDeck.value.toFixed(2)} in of fall across the longest ${runFt} ft run.`,
  );

  void geometry;

  return {
    deckArea,
    deckPerimeter: deckPerimeterCalc,
    deckDrainLf,
    gradeTransitions,
    fallAcrossDeck,
    checks,
    compliancePath,
    notes,
  };
}
