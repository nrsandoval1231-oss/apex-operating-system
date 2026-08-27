/**
 * vertical-pages.ts — Phase 4 content for the four vertical landing pages
 * (/pools, /coating, /renovation, /service).
 *
 * WHY THESE PAGES EXIST. The mockup is a single page, and Phase 2 built it that way. Phase 4
 * needs per-vertical pages for three concrete reasons, not for aesthetics:
 *   - AC-5.2 requires a unique <title>/description/OG set *per vertical*, impossible on one URL.
 *   - AC-1.5 explicitly tests landing on `/pools` and navigating to `/` — the route must exist.
 *   - Paid traffic lands per-vertical; sending a Concrete Coating ad click to a page whose H1
 *     is about pools is the conversion leak this whole site was commissioned to fix.
 *
 * COPY PROVENANCE. D-08 says copy comes from the approved mockup. The mockup has no vertical
 * pages, so the headline/feature copy below is REUSED verbatim from the existing content files
 * (pools.ts, service-cards.ts) wherever it exists; only the SEO title/description, the search
 * intro, and the FAQ are new. Nothing here asserts a fact that isn't already established
 * elsewhere in the repo — every warranty number, financing partner, and turnaround claim
 * traces to site-copy.ts / pools.ts / service-cards.ts. Do not add a claim without a source.
 *
 * Keyed by the exact vertical enum (Hard rule 3). Content only — no layout.
 */

import type { Vertical } from './verticals';
import type { ImageSlotId } from './images';

export interface FaqEntry {
  readonly q: string;
  readonly a: string;
}

export interface VerticalPage {
  readonly vertical: Vertical;
  /** Unique <title> (AC-5.2). Keep the meaningful part under ~60 chars. */
  readonly seoTitle: string;
  /** Unique meta description (AC-5.2), ~150–160 chars. */
  readonly seoDescription: string;
  /** The page's single <h1> (AC-5.3). */
  readonly h1: string;
  /** Small caps line above the H1. */
  readonly eyebrow: string;
  /** Opening paragraph — the "what this is" for a visitor arriving cold from search or an ad. */
  readonly lead: string;
  /** Hero image slot for this page (image manifest — D-20 / AC-9). */
  readonly image: ImageSlotId;
  /** Three short proof points rendered as a stat strip. Values come from site-copy/pools. */
  readonly proof: readonly { readonly value: string; readonly label: string }[];
  /** Label on the page's primary CTA. Reused from the vertical's existing CTA where one exists. */
  readonly cta: string;
  /** Visible FAQ — also emitted as FAQPage JSON-LD. Google requires the two to match. */
  readonly faq: readonly FaqEntry[];
}

export const VERTICAL_PAGES: Readonly<Record<Vertical, VerticalPage>> = {
  'Designer Pools': {
    vertical: 'Designer Pools',
    seoTitle: 'Pool Builder in Lubbock, TX | Apex Designer Pools',
    seoDescription:
      'Gunite pool design and construction engineered for Lubbock caliche, backed by a 7-year ' +
      'warranty and serviced by the same crew that built it. Get a quote from Apex.',
    h1: 'Pool builders for Lubbock and the South Plains.',
    eyebrow: 'Apex Designer Pools',
    lead:
      "We design and build gunite pools engineered for Lubbock's caliche and climate — then " +
      "we're still here years later to keep them running. From the first dig to the first " +
      'swim, one crew owns the whole build.',
    image: 'pools-hero',
    proof: [
      { value: '7-Yr', label: 'Pool build warranty' },
      { value: '48-Hr', label: 'Warranty response' },
      { value: '1', label: 'Accountable crew, start to finish' },
    ],
    cta: 'Start my pool quote',
    faq: [
      {
        q: 'Do you build pools for Lubbock soil?',
        a:
          'Yes — that is the whole point of how we engineer them. Lubbock sits on caliche, ' +
          'which behaves very differently from the soils most pool plans are drawn for. Soil, ' +
          'structure, and permitting are handled as their own step in our process before ' +
          'anyone breaks ground.',
      },
      {
        q: 'What does the 7-year pool warranty cover, and how fast do you respond?',
        a:
          'New Apex pool builds carry a 7-year warranty, and we guarantee a 48-hour response ' +
          'on warranty calls. Warranty work is prioritized over new jobs — if something we ' +
          'built has a problem, it goes to the front of the line.',
      },
      {
        q: 'Do you offer financing?',
        a: 'Yes. Pool financing is available through Lyon Financial.',
      },
      {
        q: 'Do you service the pool after you build it?',
        a:
          'Yes. Startup and ongoing care are handled by the same team that built the pool — ' +
          'weekly cleaning and chemistry, pump and filter repair, equipment upgrades, and ' +
          'openings and closings. You are not handed off to a stranger after the build.',
      },
      {
        q: 'What else can you build around the pool?',
        a:
          'Spas and water features, automatic pool covers, outdoor kitchens and pergolas, ' +
          'and near-pool hardscaping. We also do plaster work and full pool remodels on ' +
          'existing pools we did not build.',
      },
    ],
  },

  'Concrete Coating': {
    vertical: 'Concrete Coating',
    seoTitle: 'Garage Floor & Concrete Coating in Lubbock, TX | Apex',
    seoDescription:
      'Polyaspartic and epoxy floor coatings for Lubbock garages, patios, pool decks, and ' +
      'shops. Most installed in a single day and backed by a 30-year warranty.',
    h1: 'Concrete coatings for Lubbock garages, patios, and shops.',
    eyebrow: 'Apex Concrete Coating',
    lead:
      'Polyaspartic and epoxy systems for garages, patios, pool decks, and shops — most ' +
      'installed in a single day, backed for decades.',
    image: 'card-coating',
    proof: [
      { value: '30-Yr', label: 'Coating warranty' },
      { value: '1-Day', label: 'Typical install' },
      { value: '48-Hr', label: 'Warranty response' },
    ],
    cta: 'Get a quote',
    faq: [
      {
        q: 'How long does a garage floor coating take?',
        a:
          'Most residential installs are done in a single day. Polyaspartic cures fast enough ' +
          'to walk on the same day, which is the main reason we use it over standard epoxy in ' +
          'West Texas heat.',
      },
      {
        q: 'What is the warranty?',
        a:
          'Apex concrete coatings carry a 30-year warranty, with a guaranteed 48-hour response ' +
          'on warranty calls.',
      },
      {
        q: 'What surfaces can you coat?',
        a:
          'Garages and shops, patios and pool decks, and commercial floors. We also do sealing ' +
          'and polishing on concrete that does not need a full coating system.',
      },
      {
        q: 'Do you coat commercial floors?',
        a:
          'Yes — shop and commercial floors are a regular part of the work, not an exception. ' +
          'Tell us the square footage and the traffic the floor takes and we will quote it.',
      },
    ],
  },

  'Design & Renovation': {
    vertical: 'Design & Renovation',
    seoTitle: 'Home Remodeling & Renovation in Lubbock, TX | Apex',
    seoDescription:
      'Kitchens, baths, additions, roofing, and flooring across Lubbock and the South Plains — ' +
      'one accountable contractor for the whole project instead of five you have to chase.',
    h1: 'Home renovation in Lubbock, under one contractor.',
    eyebrow: 'Apex Design & Renovation',
    lead:
      'Kitchens, baths, additions, roofing, and everything between — one accountable ' +
      'contractor instead of five you have to chase.',
    image: 'card-renovation',
    proof: [
      { value: 'One', label: 'Contractor, whole project' },
      { value: '48-Hr', label: 'Warranty response' },
      { value: '4', label: 'In-house crews' },
    ],
    cta: 'Plan my project',
    faq: [
      {
        q: 'What kinds of renovation do you take on?',
        a:
          'Kitchen and bath remodels, home additions, roofing and gutters, and flooring, tile, ' +
          'and trim. If a project touches several of those at once, that is the case we are ' +
          'built for.',
      },
      {
        q: 'Do I have to manage multiple subcontractors?',
        a:
          'No. That is the reason this vertical exists. Apex is the single accountable ' +
          'contractor for the project — you have one number to call rather than chasing five ' +
          'trades who each blame the last one.',
      },
      {
        q: 'Do you take over a job another contractor left unfinished?',
        a:
          'Yes, and we have. One of our customers came to us after two previous contractors ' +
          'failed on the same house. Tell us honestly where the project stands and we will ' +
          'tell you honestly what it takes to finish it.',
      },
      {
        q: 'Do you work outside Lubbock?',
        a:
          'Yes — Lubbock and the surrounding South Plains, including Wolfforth, Shallowater, ' +
          'Idalou, Slaton, Levelland, and Ransom Canyon.',
      },
    ],
  },

  'Pool Service': {
    vertical: 'Pool Service',
    seoTitle: 'Pool Service & Repair in Lubbock, TX | Apex Pool Service',
    seoDescription:
      'Weekly pool cleaning, chemistry, pump and filter repair, and equipment upgrades in ' +
      'Lubbock — from the same team that builds the pools. 48-hour response.',
    h1: 'Pool service and repair in Lubbock.',
    eyebrow: 'Apex Pool Service',
    lead:
      'Weekly maintenance, repairs, and equipment swaps from the same team that builds pools. ' +
      'Green water or a dead pump — we answer fast.',
    image: 'card-service',
    proof: [
      { value: '48-Hr', label: 'Response' },
      { value: 'Weekly', label: 'Cleaning & chemistry' },
      { value: 'Same', label: 'Crew that builds them' },
    ],
    cta: 'Get service',
    faq: [
      {
        q: 'What does weekly pool service include?',
        a:
          'Cleaning and water chemistry on a weekly schedule. Repairs, equipment upgrades, and ' +
          'seasonal openings and closings are handled by the same crew as needed.',
      },
      {
        q: 'How fast do you respond to a repair call?',
        a:
          'We hold a 48-hour response standard. Green water and a dead pump are both problems ' +
          'that get worse the longer they sit, so they do not wait for a routing queue.',
      },
      {
        q: 'Do you service pools Apex did not build?',
        a:
          'Yes. We service pools regardless of who built them — pumps, filters, equipment ' +
          'swaps, and ongoing maintenance.',
      },
      {
        q: 'Can you replace old pool equipment?',
        a:
          'Yes. Pump and filter repair and full equipment upgrades are part of the service ' +
          'work, and the crew doing it is the same one that installs equipment on new builds.',
      },
    ],
  },
};

/** Look up a vertical's page content, failing loud on an unknown vertical. */
export function getVerticalPage(vertical: Vertical): VerticalPage {
  const page = VERTICAL_PAGES[vertical];
  if (!page) throw new Error(`No vertical page content for: ${JSON.stringify(vertical)}`);
  return page;
}
