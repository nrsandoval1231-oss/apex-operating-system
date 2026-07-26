/**
 * pools.ts — deep content for the Designer Pools section (the highest-ticket vertical,
 * built "deep" per the PRD: process, features, warranty, financing, dedicated CTA).
 * Copy verbatim from the approved mockup (D-08).
 */

import type { Vertical } from './verticals';
import type { ImageSlotId } from './images';

export interface ProcessStep {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

export interface PoolsContent {
  readonly vertical: Vertical;
  readonly heading: string;
  readonly lead: string;
  readonly features: readonly string[];
  readonly process: readonly ProcessStep[];
  readonly warrantyBadge: string;
  readonly warrantyEmphasis: string;
  readonly financing: string;
  readonly cta: string;
  readonly image: ImageSlotId;
}

export const pools: PoolsContent = {
  vertical: 'Designer Pools',
  heading: 'Your backyard, built for West Texas ground.',
  lead: "We design and build gunite pools engineered for Lubbock's caliche and climate — then we're still here years later to keep them running. From the first dig to the first swim, one crew owns the whole build.",
  features: [
    'New gunite pool builds',
    'Spas & water features',
    'Automatic pool covers',
    'Outdoor kitchens & pergolas',
    'Near-pool hardscaping',
    'Plaster & pool remodels',
  ],
  process: [
    { n: '01', title: 'Design', body: '3D plan, real numbers, no mystery pricing.' },
    {
      n: '02',
      title: 'Engineer & Permit',
      body: 'Soil, structure, and permits handled for you.',
    },
    { n: '03', title: 'Build', body: 'One accountable crew, start to finish.' },
    { n: '04', title: 'Service', body: 'Startup, then ongoing care by the same team.' },
  ],
  warrantyBadge: '7-Year Pool',
  warrantyEmphasis: 'Warranty',
  financing: '// Financing available through Lyon Financial',
  cta: 'Start my pool quote',
  image: 'pools-hero',
};
