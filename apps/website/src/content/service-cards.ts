/**
 * service-cards.ts — the three "shallow" verticals (Concrete Coating, Design &
 * Renovation, Pool Service): one card each. Copy verbatim from the approved mockup (D-08).
 * Keyed to the enum via `vertical`; ordered as they appear after Designer Pools.
 */

import type { Vertical } from './verticals';
import type { ImageSlotId } from './images';

export interface ServiceCard {
  readonly vertical: Vertical;
  readonly heading: string;
  readonly description: string;
  readonly services: readonly string[];
  /** Small mono badge, e.g. "30-Yr Warranty". */
  readonly minibadge: string;
  /** CTA link label, e.g. "Get a quote". */
  readonly cta: string;
  readonly image: ImageSlotId;
}

export const serviceCards: readonly ServiceCard[] = [
  {
    vertical: 'Concrete Coating',
    heading: 'Floors that outlast the house.',
    description:
      'Polyaspartic and epoxy systems for garages, patios, pool decks, and shops — most installed in a single day, backed for decades.',
    services: [
      'Garages & shops',
      'Patios & pool decks',
      'Commercial floors',
      'Sealing & polishing',
    ],
    minibadge: '30-Yr Warranty',
    cta: 'Get a quote',
    image: 'card-coating',
  },
  {
    vertical: 'Design & Renovation',
    heading: 'Whole-home work, done right the first time.',
    description:
      'Kitchens, baths, additions, roofing, and everything between — one accountable contractor instead of five you have to chase.',
    services: [
      'Kitchen & bath remodels',
      'Home additions',
      'Roofing & gutters',
      'Flooring, tile & trim',
    ],
    minibadge: 'One Contractor',
    cta: 'Plan my project',
    image: 'card-renovation',
  },
  {
    vertical: 'Pool Service',
    heading: "We built it. We'll keep it running.",
    description:
      'Weekly maintenance, repairs, and equipment swaps from the same team that builds pools. Green water or a dead pump — we answer fast.',
    services: [
      'Weekly cleaning & chemistry',
      'Pump & filter repair',
      'Equipment upgrades',
      'Openings & closings',
    ],
    minibadge: '48-Hr Response',
    cta: 'Get service',
    image: 'card-service',
  },
];
