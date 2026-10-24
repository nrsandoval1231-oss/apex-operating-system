/**
 * images.ts — the image manifest (D-20 / AC-9).
 *
 * Every image on the site is declared here, once, with a fixed aspect ratio and meaningful
 * alt text. Components render slots through <ImageSlot> and never hardcode an image.
 * Swapping in real photography is therefore a CONTENT change (fill `src`/`srcset` here) —
 * never a layout change (AC-9.1, AC-9.3).
 *
 * STOCK PLACEHOLDERS ARE IN PLACE. D-20 is still unresolved — there is no real Apex
 * photography. Every slot below is filled with a licensed stock photo (provenance and
 * licence in config/stock-images.json, fetched by `npm run stock:fetch`) so the site can be
 * reviewed with real imagery instead of grey boxes.
 *
 * Two rules follow from that, and they are the reason `stock: true` exists as a field:
 *
 *  1. **No alt text claims the work is Apex's.** A stock photo captioned "Completed Apex
 *     gunite pool" is a statement to a customer about work Apex did. The alt text below
 *     describes what each photograph actually shows, and nothing more. When a real Apex
 *     photo replaces one, the alt should be rewritten to say so — that is when the claim
 *     becomes true.
 *  2. **`stock: true` makes them impossible to forget.** `npm run preflight` warns for every
 *     stock slot still in place, so "we'll swap the photos before launch" cannot quietly
 *     become "we launched with stock photos of someone else's pools".
 *
 * `scripts/check-images.mjs` lists every slot whose `src` is still null (AC-9.4).
 */

/** Placeholder tone → procedural texture (defined in global.css as .tex-*). */
export type ImageTone = 'pool' | 'coat' | 'reno' | 'serv' | 'owner' | 'neutral';

export interface ImageSlot {
  /** Stable id — referenced by components and reported by the image check. */
  readonly id: string;
  /**
   * Meaningful alt text describing the intended photo (AC-9.2). Even while the slot is a
   * placeholder, this is the alt a real photo will inherit. Decorative-only images set
   * `decorative: true` instead and render empty alt.
   */
  readonly alt: string;
  /** Short label shown ON the placeholder so it reads as intentional, not broken (AC-9.4). */
  readonly label: string;
  /** Aspect ratio "W / H" — reserves space so there's no layout shift on real-photo swap. */
  readonly ratio: string;
  /** Placeholder texture tone. */
  readonly tone: ImageTone;
  /**
   * Real image path (in /public or an imported asset URL). `null` = unfilled placeholder.
   * Fill this (and optionally `srcset`) to ship a real photo — no component edit needed.
   */
  readonly src: string | null;
  /** Optional responsive srcset string, used only once `src` is set (AC-9.5). */
  readonly srcset?: string;
  /** Mark purely-decorative slots so they render empty alt (AC-9.2). */
  readonly decorative?: boolean;
  /**
   * True while this slot holds a licensed STOCK photo standing in for real Apex work.
   * Set it to false (or delete it) at the same moment you drop in a genuine photo — and
   * rewrite `alt` to describe the actual job. `npm run preflight` reports every slot still
   * flagged, so stock imagery cannot reach a live site unnoticed. See config/stock-images.json.
   */
  readonly stock?: boolean;
}

/**
 * All image slots, keyed by id. Ratios match the mockup's slot proportions, and each stock
 * file was cropped to exactly that ratio on download — so a real photo at the same ratio
 * swaps in with zero layout shift (AC-9.1).
 *
 * `label` is only rendered when a slot is EMPTY, so the labels below describe what real
 * photography should replace the stock with. They are the shot list.
 */
export const IMAGE_MANIFEST = {
  // Home router tiles (one per vertical)
  'tile-pools': {
    id: 'tile-pools',
    alt: 'An illuminated backyard swimming pool at night, seen from above',
    label: 'REPLACE · a completed Apex pool at twilight',
    ratio: '4 / 3',
    tone: 'pool',
    src: '/images/projects/apexdpv3-1200.webp',
    srcset: '/images/projects/apexdpv3-480.webp 480w, /images/projects/apexdpv3-800.webp 800w, /images/projects/apexdpv3-1200.webp 1200w',
  },
  'tile-coating': {
    id: 'tile-coating',
    alt: 'Sunlight reflecting off a polished concrete floor indoors',
    label: 'REPLACE · an Apex-coated garage floor',
    ratio: '4 / 3',
    tone: 'coat',
    src: '/images/projects/after-1-dt-1440.webp',
    srcset: '/images/projects/after-1-dt-480.webp 480w, /images/projects/after-1-dt-800.webp 800w, /images/projects/after-1-dt-1440.webp 1440w',
  },
  'tile-renovation': {
    id: 'tile-renovation',
    alt: 'A renovated kitchen with a stone island and white cabinetry',
    label: 'REPLACE · an Apex kitchen remodel',
    ratio: '4 / 3',
    tone: 'reno',
    src: '/images/projects/apex-dr-bathroom-1400.webp',
    srcset: '/images/projects/apex-dr-bathroom-480.webp 480w, /images/projects/apex-dr-bathroom-800.webp 800w, /images/projects/apex-dr-bathroom-1400.webp 1400w',
  },
  'tile-service': {
    id: 'tile-service',
    alt: 'A person cleaning a swimming pool with a long-handled pole',
    label: 'REPLACE · an Apex service tech on a route',
    ratio: '4 / 3',
    tone: 'serv',
    src: '/images/projects/apexdpv2-1200.webp',
    srcset: '/images/projects/apexdpv2-480.webp 480w, /images/projects/apexdpv2-800.webp 800w, /images/projects/apexdpv2-1200.webp 1200w',
    stock: true,
  },

  // Home Designer Pools section. Separate from the /pools hero so the two pages
  // are not the same photograph.
  'pools-home': {
    id: 'pools-home',
    alt: 'A dusk swimming pool with a raised spa, a stone fireplace, and water spouts beside a house',
    label: 'REPLACE · a completed Apex pool and spa at dusk',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/projects/apexdpv3-1200.webp',
    srcset: '/images/projects/apexdpv3-480.webp 480w, /images/projects/apexdpv3-800.webp 800w, /images/projects/apexdpv3-1200.webp 1200w',
  },

  // /pools hero. This is the LCP image on that page: VerticalHero loads it eagerly.
  'pools-hero': {
    id: 'pools-hero',
    alt: 'A villa pool at dusk with a vanishing edge, LED lights, and lounge chairs standing in the water',
    label: 'REPLACE · a completed Apex pool at dusk',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/projects/apexdpv3-1200.webp',
    srcset: '/images/projects/apexdpv3-480.webp 480w, /images/projects/apexdpv3-800.webp 800w, /images/projects/apexdpv3-1200.webp 1200w',
  },

  // Second photograph on /pools, beside the service list. The crop stops above
  // a logo that was on the back wall of the original frame.
  'pools-backyard': {
    id: 'pools-backyard',
    alt: 'A Texas backyard pool with a raised spa and a cedar pergola',
    label: 'REPLACE · an Apex backyard with a spa and pergola',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/projects/apexdpv4-1200.webp',
    srcset: '/images/projects/apexdpv4-480.webp 480w, /images/projects/apexdpv4-800.webp 800w, /images/projects/apexdpv4-1200.webp 1200w',
  },

  // Three shallow vertical cards
  'card-coating': {
    id: 'card-coating',
    alt: 'A large open interior with a polished concrete floor',
    label: 'REPLACE · an Apex polyaspartic install',
    ratio: '16 / 9',
    tone: 'coat',
    src: '/images/projects/after-1-dt-1440.webp',
    srcset: '/images/projects/after-1-dt-480.webp 480w, /images/projects/after-1-dt-800.webp 800w, /images/projects/after-1-dt-1440.webp 1440w',
  },
  'card-renovation': {
    id: 'card-renovation',
    alt: 'A kitchen with a wooden island and cabinetry beside a glass door',
    label: 'REPLACE · an Apex renovation in progress',
    ratio: '16 / 9',
    tone: 'reno',
    src: '/images/projects/apex-dr-bathroom-1400.webp',
    srcset: '/images/projects/apex-dr-bathroom-480.webp 480w, /images/projects/apex-dr-bathroom-800.webp 800w, /images/projects/apex-dr-bathroom-1400.webp 1400w',
  },
  'card-service': {
    id: 'card-service',
    alt: 'A person servicing the edge of a swimming pool',
    label: 'REPLACE · Apex servicing pump and filter equipment',
    ratio: '16 / 9',
    tone: 'serv',
    src: '/images/projects/apexdpv2-1200.webp',
    srcset: '/images/projects/apexdpv2-480.webp 480w, /images/projects/apexdpv2-800.webp 800w, /images/projects/apexdpv2-1200.webp 1200w',
  },

  /* =============================================================================
     HOMEPAGE V2 SLOTS.

     The V2 home page renders through the same manifest as the vertical pages — deliberately.
     This is the property that makes the page replaceable: when real Apex photography arrives,
     this PR's work is a content edit in this file and nothing else. No component, no CSS, and
     no aspect ratio changes, because every slot below already reserves its exact final box
     (AC-9.1) and every file was cropped to that ratio on the way in.

     ALL of these are still stock (D-20). `stock: true` is load-bearing, not cosmetic:
     tests/imagery.spec.ts asserts that no stock image's alt text contains "apex" or "travis",
     because a stock photo described as Apex's work is a claim to a customer about work Apex
     did. So the alts below describe what the photograph actually SHOWS and stop there. When a
     real photo replaces one, rewrite the alt at the same moment you drop the `stock` flag.

     `label` is the shot list for the photography workstream — it names the image that should
     replace the placeholder, and is only rendered when a slot is empty.
     ============================================================================= */

  // Section 01 — hero poster. The LCP image on the home page: loaded eager, fetchpriority
  // high, and the first thing a visitor should see. Playback (D-23) layers the approved master
  // on top of this same image. Reduced motion, save-data, and a failed play keep this still.
  // See components/home/HeroMedia.astro.
  //
  // This still is the approved aerial frame, 16:9, the same framing as the film. Poster and
  // video share object-fit: cover, so a 4:5 crop here would jump when playback started. The
  // whole frame is water, and the swimmer is centred, so a phone's cover crop stays on the
  // pool. Provenance: config/stock-images.json (`cinematic`). It is a Pexels still, not an
  // Apex project — `stock: true` stays until real project photography replaces it.
  'v2-hero-poster': {
    id: 'v2-hero-poster',
    alt: 'An aerial view of a swimmer moving through clear blue pool water',
    label: 'REPLACE · real Apex hero photography — this still is a Pexels swimmer, not an Apex project',
    ratio: '16 / 9',
    tone: 'pool',
    src: '/images/v2/v2-hero-poster-1120.jpg',
    srcset: '/images/v2/v2-hero-poster-560.jpg 560w, /images/v2/v2-hero-poster-1120.jpg 1120w',
    stock: true,
  },

  // Section 02 — craftsmanship. A tall detail crop and a wide one, read as a composition
  // rather than a grid.
  'v2-craft-detail': {
    id: 'v2-craft-detail',
    alt: 'Close view of tiled pool steps meeting the waterline, with light refracting across them',
    label: 'REPLACE · real tile, coping and waterline detail',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/v2/v2-craft-detail-960.jpg',
    srcset: '/images/v2/v2-craft-detail-480.jpg 480w, /images/v2/v2-craft-detail-960.jpg 960w',
    stock: true,
  },
  'v2-craft-wide': {
    id: 'v2-craft-wide',
    alt: 'A polished concrete surface catching a low band of sunlight across it',
    label: 'REPLACE · real finish and lighting detail',
    ratio: '3 / 2',
    tone: 'coat',
    src: '/images/v2/v2-craft-wide-1500.jpg',
    srcset: '/images/v2/v2-craft-wide-750.jpg 750w, /images/v2/v2-craft-wide-1500.jpg 1500w',
    stock: true,
  },

  // Section 03 — architectural showcase. Two environments, presented one at a time.
  'v2-showcase-1': {
    id: 'v2-showcase-1',
    alt: 'An illuminated pool with a raised spa and water spouts beside a house at dusk',
    label: 'REPLACE · a documented Apex project — name, location and features',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/v2/v2-showcase-1-1120.jpg',
    srcset: '/images/v2/v2-showcase-1-560.jpg 560w, /images/v2/v2-showcase-1-1120.jpg 1120w',
    stock: true,
  },
  'v2-showcase-2': {
    id: 'v2-showcase-2',
    alt: 'A backyard pool with a raised spa beside a timber pergola and planted lawn',
    label: 'REPLACE · a documented Apex project — name, location and features',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/v2/v2-showcase-2-1120.jpg',
    srcset: '/images/v2/v2-showcase-2-560.jpg 560w, /images/v2/v2-showcase-2-1120.jpg 1120w',
    stock: true,
  },

  // Section 04 — outdoor living.
  'v2-living': {
    id: 'v2-living',
    alt: 'A wide view of a pool terrace with seating and shade structure beside it',
    label: 'REPLACE · a complete outdoor environment, not a single feature',
    ratio: '16 / 9',
    tone: 'pool',
    src: '/images/v2/v2-living-1600.jpg',
    srcset: '/images/v2/v2-living-800.jpg 800w, /images/v2/v2-living-1600.jpg 1600w',
    stock: true,
  },

  // Section 07 — the closing shot behind the final CTA.
  'v2-close': {
    id: 'v2-close',
    alt: 'A pool and raised spa lit for the evening, seen across a low terrace wall',
    label: 'REPLACE · the closing lifestyle shot for the brand film',
    ratio: '16 / 9',
    tone: 'pool',
    src: '/images/v2/v2-close-1400.jpg',
    srcset: '/images/v2/v2-close-700.jpg 700w, /images/v2/v2-close-1400.jpg 1400w',
    stock: true,
  },

  /*
   * Owner section portrait — REAL, supplied by the maintainer. The first slot on this site to
   * hold genuine Apex photography rather than a stand-in, so the naming is now restored: it
   * was deliberately generic while a stock stranger occupied it, because naming a real person
   * as the subject of a photo that isn't them is a false claim about an identifiable
   * individual on his own company's website.
   *
   * The alt names Travis and stops there. A second person appears in the photograph and is not
   * identified — I can't verify who they are, and asserting a relationship ("his wife") would
   * be inventing a fact about a real person. If the maintainer confirms who it is and that
   * they're happy to appear, extend the alt then.
   *
   * Cropped from a 1080² original to exactly 4:3 with no upscaling, so it drops into the slot
   * with zero layout shift (AC-9.1).
   */
  'owner-portrait': {
    id: 'owner-portrait',
    alt: 'Travis Bouffard, founder of Apex',
    label: 'Travis — founder',
    ratio: '4 / 3',
    tone: 'owner',
    src: '/images/team/travis-960.jpg',
    srcset: '/images/team/travis-640.jpg 640w, /images/team/travis-960.jpg 960w',
  },
  'real-pool-hero': { id:'real-pool-hero', alt:'A completed backyard pool with a raised spa and patio seating', label:'Apex pool project', ratio:'16 / 9', tone:'pool', src:'/images/projects/apexdpv3-1200.webp', srcset:'/images/projects/apexdpv3-480.webp 480w, /images/projects/apexdpv3-800.webp 800w, /images/projects/apexdpv3-1200.webp 1200w' },
  'real-pool-work': { id:'real-pool-work', alt:'A completed backyard pool and raised spa', label:'Apex pool project', ratio:'4 / 3', tone:'pool', src:'/images/projects/apexdpv4-1200.webp', srcset:'/images/projects/apexdpv4-480.webp 480w, /images/projects/apexdpv4-800.webp 800w, /images/projects/apexdpv4-1200.webp 1200w' },
  'real-coating-work': { id:'real-coating-work', alt:'A finished concrete coating project', label:'Apex concrete coating project', ratio:'16 / 9', tone:'coat', src:'/images/projects/after-1-dt-1440.webp', srcset:'/images/projects/after-1-dt-480.webp 480w, /images/projects/after-1-dt-800.webp 800w, /images/projects/after-1-dt-1440.webp 1440w' },
  'real-renovation-work': { id:'real-renovation-work', alt:'A renovated bathroom with a double vanity', label:'Apex renovation project', ratio:'4 / 3', tone:'reno', src:'/images/projects/apex-dr-bathroom-1400.webp', srcset:'/images/projects/apex-dr-bathroom-480.webp 480w, /images/projects/apex-dr-bathroom-800.webp 800w, /images/projects/apex-dr-bathroom-1400.webp 1400w' },
  'real-pool-two': { id:'real-pool-two', alt:'A completed swimming pool project', label:'Apex pool project', ratio:'4 / 3', tone:'pool', src:'/images/projects/apexdpv2-1200.webp', srcset:'/images/projects/apexdpv2-480.webp 480w, /images/projects/apexdpv2-800.webp 800w, /images/projects/apexdpv2-1200.webp 1200w' },
  'real-pool-three': { id:'real-pool-three', alt:'A backyard pool with a curved edge and spa', label:'Apex pool project', ratio:'4 / 3', tone:'pool', src:'/images/projects/apexdpv5-1200.webp', srcset:'/images/projects/apexdpv5-480.webp 480w, /images/projects/apexdpv5-800.webp 800w, /images/projects/apexdpv5-1200.webp 1200w' },
  'real-coating-before': { id:'real-coating-before', alt:'Concrete floor before coating work', label:'Apex coating project before work', ratio:'16 / 9', tone:'coat', src:'/images/projects/before-1-dt-1440.webp', srcset:'/images/projects/before-1-dt-480.webp 480w, /images/projects/before-1-dt-800.webp 800w, /images/projects/before-1-dt-1440.webp 1440w' },
  'real-renovation-laundry': { id:'real-renovation-laundry', alt:'A renovated laundry room', label:'Apex renovation project', ratio:'4 / 3', tone:'reno', src:'/images/projects/apex-dr-laundryroom-1400.webp', srcset:'/images/projects/apex-dr-laundryroom-480.webp 480w, /images/projects/apex-dr-laundryroom-800.webp 800w, /images/projects/apex-dr-laundryroom-1400.webp 1400w' },
  'real-renovation-project': { id:'real-renovation-project', alt:'A home renovation project in progress', label:'Apex renovation project', ratio:'4 / 3', tone:'reno', src:'/images/projects/apexjob-r2-1-900.webp', srcset:'/images/projects/apexjob-r2-1-480.webp 480w, /images/projects/apexjob-r2-1-800.webp 800w, /images/projects/apexjob-r2-1-900.webp 900w' },
} as const satisfies Record<string, ImageSlot>;

/**
 * Slots still holding stock imagery rather than real Apex work (D-20).
 *
 * Widened to ImageSlot[] first: `as const` narrows each entry to its exact literal shape, so
 * once a slot drops the `stock` flag entirely — as owner-portrait did when the real photo of
 * Travis arrived — the property stops existing on part of the union and the filter no longer
 * type-checks. The optional `stock?` on ImageSlot is the intended contract.
 */
export const STOCK_SLOTS: readonly ImageSlot[] = (
  Object.values(IMAGE_MANIFEST) as readonly ImageSlot[]
).filter((slot) => slot.stock === true);

export type ImageSlotId = keyof typeof IMAGE_MANIFEST;

/** Look up a slot by id, throwing on an unknown id so typos fail loud at build. */
export function getImageSlot(id: ImageSlotId): ImageSlot {
  const slot = IMAGE_MANIFEST[id];
  if (!slot) throw new Error(`Unknown image slot: ${JSON.stringify(id)}`);
  return slot;
}

/** Every slot as an array — used by the build-time unfilled-slot check (AC-9.4). */
export const IMAGE_SLOTS: readonly ImageSlot[] = Object.values(IMAGE_MANIFEST);
