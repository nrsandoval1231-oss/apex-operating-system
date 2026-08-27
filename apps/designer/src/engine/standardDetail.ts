/**
 * Stored standard detail — the input to the structure module.
 *
 * The tool does not design a shell. It reads shell thickness, bar size and
 * spacing, bond beam section, dam wall, cove and stress-point spacing, and the
 * pier schedule from a detail entered once and versioned with a date, then
 * converts them to quantities.
 *
 * Each detail carries a DECLARED ENVELOPE: the depth range, plan dimensions and
 * soil conditions it was built for. A job outside that envelope produces no
 * structural quantities. That flag is not "the code requires an engineer" — no
 * stamp is required for residential in Lubbock — it is "this job is outside what
 * your standard detail covers, and you decide what to do about it."
 */

import type { Job } from './types.ts';

/** #3, #4, #5. Nominal diameter and unit weight are fixed properties of the bar. */
export type BarSize = '#3' | '#4' | '#5';

export const BAR_PROPERTIES: Record<BarSize, { diameterIn: number; lbPerFt: number }> = {
  '#3': { diameterIn: 0.375, lbPerFt: 0.376 },
  '#4': { diameterIn: 0.5, lbPerFt: 0.668 },
  '#5': { diameterIn: 0.625, lbPerFt: 1.043 },
};

export interface Pier {
  readonly label: string;
  readonly count: number;
  readonly diameterIn: number;
  readonly depthFt: number;
}

/** The range of jobs a detail was built for. Outside it, the module refuses. */
export interface DetailEnvelope {
  readonly minDepthFt: number;
  readonly maxDepthFt: number;
  readonly maxLengthFt: number;
  readonly maxWidthFt: number;
  /**
   * Soil conditions the detail assumes, e.g. "caliche at 3-6 ft, no collapsible
   * fill". Stated on the sheet for human confirmation — subsurface conditions
   * are not something the tool can machine-check against a soil layer table.
   */
  readonly soilConditions: string;
}

export interface StandardDetail {
  readonly id: string;
  readonly name: string;
  /** Version date of the detail. Prints on every sheet. */
  readonly versionDate: string;
  readonly envelope: DetailEnvelope;
  /**
   * Fields the builder stated, and fields filled in on their instruction.
   * A detail assembled from both is still usable, but the sheet should not make
   * the two look alike — the same reasoning as swell factor provenance.
   */
  readonly suppliedFields?: readonly string[];
  readonly assumedFields?: readonly string[];
  /**
   * False when the declared envelope was assumed rather than stated.
   *
   * This matters more than any other assumed field. The envelope is what makes
   * the refusal real: a boundary nobody confirmed only refuses jobs outside a
   * range the tool invented, which is refusal as theatre. Quantities are still
   * produced, but the sheet says the boundary is provisional on every job.
   */
  readonly envelopeConfirmed: boolean;

  readonly shellThicknessIn: number;
  readonly barSize: BarSize;
  /** Bar spacing each way. inches. */
  readonly barSpacingIn: number;
  /** Tighter spacing at coves, breakover and stress points. inches. */
  readonly stressPointSpacingIn: number;
  /** Width of the zone that gets the tighter spacing, measured from the cove. ft */
  readonly stressPointZoneFt: number;

  readonly bondBeamWidthIn: number;
  readonly bondBeamDepthIn: number;
  readonly bondBeamBarCount: number;
  readonly bondBeamBarSize: BarSize;

  readonly damWallThicknessIn: number;
  /** Leg of the triangular cove fillet at the floor-to-wall junction. inches. */
  readonly coveLegIn: number;

  readonly gunitePsi: number;
  /** Rebound and overspray, as a fraction. Reported separately from net volume. */
  readonly reboundAllowance: number;
  /** Lap and hook allowance added to each bar. ft */
  readonly barLapAllowanceFt: number;
  /** Stock bar length for cut optimization. ft */
  readonly stockBarLengthFt: number;
  /** Fraction of bar intersections that get tied. 1.0 = every intersection. */
  readonly tieFraction: number;

  readonly piers: readonly Pier[];
}

export type EnvelopeStatus = 'in-envelope' | 'out-of-envelope';

export interface EnvelopeMatch {
  readonly status: EnvelopeStatus;
  readonly detail: StandardDetail;
  /** One line per envelope dimension, pass or fail, always reported. */
  readonly findings: readonly {
    readonly dimension: string;
    readonly limit: string;
    readonly actual: string;
    readonly ok: boolean;
  }[];
  /** Human confirmation items that cannot be machine-checked. */
  readonly confirmations: readonly string[];
}

/** Check one detail's envelope against a job. Every dimension reports, pass or fail. */
export function matchEnvelope(detail: StandardDetail, job: Job): EnvelopeMatch {
  const e = detail.envelope;
  const depth = Math.max(job.pool.profile.deepDepth, job.spa?.depthFt ?? 0);
  const { lengthFt, widthFt } = job.pool;

  const findings = [
    {
      dimension: 'Depth',
      limit: `${e.minDepthFt}–${e.maxDepthFt} ft`,
      actual: `${depth} ft`,
      ok: depth >= e.minDepthFt && depth <= e.maxDepthFt,
    },
    {
      dimension: 'Plan length',
      limit: `max ${e.maxLengthFt} ft`,
      actual: `${lengthFt} ft`,
      ok: lengthFt <= e.maxLengthFt,
    },
    {
      dimension: 'Plan width',
      limit: `max ${e.maxWidthFt} ft`,
      actual: `${widthFt} ft`,
      ok: widthFt <= e.maxWidthFt,
    },
  ];

  return {
    status: findings.every((f) => f.ok) ? 'in-envelope' : 'out-of-envelope',
    detail,
    findings,
    confirmations: [
      `Detail assumes: ${e.soilConditions}. Confirm the subsurface on this lot matches before the shell is shot.`,
    ],
  };
}

export type DetailSelection =
  | { readonly outcome: 'no-detail' }
  | { readonly outcome: 'selected'; readonly match: EnvelopeMatch }
  | {
      readonly outcome: 'out-of-envelope';
      /** Every stored detail and why each one does not cover this job. */
      readonly attempts: readonly EnvelopeMatch[];
    };

/**
 * Select by envelope match rather than asking. Where several details cover the
 * job, the one with the narrowest depth band wins — the tighter band is the more
 * specific detail.
 */
export function selectDetail(details: readonly StandardDetail[], job: Job): DetailSelection {
  if (details.length === 0) return { outcome: 'no-detail' };

  const attempts = details.map((d) => matchEnvelope(d, job));
  const matching = attempts.filter((m) => m.status === 'in-envelope');

  if (matching.length === 0) return { outcome: 'out-of-envelope', attempts };

  const best = [...matching].sort(
    (a, b) =>
      a.detail.envelope.maxDepthFt -
      a.detail.envelope.minDepthFt -
      (b.detail.envelope.maxDepthFt - b.detail.envelope.minDepthFt),
  )[0]!;

  return { outcome: 'selected', match: best };
}

/**
 * An ILLUSTRATIVE detail used by the tests and by the demo tab.
 *
 * THIS IS NOT A REAL DETAIL AND MUST NOT BE USED ON A JOB. It exists so the
 * quantity math can be exercised before a real detail is entered. The detail
 * store ships empty on purpose: no detail means no structural quantities.
 */
export const EXAMPLE_DETAIL: StandardDetail = {
  id: 'EXAMPLE-DO-NOT-BUILD',
  name: 'EXAMPLE detail — illustrative only, not a build document',
  versionDate: '0000-00-00 (placeholder)',
  envelope: {
    minDepthFt: 3,
    maxDepthFt: 7,
    maxLengthFt: 40,
    maxWidthFt: 20,
    soilConditions: 'PLACEHOLDER — no soil condition has been declared for this example',
  },
  shellThicknessIn: 6,
  barSize: '#4',
  barSpacingIn: 12,
  stressPointSpacingIn: 8,
  stressPointZoneFt: 2,
  bondBeamWidthIn: 12,
  bondBeamDepthIn: 12,
  bondBeamBarCount: 4,
  bondBeamBarSize: '#4',
  damWallThicknessIn: 6,
  coveLegIn: 6,
  gunitePsi: 4000,
  envelopeConfirmed: false,
  reboundAllowance: 0.15,
  barLapAllowanceFt: 1.5,
  stockBarLengthFt: 20,
  tieFraction: 1.0,
  piers: [],
};

/**
 * The Apex standard detail.
 *
 * SUPPLIED BY THE BUILDER: 6 in shell, 3/8 in (#3) bar, 12 in bond beam.
 * FILLED IN ON THEIR INSTRUCTION: everything else, listed in `assumedFields`.
 *
 * The assumed values follow the PRD's reference set — #3 at 12 in o.c. each way,
 * tighter spacing at coves and stress points, 4,000 psi gunite, rebound counted
 * separately from net — but they are assumptions, not statements, and the sheet
 * says so.
 *
 * The ENVELOPE has been confirmed by the builder: depth 3-8 ft, plan up to
 * 45 x 20 ft, loam over caliche. That is what makes the out-of-envelope refusal
 * mean something — it is a boundary someone agreed to, not a range the tool
 * invented.
 */
export const APEX_STANDARD_DETAIL: StandardDetail = {
  id: 'APEX-STD-01',
  name: 'Apex standard detail — 6 in shell, #3 at 12 in o.c.',
  versionDate: '2026-07-28 (assembled from builder input; envelope confirmed)',
  envelope: {
    minDepthFt: 3,
    maxDepthFt: 8,
    maxLengthFt: 45,
    maxWidthFt: 20,
    soilConditions:
      'Llano Estacado profile — loam over caliche, caliche within roughly 4 ft of grade, no collapsible fill.',
  },

  shellThicknessIn: 6,
  barSize: '#3',
  barSpacingIn: 12,
  stressPointSpacingIn: 8,
  stressPointZoneFt: 2,

  bondBeamWidthIn: 12,
  bondBeamDepthIn: 12,
  bondBeamBarCount: 4,
  bondBeamBarSize: '#4',

  damWallThicknessIn: 6,
  coveLegIn: 6,

  gunitePsi: 4000,
  reboundAllowance: 0.15,
  barLapAllowanceFt: 1.5,
  stockBarLengthFt: 20,
  tieFraction: 1.0,
  piers: [],

  envelopeConfirmed: true,
  suppliedFields: [
    'Shell thickness 6 in',
    'Bar size 3/8 in (#3)',
    'Bond beam 12 in',
    'Envelope: depth 3-8 ft, plan up to 45 x 20 ft, loam over caliche — confirmed',
    'Bond beam reinforcement 4 x #4 continuous',
  ],
  assumedFields: [
    'Bar spacing 12 in o.c. each way — the usual pairing with #3, and the PRD reference value',
    'Bond beam read as 12 in wide x 12 in deep',
    'Stress-point spacing 8 in over a 2 ft zone at coves and breakover',
    'Cove leg 6 in, dam wall 6 in',
    'Gunite 4,000 psi, rebound and overspray 15% counted as a separate line',
    'Lap and hook allowance 1.5 ft per bar, 20 ft stock, every intersection tied',
    'No pier schedule — piers are engineer scope and none was given',
  ],
};

/** The stored details this build knows. */
export const STORED_DETAILS: readonly StandardDetail[] = [APEX_STANDARD_DETAIL];
