/**
 * images.ts — the image manifest (D-20 / AC-9).
 *
 * Per D-20 there is NO real photography yet, and shipping silently-blank slots is
 * forbidden. Every image on the site is declared here, once, with a fixed aspect ratio
 * and meaningful alt text. Components render slots through <ImageSlot> and never hardcode
 * an image. Swapping in real photography is therefore a CONTENT change (fill `src`/`srcset`
 * here) — never a layout change (AC-9.1, AC-9.3).
 *
 * `scripts/check-images.mjs` reads this file and lists every slot whose `src` is still
 * null, so no unfilled placeholder ships by accident (AC-9.4).
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
}

/**
 * All image slots, keyed by id. Ratios are chosen to match the mockup's slot proportions.
 * Every `src` is null until the D-20 photography decision resolves.
 */
export const IMAGE_MANIFEST = {
  // Home router tiles (one per vertical)
  'tile-pools': {
    id: 'tile-pools',
    alt: 'Completed Apex gunite pool at twilight with lit water feature',
    label: 'AI photo · twilight pool',
    ratio: '4 / 3',
    tone: 'pool',
    src: null,
  },
  'tile-coating': {
    id: 'tile-coating',
    alt: 'Freshly coated epoxy garage floor with a high-gloss finish',
    label: 'AI photo · garage floor',
    ratio: '4 / 3',
    tone: 'coat',
    src: null,
  },
  'tile-renovation': {
    id: 'tile-renovation',
    alt: 'Remodeled kitchen with new cabinetry and stone countertops',
    label: 'AI photo · kitchen remodel',
    ratio: '4 / 3',
    tone: 'reno',
    src: null,
  },
  'tile-service': {
    id: 'tile-service',
    alt: 'Apex pool-service technician testing water chemistry poolside',
    label: 'AI photo · service tech',
    ratio: '4 / 3',
    tone: 'serv',
    src: null,
  },

  // Pools deep section — hero image
  'pools-hero': {
    id: 'pools-hero',
    alt: 'Completed Apex pool and spa at dusk with a flagstone deck',
    label: 'AI photo · completed pool + spa at dusk, flagstone deck',
    ratio: '4 / 5',
    tone: 'pool',
    src: null,
  },

  // Three shallow vertical cards
  'card-coating': {
    id: 'card-coating',
    alt: 'Polyaspartic-coated garage floor, flake finish, single-day install',
    label: 'AI photo · epoxy garage',
    ratio: '16 / 9',
    tone: 'coat',
    src: null,
  },
  'card-renovation': {
    id: 'card-renovation',
    alt: 'Whole-home kitchen renovation in progress by the Apex crew',
    label: 'AI photo · kitchen remodel',
    ratio: '16 / 9',
    tone: 'reno',
    src: null,
  },
  'card-service': {
    id: 'card-service',
    alt: 'Technician servicing pool pump and filter equipment',
    label: 'AI photo · service tech',
    ratio: '16 / 9',
    tone: 'serv',
    src: null,
  },

  // Owner section portrait
  'owner-portrait': {
    id: 'owner-portrait',
    alt: 'Travis Bouffard, founder of Apex, on a job site',
    label: 'AI photo · Travis on a job site, portrait',
    ratio: '4 / 3',
    tone: 'owner',
    src: null,
  },
} as const satisfies Record<string, ImageSlot>;

export type ImageSlotId = keyof typeof IMAGE_MANIFEST;

/** Look up a slot by id, throwing on an unknown id so typos fail loud at build. */
export function getImageSlot(id: ImageSlotId): ImageSlot {
  const slot = IMAGE_MANIFEST[id];
  if (!slot) throw new Error(`Unknown image slot: ${JSON.stringify(id)}`);
  return slot;
}

/** Every slot as an array — used by the build-time unfilled-slot check (AC-9.4). */
export const IMAGE_SLOTS: readonly ImageSlot[] = Object.values(IMAGE_MANIFEST);
