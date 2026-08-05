/**
 * Every job the switcher can open, in one place.
 *
 * These used to be split: the three Lubbock standards in the engine, and the
 * reference cases written inline in `App.tsx`. That split is why a broken
 * preset went unnoticed — the 20 x 40 inherited a deck sized to a different
 * pool and threw instead of opening, and no test could reach it because the
 * tests could only see half the list.
 *
 * One definition, imported by the app and by the test that opens all of them.
 * A scenario added here is covered by construction rather than by remembering.
 */

import { APEX_STANDARD_DETAIL, type StandardDetail } from '../standardDetail.ts';
import { STANDARD_MODEL } from '../standardModel.ts';
import { WHITAKER } from './whitaker.ts';
import { LUBBOCK_STANDARDS } from './lubbockStandards.ts';
import type { Job } from '../types.ts';

/** The standard model against a foundation too close for its depth. */
export const TIGHT_LOT: Job = {
  ...STANDARD_MODEL,
  name: 'Standard model on a tight lot — 5 ft to foundation',
  site: { distanceToFoundationFt: 5, foundationDescription: 'house slab foundation' },
};

/** Deeper than any stored detail's envelope covers. */
export const DEEP: Job = {
  ...STANDARD_MODEL,
  name: 'Deep job — 9 ft, outside the detail envelope',
  pool: {
    ...STANDARD_MODEL.pool,
    profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 9 },
  },
  site: { distanceToFoundationFt: 12, foundationDescription: 'house slab foundation' },
};

export interface Scenario {
  readonly tab: string;
  readonly job: Job;
  readonly details: readonly StandardDetail[];
  /**
   * 'standard' is a starting point for real work. 'reference' is an engine
   * fixture or a deliberate refusal case — kept because they are the only
   * visible proof that the refusal paths still refuse, and grouped separately
   * so they never read as somewhere to start a pool.
   */
  readonly group: 'standard' | 'reference';
}

export const SCENARIOS: readonly Scenario[] = [
  ...LUBBOCK_STANDARDS.map((standard) => ({
    tab: standard.label,
    job: standard.job,
    details: [APEX_STANDARD_DETAIL],
    group: 'standard' as const,
  })),
  { tab: 'Whitaker (built)', job: WHITAKER, details: [APEX_STANDARD_DETAIL], group: 'reference' },
  { tab: 'PRD standard model', job: STANDARD_MODEL, details: [APEX_STANDARD_DETAIL], group: 'reference' },
  { tab: 'Tight lot · 5 ft', job: TIGHT_LOT, details: [APEX_STANDARD_DETAIL], group: 'reference' },
  { tab: 'No detail stored', job: STANDARD_MODEL, details: [], group: 'reference' },
  { tab: 'Outside envelope', job: DEEP, details: [APEX_STANDARD_DETAIL], group: 'reference' },
];
