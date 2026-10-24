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
  /**
   * Optional second photograph. Only Designer Pools has one today: the hero
   * stays the LCP image, and this one sits beside the service list, lazy.
   */
  readonly secondaryImage?: ImageSlotId;
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
    seoDescription: 'Explore designer pools and pool projects from Apex in Lubbock, Texas. Share your plans with the Apex team.',
    h1: 'Designer pools, made for your backyard.',
    eyebrow: 'Apex Designer Pools',
    lead: 'Thinking about a pool, spa, or a refresh of the space around it? Tell us what you have in mind and our Lubbock team will help you plan a next step.',
    image: 'real-pool-hero',
    secondaryImage: 'real-pool-work',
    proof: [{ value: '01', label: 'Start with a conversation' }],
    cta: 'Start my pool quote',
    faq: [
      { q:'What pool projects does Apex handle?', a:'Apex builds new pools and works on existing pools, including remodeling and repairs. Projects can also include a spa, pool house, pergola, outdoor kitchen, or hardscaping around the pool.' },
      { q:'Do I need permits or HOA approval?', a:'Requirements depend on the project and property. Ask about applicable City of Lubbock permits and any HOA approval during your first planning conversation, then confirm what applies to your address.' },
      { q:'Can Apex help with pool maintenance?', a:'Apex provides pool maintenance and cleaning, along with pump repair or replacement and pool repairs. Visit the pool maintenance page to get started.' },
      { q:'How do I learn about financing?', a:'Apex Designer Pools has a dealer page with Lyon Financial. Review its current information directly; terms depend on the financing provider.' },
    ],
  },

  'Concrete Coating': {
    vertical: 'Concrete Coating',
    seoTitle: 'Garage Floor & Concrete Coating in Lubbock, TX | Apex',
    seoDescription: 'Explore concrete coating projects from Apex in Lubbock, Texas. Share details about your floor or surface with our team.',
    h1: 'A better finish for your concrete.',
    eyebrow: 'Apex Concrete Coating',
    lead: 'A concrete surface can change how a garage, patio, or shop feels and works. Tell us about the space and what you want from it.',
    image: 'real-coating-work',
    proof: [{ value: '02', label: 'Start with a conversation' }],
    cta: 'Get a quote',
    faq: [
      { q:'Where can concrete coatings be used?', a:'Apex works on garage floors, patios, pool decks, shops, and commercial spaces. Concrete sealing and polishing are also available.' },
      { q:'How is a concrete coating project planned?', a:'Planning starts with the slab’s condition and how you use the space. Surface preparation and coating selection follow from those details.' },
      { q:'How should I care for the finished surface?', a:'Care instructions depend on the coating system. Your project handoff should include the guidance that applies to the surface and materials used.' },
      { q:'What warranty applies?', a:'Warranty terms can depend on the scope and product. Ask Apex to confirm the current written terms for your project before work begins.' },
    ],
  },

  'Design & Renovation': {
    vertical: 'Design & Renovation',
    seoTitle: 'Home Remodeling & Renovation in Lubbock, TX | Apex',
    seoDescription: 'Explore design and renovation work from Apex in Lubbock, Texas. Tell our team about the changes you are considering.',
    h1: 'Make your space work better.',
    eyebrow: 'Apex Design & Renovation',
    lead: 'Planning changes to your home? Start with the room, detail, or challenge you want to address and we’ll talk through your idea.',
    image: 'real-renovation-work',
    proof: [{ value: '03', label: 'Start with a conversation' }],
    cta: 'Plan my project',
    faq: [
      { q:'What renovation projects can Apex take on?', a:'Apex handles residential and commercial renovation work, including kitchens, bathrooms, additions, roofing, drywall, trim, painting, cabinetry, flooring, tile, fences, landscaping, and outdoor improvements.' },
      { q:'How should I prepare for a renovation conversation?', a:'Share the spaces you want to change, your priorities, and a budget range if you have one. Scope and material choices shape the planning discussion.' },
      { q:'Can I discuss a project budget?', a:'Yes. The quote request includes an optional budget field. Apex can discuss scope and next steps after learning more about the project.' },
    ],
  },

  'Pool Service': {
    vertical: 'Pool Service',
    seoTitle: 'Pool Service & Repair in Lubbock, TX | Apex Pool Service',
    seoDescription: 'Pool maintenance information and service request page for Apex customers in Lubbock, Texas.',
    h1: 'Pool maintenance in Lubbock.',
    eyebrow: 'Apex Pool Service',
    lead: 'For pool maintenance questions and service requests in Lubbock, contact the Apex team and describe what you need.',
    image: 'card-service',
    proof: [{ value: '04', label: 'Start with a conversation' }],
    cta: 'Get service',
    faq: [],
  },
};

/** Look up a vertical's page content, failing loud on an unknown vertical. */
export function getVerticalPage(vertical: Vertical): VerticalPage {
  const page = VERTICAL_PAGES[vertical];
  if (!page) throw new Error(`No vertical page content for: ${JSON.stringify(vertical)}`);
  return page;
}
