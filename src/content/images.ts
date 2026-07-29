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
  /* REAL Apex work, from the company's own hero footage. The alt text says so, because now
     it is true — see the note on stock alt text at the top of this file. */
  'tile-pools': {
    id: 'tile-pools',
    alt: 'An Apex-built pool at night, lit blue with sheer-descent water features and a fire bowl',
    label: 'Apex pool at night',
    ratio: '4 / 3',
    tone: 'pool',
    src: '/images/apex/tile-pools-800.jpg',
    srcset: '/images/apex/tile-pools-800.jpg 800w',
  },
  'tile-coating': {
    id: 'tile-coating',
    alt: 'A flake-coated concrete floor installed by Apex, with a car parked on the finish',
    label: 'Apex coated floor',
    ratio: '4 / 3',
    tone: 'coat',
    src: '/images/apex/tile-coating-800.jpg',
    srcset: '/images/apex/tile-coating-800.jpg 800w',
  },
  'tile-renovation': {
    id: 'tile-renovation',
    alt: 'A renovated kitchen with a stone island and white cabinetry',
    label: 'REPLACE · an Apex kitchen remodel',
    ratio: '4 / 3',
    tone: 'reno',
    src: '/images/stock/tile-renovation-1600.jpg',
    srcset:
      '/images/stock/tile-renovation-800.jpg 800w, /images/stock/tile-renovation-1600.jpg 1600w',
    stock: true,
  },
  'tile-service': {
    id: 'tile-service',
    alt: 'A person cleaning a swimming pool with a long-handled pole',
    label: 'REPLACE · an Apex service tech on a route',
    ratio: '4 / 3',
    tone: 'serv',
    src: '/images/stock/tile-service-1600.jpg',
    srcset: '/images/stock/tile-service-800.jpg 800w, /images/stock/tile-service-1600.jpg 1600w',
    stock: true,
  },

  // Pools deep section — hero image. The single highest-value photo on the site: Designer
  // Pools is the highest-ticket vertical, and this is the image that carries it.
  /*
   * REAL Apex work — but the one resolution-limited slot on the site, and worth knowing about.
   *
   * The source footage is 1280×720, and a 4:5 portrait crop out of it can only be 576×720.
   * That is roughly 1x for the size this renders at, so it is sharp enough on a standard
   * display and visibly soft on a retina one. It is a night shot with large dark areas, which
   * hides most of that.
   *
   * Kept anyway: a real photograph of an actual Apex pool beats a crisp stock photo of
   * someone else's for a local buyer who can tell the difference. A proper high-resolution
   * photo should still replace it — this is the top item on the D-20 shot list.
   */
  'pools-hero': {
    id: 'pools-hero',
    alt: 'A completed Apex pool at night, lit blue with sheer-descent water features and a fire bowl',
    label: 'REPLACE · a high-resolution photo of a completed Apex pool',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/apex/pools-hero-576.jpg',
    srcset: '/images/apex/pools-hero-576.jpg 576w',
  },

  // Three shallow vertical cards
  'card-coating': {
    id: 'card-coating',
    alt: 'A vintage car parked on a flake-coated concrete floor installed by Apex',
    label: 'Apex coated floor',
    ratio: '16 / 9',
    tone: 'coat',
    src: '/images/apex/card-coating-1280.jpg',
    srcset: '/images/apex/card-coating-800.jpg 800w, /images/apex/card-coating-1280.jpg 1280w',
  },
  'card-renovation': {
    id: 'card-renovation',
    alt: 'A kitchen with a wooden island and cabinetry beside a glass door',
    label: 'REPLACE · an Apex renovation in progress',
    ratio: '16 / 9',
    tone: 'reno',
    src: '/images/stock/card-renovation-1600.jpg',
    srcset:
      '/images/stock/card-renovation-800.jpg 800w, /images/stock/card-renovation-1600.jpg 1600w',
    stock: true,
  },
  'card-service': {
    id: 'card-service',
    alt: 'A person servicing the edge of a swimming pool',
    label: 'REPLACE · Apex servicing pump and filter equipment',
    ratio: '16 / 9',
    tone: 'serv',
    src: '/images/stock/card-service-1600.jpg',
    srcset: '/images/stock/card-service-800.jpg 800w, /images/stock/card-service-1600.jpg 1600w',
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
} as const satisfies Record<string, ImageSlot>;

/**
 * The hero background video — Apex's own footage (see scripts/extract-hero-frames.mjs).
 *
 * The POSTER is the real hero: a still of a completed Apex pool at night, painted
 * immediately and sufficient on its own. The video is an enhancement attached after load,
 * and only when it is worth the bytes — the gates live in HeroVideo.astro.
 */
export const heroVideo = {
  /*
   * The SERVED clip is a 5.6s seamless loop of the pool only — 593 KB, cut from the 15s
   * source in media/apex-hero-source.mp4 (which stays out of public/ so visitors never
   * fetch it). Two reasons it is trimmed rather than used whole:
   *
   *   · Content. The source runs pool → a jewellery storefront → coated floors. Behind a
   *     hero that says "Anything Construction", the storefront segment reads as a jewellery
   *     shop, and it is the brightest, busiest part of the clip. The pool is the highest-
   *     ticket vertical and the most arresting footage Apex has.
   *   · Coherence. The poster is the pool. Playing on into a storefront made the
   *     poster→video hand-off look like a mistake.
   *
   * The camera pans slightly, so a plain loop would visibly jump. The clip is boomeranged
   * (forward then reversed) which makes the loop seamless and costs nothing at runtime.
   */
  src: '/video/apex-hero-loop.mp4',
  poster: '/images/apex/hero-poster-1280.jpg',
  posterSrcset: '/images/apex/hero-poster-800.jpg 800w, /images/apex/hero-poster-1280.jpg 1280w',
  /** What the footage actually shows — so nobody has to open it to know. */
  shows: 'A completed Apex pool at night: lit water features and a fire bowl.',
} as const;

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
