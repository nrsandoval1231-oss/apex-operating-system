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
    src: '/images/stock/tile-pools-1600.jpg',
    srcset: '/images/stock/tile-pools-800.jpg 800w, /images/stock/tile-pools-1600.jpg 1600w',
    stock: true,
  },
  'tile-coating': {
    id: 'tile-coating',
    alt: 'Sunlight reflecting off a polished concrete floor indoors',
    label: 'REPLACE · an Apex-coated garage floor',
    ratio: '4 / 3',
    tone: 'coat',
    src: '/images/stock/tile-coating-1600.jpg',
    srcset: '/images/stock/tile-coating-800.jpg 800w, /images/stock/tile-coating-1600.jpg 1600w',
    stock: true,
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
  'pools-hero': {
    id: 'pools-hero',
    alt: 'A lit swimming pool in the backyard of a home at night',
    label: 'REPLACE · a completed Apex pool + spa at dusk',
    ratio: '4 / 5',
    tone: 'pool',
    src: '/images/stock/pools-hero-1400.jpg',
    srcset: '/images/stock/pools-hero-800.jpg 800w, /images/stock/pools-hero-1400.jpg 1400w',
    stock: true,
  },

  // Three shallow vertical cards
  'card-coating': {
    id: 'card-coating',
    alt: 'A large open interior with a polished concrete floor',
    label: 'REPLACE · an Apex polyaspartic install',
    ratio: '16 / 9',
    tone: 'coat',
    src: '/images/stock/card-coating-1600.jpg',
    srcset: '/images/stock/card-coating-800.jpg 800w, /images/stock/card-coating-1600.jpg 1600w',
    stock: true,
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
   * Owner section portrait.
   *
   * The alt text here USED to read "Travis Bouffard, founder of Apex, on a job site". It no
   * longer does, and that is deliberate: the photo is a stock image of a stranger. Naming a
   * real person as the subject of a photograph that is not them is a materially different
   * claim from a generic pool photo — it is a false statement about an identifiable
   * individual, on his own company's website.
   *
   * When a real photo of Travis lands, restore the naming. Until then this stays generic.
   */
  'owner-portrait': {
    id: 'owner-portrait',
    alt: 'A contractor in a hard hat and work jacket on a job site',
    label: 'REPLACE · Travis on a job site — REAL portrait required',
    ratio: '4 / 3',
    tone: 'owner',
    src: '/images/stock/owner-portrait-1400.jpg',
    srcset:
      '/images/stock/owner-portrait-800.jpg 800w, /images/stock/owner-portrait-1400.jpg 1400w',
    stock: true,
  },
} as const satisfies Record<string, ImageSlot>;

/** Slots still holding stock imagery rather than real Apex work (D-20). */
export const STOCK_SLOTS: readonly ImageSlot[] = Object.values(IMAGE_MANIFEST).filter(
  (slot) => slot.stock === true,
);

export type ImageSlotId = keyof typeof IMAGE_MANIFEST;

/** Look up a slot by id, throwing on an unknown id so typos fail loud at build. */
export function getImageSlot(id: ImageSlotId): ImageSlot {
  const slot = IMAGE_MANIFEST[id];
  if (!slot) throw new Error(`Unknown image slot: ${JSON.stringify(id)}`);
  return slot;
}

/** Every slot as an array — used by the build-time unfilled-slot check (AC-9.4). */
export const IMAGE_SLOTS: readonly ImageSlot[] = Object.values(IMAGE_MANIFEST);
