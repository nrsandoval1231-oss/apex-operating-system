/**
 * City of Lubbock amendment checks.
 *
 * Governing code: 2021 ISPSC as adopted by Ordinance 2024-O0033 (3/26/2024),
 * amended by Code of Ordinances Article 28.18. Local amendments override base
 * ISPSC text where they conflict.
 *
 * PRD: "Every Lubbock amendment check runs on every job and reports pass, fail,
 * or the governing limit — never silently."
 */

import type { Job, Seat, StepSet } from './types.ts';

export const CODE_EDITION = '2021 ISPSC';
export const ORDINANCE = 'City of Lubbock Ord. 2024-O0033 (3/26/2024)';
export const AMENDMENT_ARTICLE = 'Code of Ordinances Art. 28.18';

export type CheckStatus = 'pass' | 'fail' | 'flag' | 'not-applicable';

export interface CodeCheck {
  readonly id: string;
  /** Code section as amended, e.g. "307.2.2.2 (Lubbock)". */
  readonly section: string;
  readonly title: string;
  readonly status: CheckStatus;
  /** What the code allows / requires, stated as a number where there is one. */
  readonly governingLimit: string;
  /** What the job actually has. */
  readonly actual: string;
  readonly message: string;
  /** Named compliance path when the check fails and one exists. */
  readonly compliancePath?: string;
  /** Subject of the check, e.g. the step set id. */
  readonly subject?: string;
}

const LUBBOCK = (s: string) => `${s} (Lubbock amendment, ${AMENDMENT_ARTICLE})`;

// --- 307.2.2.2 foundation setback ------------------------------------------

export interface SetbackResult {
  readonly check: CodeCheck;
  /** Maximum depth allowed by the 1:1 ratio at the entered setback. ft */
  readonly maxAllowableDepthFt: number;
  /** Minimum setback the entered depth would require. ft */
  readonly requiredSetbackFt: number;
}

/**
 * Local section 307.2.2.2: pool/spa depth maintains a 1:1 ratio to the nearest
 * building foundation or retaining wall footing. A 6 ft deep pool sits no closer
 * than 6 ft. Only way out is a sealed engineered design drawing.
 *
 * Hard fail. Never a checkbox that clears the flag.
 */
export function checkFoundationSetback(job: Job): SetbackResult {
  const setback = job.site.distanceToFoundationFt;
  const poolDepth = job.pool.profile.deepDepth;
  const spaDepth = job.spa ? job.spa.depthFt : 0;
  const governingDepth = Math.max(poolDepth, spaDepth);
  const deepest = governingDepth === spaDepth && spaDepth > poolDepth ? 'spa' : 'pool';

  const maxAllowableDepthFt = setback; // 1:1
  const requiredSetbackFt = governingDepth; // 1:1
  const pass = governingDepth <= setback;

  const check: CodeCheck = {
    id: 'lubbock.307.2.2.2',
    section: LUBBOCK('307.2.2.2'),
    title: 'Depth-to-foundation setback, 1:1 ratio',
    status: pass ? 'pass' : 'fail',
    governingLimit: `max depth ${fmt(maxAllowableDepthFt)} ft at ${fmt(setback)} ft setback (1:1)`,
    actual: `${fmt(governingDepth)} ft deep (${deepest}) at ${fmt(setback)} ft to ${job.site.foundationDescription}`,
    message: pass
      ? `Depth ${fmt(governingDepth)} ft is within the ${fmt(setback)} ft setback. Maximum compliant depth at this setback is ${fmt(maxAllowableDepthFt)} ft.`
      : `VIOLATION. Depth ${fmt(governingDepth)} ft exceeds the ${fmt(maxAllowableDepthFt)} ft allowed at a ${fmt(setback)} ft setback. Either reduce depth to ${fmt(maxAllowableDepthFt)} ft or move the water ${fmt(requiredSetbackFt - setback)} ft further from the ${job.site.foundationDescription} (required setback ${fmt(requiredSetbackFt)} ft).`,
    ...(pass
      ? {}
      : {
          compliancePath:
            'Sealed engineered design drawing submitted for approval. This is the only path closer than the 1:1 ratio, and it is the only place a PE seal is mandatory on a residential job in Lubbock.',
        }),
  };

  return { check, maxAllowableDepthFt, requiredSetbackFt };
}

// --- 411.2.1 / 411.2.2 steps ------------------------------------------------

export const MIN_TREAD_RUN_IN = 12;
export const MIN_TREAD_WIDTH_IN = 20;
export const MAX_RISER_IN = 10;

export function checkSteps(steps: readonly StepSet[]): CodeCheck[] {
  const checks: CodeCheck[] = [];

  if (steps.length === 0) {
    checks.push({
      id: 'lubbock.411.2.entry',
      section: LUBBOCK('411.2'),
      title: 'Means of entry and exit',
      status: 'fail',
      governingLimit: 'at least one compliant means of entry and exit',
      actual: 'no step set entered',
      message: 'No means of entry and exit is defined. A bench or swimout cannot serve this role (411.5.2).',
    });
    return checks;
  }

  for (const s of steps) {
    checks.push({
      id: `lubbock.411.2.1.run.${s.id}`,
      section: LUBBOCK('411.2.1'),
      title: 'Tread horizontal run',
      status: s.treadRunIn >= MIN_TREAD_RUN_IN ? 'pass' : 'fail',
      governingLimit: `min ${MIN_TREAD_RUN_IN} in`,
      actual: `${fmt(s.treadRunIn)} in`,
      message:
        s.treadRunIn >= MIN_TREAD_RUN_IN
          ? `Tread run ${fmt(s.treadRunIn)} in meets the ${MIN_TREAD_RUN_IN} in Lubbock minimum.`
          : `VIOLATION. Tread run ${fmt(s.treadRunIn)} in is under the ${MIN_TREAD_RUN_IN} in Lubbock minimum (base ISPSC value does not apply).`,
      subject: s.id,
    });

    checks.push({
      id: `lubbock.411.2.1.width.${s.id}`,
      section: LUBBOCK('411.2.1'),
      title: 'Tread width',
      status: s.treadWidthIn >= MIN_TREAD_WIDTH_IN ? 'pass' : 'fail',
      governingLimit: `min ${MIN_TREAD_WIDTH_IN} in`,
      actual: `${fmt(s.treadWidthIn)} in`,
      message:
        s.treadWidthIn >= MIN_TREAD_WIDTH_IN
          ? `Tread width ${fmt(s.treadWidthIn)} in meets the ${MIN_TREAD_WIDTH_IN} in Lubbock minimum.`
          : `VIOLATION. Tread width ${fmt(s.treadWidthIn)} in is under the ${MIN_TREAD_WIDTH_IN} in Lubbock minimum.`,
      subject: s.id,
    });

    checks.push(checkRisers(s));
  }

  return checks;
}

/**
 * Amended 411.2.2: risers maximum uniform 10". Bottom riser may taper to zero.
 * So: every riser above the bottom must be <= 10" and equal to each other; the
 * bottom riser may be anything from 0 up to that uniform height.
 */
function checkRisers(s: StepSet): CodeCheck {
  const risers = s.riserHeightsIn;
  if (risers.length === 0) {
    return {
      id: `lubbock.411.2.2.${s.id}`,
      section: LUBBOCK('411.2.2'),
      title: 'Riser height and uniformity',
      status: 'fail',
      governingLimit: `max uniform ${MAX_RISER_IN} in; bottom riser may taper to zero`,
      actual: 'no risers entered',
      message: 'No riser heights entered for this step set.',
      subject: s.id,
    };
  }

  const upper = risers.slice(1); // bottom riser is risers[0], allowed to taper
  const tallest = Math.max(...risers);
  const overMax = risers.filter((r) => r > MAX_RISER_IN);
  const uniformRef = upper[0];
  const nonUniform = upper.filter((r) => Math.abs(r - (uniformRef ?? r)) > 0.01);

  let status: CheckStatus = 'pass';
  let message = `Risers ${risers.map(fmt).join(' / ')} in (bottom first). Uniform at ${fmt(uniformRef ?? risers[0]!)} in with a tapered bottom riser — compliant.`;

  if (overMax.length > 0) {
    status = 'fail';
    message = `VIOLATION. Riser height ${fmt(tallest)} in exceeds the ${MAX_RISER_IN} in Lubbock maximum. Risers entered: ${risers.map(fmt).join(' / ')} in.`;
  } else if (nonUniform.length > 0) {
    status = 'fail';
    message = `VIOLATION. Risers above the bottom must be uniform. Entered: ${risers.map(fmt).join(' / ')} in. Only the bottom riser may taper.`;
  } else if ((risers[0] ?? 0) > (uniformRef ?? Infinity) + 0.01) {
    status = 'fail';
    message = `VIOLATION. Bottom riser ${fmt(risers[0]!)} in is taller than the uniform riser height ${fmt(uniformRef!)} in. The bottom riser may taper down, not up.`;
  }

  return {
    id: `lubbock.411.2.2.${s.id}`,
    section: LUBBOCK('411.2.2'),
    title: 'Riser height and uniformity',
    status,
    governingLimit: `max uniform ${MAX_RISER_IN} in; bottom riser may taper to zero`,
    actual: `${risers.map(fmt).join(' / ')} in (bottom first)`,
    message,
    subject: s.id,
  };
}

// --- 411.5.1 / 411.5.2 seats, benches, swimouts, tanning ledges -------------

export const MAX_SEAT_BELOW_WATERLINE_IN = 20;
export const MIN_BENCH_SURFACE_DEPTH_IN = 10;
export const MIN_BENCH_SURFACE_WIDTH_IN = 24;
export const MAX_TANNING_LEDGE_ENTRY_DEPTH_IN = 12;
export const MIN_CONTRAST_STRIPE_IN = 1;

export function checkSeats(seats: readonly Seat[]): CodeCheck[] {
  const checks: CodeCheck[] = [];

  for (const s of seats) {
    const section = s.kind === 'swimout' ? '411.5.1' : '411.5.2';

    // Depth below waterline. Tanning ledge used as entry/exit gets the 12" rule.
    const isLedgeEntry = s.kind === 'tanningLedge' && s.isRequiredEntryExit;
    const depthLimit = isLedgeEntry
      ? MAX_TANNING_LEDGE_ENTRY_DEPTH_IN
      : MAX_SEAT_BELOW_WATERLINE_IN;
    const depthOk = s.depthBelowWaterlineIn <= depthLimit && s.depthBelowWaterlineIn >= 0;

    checks.push({
      id: `lubbock.${section}.depth.${s.id}`,
      section: LUBBOCK(section),
      title: isLedgeEntry
        ? 'Tanning ledge used as entry/exit — depth below waterline'
        : 'Horizontal surface depth below waterline',
      status: depthOk ? 'pass' : 'fail',
      governingLimit: `max ${depthLimit} in below waterline, at or below the waterline`,
      actual: `${fmt(s.depthBelowWaterlineIn)} in below waterline`,
      message: depthOk
        ? `${label(s)} sits ${fmt(s.depthBelowWaterlineIn)} in below the waterline, within the ${depthLimit} in limit.`
        : `VIOLATION. ${label(s)} sits ${fmt(s.depthBelowWaterlineIn)} in below the waterline; limit is ${depthLimit} in.`,
      subject: s.id,
    });

    // Unobstructed surface dimensions.
    if (s.kind === 'bench') {
      const dimOk =
        s.surfaceDepthIn >= MIN_BENCH_SURFACE_DEPTH_IN &&
        s.surfaceWidthIn >= MIN_BENCH_SURFACE_WIDTH_IN;
      checks.push({
        id: `lubbock.411.5.2.surface.${s.id}`,
        section: LUBBOCK('411.5.2'),
        title: 'Unobstructed bench surface',
        status: dimOk ? 'pass' : 'fail',
        governingLimit: `min ${MIN_BENCH_SURFACE_DEPTH_IN} in deep x ${MIN_BENCH_SURFACE_WIDTH_IN} in wide`,
        actual: `${fmt(s.surfaceDepthIn)} in x ${fmt(s.surfaceWidthIn)} in`,
        message: dimOk
          ? `Bench surface ${fmt(s.surfaceDepthIn)} x ${fmt(s.surfaceWidthIn)} in meets the Lubbock minimum.`
          : `VIOLATION. Bench surface ${fmt(s.surfaceDepthIn)} x ${fmt(s.surfaceWidthIn)} in is under the ${MIN_BENCH_SURFACE_DEPTH_IN} x ${MIN_BENCH_SURFACE_WIDTH_IN} in minimum.`,
        subject: s.id,
      });

      // A bench cannot be the required entry/exit.
      checks.push({
        id: `lubbock.411.5.2.entry.${s.id}`,
        section: LUBBOCK('411.5.2'),
        title: 'Bench may not serve as required entry/exit',
        status: s.isRequiredEntryExit ? 'fail' : 'pass',
        governingLimit: 'bench cannot serve as the required means of entry and exit',
        actual: s.isRequiredEntryExit ? 'flagged as required entry/exit' : 'not the required entry/exit',
        message: s.isRequiredEntryExit
          ? `VIOLATION. Bench ${s.id} is flagged as the required means of entry and exit. 411.5.2 does not permit that — a compliant step set, ladder, or tanning ledge within 12 in of the waterline must provide it.`
          : `Bench ${s.id} is not serving as the required entry/exit.`,
        subject: s.id,
      });
    }

    if (s.kind === 'swimout') {
      // Amended 411.5.1: unobstructed surface at least equal to the top tread
      // requirement, i.e. the 411.2.1 tread minimums.
      const dimOk =
        s.surfaceDepthIn >= MIN_TREAD_RUN_IN && s.surfaceWidthIn >= MIN_TREAD_WIDTH_IN;
      checks.push({
        id: `lubbock.411.5.1.surface.${s.id}`,
        section: LUBBOCK('411.5.1'),
        title: 'Unobstructed swimout surface (top tread requirement)',
        status: dimOk ? 'pass' : 'fail',
        governingLimit: `min ${MIN_TREAD_RUN_IN} in deep x ${MIN_TREAD_WIDTH_IN} in wide (per 411.2.1 tread)`,
        actual: `${fmt(s.surfaceDepthIn)} in x ${fmt(s.surfaceWidthIn)} in`,
        message: dimOk
          ? `Swimout surface ${fmt(s.surfaceDepthIn)} x ${fmt(s.surfaceWidthIn)} in meets the top tread requirement.`
          : `VIOLATION. Swimout surface ${fmt(s.surfaceDepthIn)} x ${fmt(s.surfaceWidthIn)} in is under the top tread requirement of ${MIN_TREAD_RUN_IN} x ${MIN_TREAD_WIDTH_IN} in.`,
        subject: s.id,
      });

      if (s.isRequiredEntryExit) {
        checks.push({
          id: `lubbock.411.5.1.stair.${s.id}`,
          section: LUBBOCK('411.5.1'),
          title: 'Swimout used for entry/exit must meet stair requirements',
          status: 'flag',
          governingLimit: 'full 411.2.1 / 411.2.2 stair compliance',
          actual: 'swimout flagged as entry/exit',
          message: `Swimout ${s.id} is being used for entry and exit, so it must satisfy the step tread and riser rules in full. Enter it as a step set as well so those checks run.`,
          subject: s.id,
        });
      }
    }

    // Leading-edge contrasting, slip-resistant stripe. Quantity lands in finishes.
    checks.push({
      id: `lubbock.${section}.stripe.${s.id}`,
      section: LUBBOCK(section),
      title: 'Leading-edge contrasting slip-resistant stripe',
      status: s.leadingEdgeLengthFt > 0 ? 'pass' : 'fail',
      governingLimit: `min ${MIN_CONTRAST_STRIPE_IN} in contrasting, slip-resistant stripe on the leading edge`,
      actual: `${fmt(s.leadingEdgeLengthFt)} ft of leading edge`,
      message:
        s.leadingEdgeLengthFt > 0
          ? `${label(s)} requires ${fmt(s.leadingEdgeLengthFt)} LF of ${MIN_CONTRAST_STRIPE_IN} in minimum contrasting stripe. Carried to the finishes takeoff.`
          : `No leading-edge length entered for ${label(s)}; the required contrasting stripe cannot be quantified.`,
      subject: s.id,
    });
  }

  return checks;
}

/** Run every amendment check that applies to geometry. */
export function runGeometryCodeChecks(job: Job): CodeCheck[] {
  return [
    checkFoundationSetback(job).check,
    ...checkSteps(job.pool.steps),
    ...checkSeats(job.pool.seats),
  ];
}

export function hasFailure(checks: readonly CodeCheck[]): boolean {
  return checks.some((c) => c.status === 'fail');
}

function label(s: Seat): string {
  const kind =
    s.kind === 'tanningLedge' ? 'Tanning ledge' : s.kind === 'swimout' ? 'Swimout' : 'Bench';
  return `${kind} ${s.id}`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}
