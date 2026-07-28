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

  // Deck is a band of constant width around the water. Outer footprint less the
  // water plan area is the deck itself.
  const deckArea = calc({
    id: 'yard.deckArea',
    label: 'Deck area',
    formula: 'A_deck = (L + 2w) x (W + 2w) - (L x W)',
    unit: 'sf',
    inputs: [
      inp('L', 'Pool length', L, 'ft'),
      inp('W', 'Pool width', W, 'ft'),
      inp('w', 'Deck width out from the coping', d.widthFt, 'ft'),
    ],
    compute: ({ L, W, w }) => (L! + 2 * w!) * (W! + 2 * w!) - L! * W!,
    notes: ['A constant-width band around the water. Patios, walks and pad slabs are separate takeoffs.'],
  });

  const deckPerimeter = calc({
    id: 'yard.deckPerimeter',
    label: 'Deck outer perimeter',
    formula: 'P_out = 2 x ((L + 2w) + (W + 2w))',
    unit: 'ft',
    inputs: [
      inp('L', 'Pool length', L, 'ft'),
      inp('W', 'Pool width', W, 'ft'),
      inp('w', 'Deck width', d.widthFt, 'ft'),
    ],
    compute: ({ L, W, w }) => 2 * (L! + 2 * w! + (W! + 2 * w!)),
  });

  const fallAcrossDeck = calc({
    id: 'yard.fall',
    label: 'Fall across the deck at the entered slope',
    formula: 'f = s x w',
    unit: 'in',
    inputs: [
      inp('s', 'Deck slope', d.slopeInPerFt, 'in/ft'),
      inp('w', 'Deck width', d.widthFt, 'ft'),
    ],
    compute: ({ s, w }) => s! * w!,
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
    `Deck drainage carries away from the water on all sides at ${d.slopeInPerFt} in per ft, ${fallAcrossDeck.value.toFixed(2)} in of fall across ${d.widthFt} ft.`,
  );

  void geometry;

  return {
    deckArea,
    deckPerimeter,
    deckDrainLf,
    gradeTransitions,
    fallAcrossDeck,
    checks,
    compliancePath,
    notes,
  };
}
