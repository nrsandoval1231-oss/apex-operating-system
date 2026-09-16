/**
 * Automatic cover — build order step 7.
 *
 * The cover is an INPUT THAT CONSTRAINS THE SHELL, not a downstream selection.
 * The bond beam drops at the mechanism end, the track layout has to be
 * rectangular, and vault dimensions come off the published spec sheet by cover
 * size — none of it derivable. Anything nonstandard needs distributor drawing
 * approval before the shell is shot.
 *
 * In Lubbock it carries extra weight. Amended 305.1 and 305.4 let a powered
 * safety cover listed to ASTM F1346 exempt the pool from barrier sections 305.2
 * through 305.7 for one- and two-family dwellings. So the cover is not an
 * accessory line item — it can be the code compliance path for the entire
 * barrier, and when it is, the listing is load-bearing on that decision.
 */

import { calc, inp, type Calc } from './calc.ts';
import type { CodeCheck } from './codeChecks.ts';
import type { CoverParams, Job } from './types.ts';

export type BarrierPath = 'cover-as-barrier' | 'barrier-sections' | 'non-compliant';

export interface CoverResult {
  readonly cover: CoverParams;
  readonly barrierPath: BarrierPath;
  readonly barrierPathLabel: string;
  readonly vaultVolume: Calc;
  readonly trackLf: Calc;
  readonly bondBeamDrop: Calc;
  readonly checks: readonly CodeCheck[];
  /** Constraints this cover puts on the shell, for the structure module. */
  readonly shellConstraints: readonly string[];
  readonly notes: readonly string[];
}

export function computeCover(job: Job): CoverResult | null {
  const c: CoverParams | undefined = job.cover;
  if (!c) return null;

  const checks: CodeCheck[] = [];
  const notes: string[] = [];
  const shellConstraints: string[] = [];

  // --- barrier compliance path ---------------------------------------------

  let barrierPath: BarrierPath;
  if (c.servesAsBarrier && c.astmF1346Listed) {
    barrierPath = 'cover-as-barrier';
    checks.push({
      id: 'lubbock.305.1.cover',
      section: '305.1 (Lubbock amendment, Code of Ordinances Art. 28.18)',
      title: 'Powered safety cover as the barrier compliance path',
      status: 'pass',
      governingLimit: 'powered safety cover listed to ASTM F1346, one- and two-family dwellings',
      actual: `${c.manufacturer} ${c.model}, listed to ASTM F1346`,
      message:
        'This job takes its barrier compliance from the cover. Sections 305.2 through 305.7 are exempted, and amended 305.4 means a listed cover also satisfies the structure-wall-as-barrier requirement. The ASTM F1346 listing is load-bearing on that: if the cover as installed is not listed, the pool has no barrier at all.',
    });
    notes.push(
      'Because the cover is the barrier, it is not an optional line item. Removing it from the job removes the barrier compliance path with it.',
    );
  } else if (c.servesAsBarrier && !c.astmF1346Listed) {
    barrierPath = 'non-compliant';
    checks.push({
      id: 'lubbock.305.1.cover',
      section: '305.1 (Lubbock amendment, Code of Ordinances Art. 28.18)',
      title: 'Powered safety cover as the barrier compliance path',
      status: 'fail',
      governingLimit: 'cover must be listed to ASTM F1346 to replace the barrier',
      actual: `${c.manufacturer} ${c.model}, no ASTM F1346 listing recorded`,
      message:
        'VIOLATION. This cover is flagged as the barrier compliance path but carries no ASTM F1346 listing. Without the listing the exemption in amended 305.1 does not apply and the pool has no barrier.',
      compliancePath:
        'Either install a cover listed to ASTM F1346, or provide a barrier meeting sections 305.2 through 305.7 in full.',
    });
  } else {
    barrierPath = 'barrier-sections';
    checks.push({
      id: 'lubbock.305.1.cover',
      section: '305.1 (Lubbock amendment, Code of Ordinances Art. 28.18)',
      title: 'Barrier compliance path',
      status: 'flag',
      governingLimit: 'barrier per sections 305.2 through 305.7',
      actual: 'cover is an accessory; barrier compliance is not taken from it',
      message:
        'The cover is not serving as the barrier on this job, so sections 305.2 through 305.7 apply in full. Barrier geometry is out of scope for v1 and is not checked here.',
    });
    notes.push(
      'Barrier sections 305.2 through 305.7 are not modelled in v1. If the intent is to take compliance from the cover instead, flag it on the cover input.',
    );
  }

  // --- geometry constraints -------------------------------------------------

  const poolL = job.pool.lengthFt;
  const poolW = job.pool.widthFt;

  const vaultSpansWidth = c.vaultWidthFt >= poolW;
  checks.push({
    id: 'cover.vault.width',
    section: `${c.manufacturer} ${c.model} spec sheet`,
    title: 'Vault spans the pool width',
    status: vaultSpansWidth ? 'pass' : 'fail',
    governingLimit: `vault at least ${poolW} ft wide`,
    actual: `${c.vaultWidthFt} ft`,
    message: vaultSpansWidth
      ? `Vault spans the ${poolW} ft width.`
      : `VIOLATION. The vault is ${c.vaultWidthFt} ft against a ${poolW} ft pool width. Vault size comes off the published spec sheet by cover size and cannot be trimmed to fit.`,
    ...(vaultSpansWidth ? {} : { compliancePath: 'Distributor drawing approval before the shell is shot.' }),
  });

  const trackCoversLength = c.trackLengthFt >= poolL;
  checks.push({
    id: 'cover.track.length',
    section: `${c.manufacturer} ${c.model} spec sheet`,
    title: 'Track runs the pool length',
    status: trackCoversLength ? 'pass' : 'flag',
    governingLimit: `track at least ${poolL} ft per side`,
    actual: `${c.trackLengthFt} ft per side`,
    message: trackCoversLength
      ? `Track runs the full ${poolL} ft.`
      : `Track is ${c.trackLengthFt} ft against a ${poolL} ft pool. Confirm against the spec sheet — a short track means the cover does not close over the whole water surface.`,
  });

  // Track layout has to be rectangular. v1 geometry is rectangular by scope, so
  // this passes by construction — it is stated rather than assumed, because the
  // day freeform geometry is added this check stops being automatic.
  checks.push({
    id: 'cover.track.rectangular',
    section: `${c.manufacturer} ${c.model} spec sheet`,
    title: 'Rectangular track layout',
    status: 'pass',
    governingLimit: 'track layout must be rectangular',
    actual: 'rectangular pool (v1 geometry scope)',
    message:
      'v1 models rectangular bodies only, so the track layout is rectangular by construction. Any freeform or radius geometry added later needs distributor drawing approval before the shell is shot.',
  });

  if (c.distributorApproval === false) {
    checks.push({
      id: 'cover.distributor',
      section: 'Manufacturer construction requirement',
      title: 'Distributor drawing approval',
      status: 'fail',
      governingLimit: 'nonstandard layouts approved by the distributor before the shell is built',
      actual: 'approval recorded as not obtained',
      message:
        'VIOLATION of the manufacturer construction requirement. A nonstandard layout without distributor approval is a shell that may not accept the cover once it is shot.',
    });
  }

  // --- quantities and shell constraints -------------------------------------

  const vaultVolume = calc({
    id: 'cover.vault.volume',
    label: 'Cover vault volume',
    formula: 'V = L_v x W_v x D_v',
    unit: 'cf',
    inputs: [
      inp('L_v', 'Vault length', c.vaultLengthFt, 'ft'),
      inp('W_v', 'Vault width', c.vaultWidthFt, 'ft'),
      inp('D_v', 'Vault depth', c.vaultDepthFt, 'ft'),
    ],
    compute: ({ L_v, W_v, D_v }) => L_v! * W_v! * D_v!,
    source: `${c.manufacturer} ${c.model} spec sheet, rev ${c.specRevisionDate}`,
    notes: ['Vault dimensions are read off the published spec sheet by cover size. They are not derivable and the tool does not compute them.'],
  });

  const trackLf = calc({
    id: 'cover.track.lf',
    label: 'Cover track',
    formula: 'LF = 2 x L_track',
    unit: 'lf',
    inputs: [inp('L_track', 'Track length per side', c.trackLengthFt, 'ft')],
    compute: ({ L_track }) => 2 * L_track!,
  });

  const bondBeamDrop = calc({
    id: 'cover.bondBeamDrop',
    label: 'Bond beam drop at the mechanism end',
    formula: 'd = per spec sheet',
    unit: 'in',
    inputs: [inp('d', 'Bond beam drop', c.bondBeamDropIn, 'in')],
    compute: ({ d }) => d!,
    source: `${c.manufacturer} ${c.model} spec sheet, rev ${c.specRevisionDate}`,
    notes: ['This drops the beam before the shell is shot. It is a shell constraint, not a finish detail.'],
  });

  shellConstraints.push(
    `Bond beam drops ${c.bondBeamDropIn} in at the mechanism end. The structure takeoff's bond beam section applies to the rest of the perimeter.`,
    `Vault ${c.vaultLengthFt} x ${c.vaultWidthFt} x ${c.vaultDepthFt} ft has to be formed with the shell, and its excavation is additional to the pool cut.`,
    'Track layout must be rectangular and is set before the shell is shot.',
  );

  notes.push(
    `Spec source: ${c.specSource}, rev ${c.specRevisionDate}. Cover spec sheets go stale — re-check the vault table against the current sheet before ordering.`,
  );
  notes.push(
    'The vault excavation above is not yet added to the excavation module’s cut volume; it is reported here as its own quantity.',
  );

  return {
    cover: c,
    barrierPath,
    barrierPathLabel:
      barrierPath === 'cover-as-barrier'
        ? 'Cover is the barrier (Lubbock amended 305.1, ASTM F1346)'
        : barrierPath === 'barrier-sections'
          ? 'Barrier per sections 305.2–305.7; cover is an accessory'
          : 'NO VALID BARRIER PATH',
    vaultVolume,
    trackLf,
    bondBeamDrop,
    checks,
    shellConstraints,
    notes,
  };
}
