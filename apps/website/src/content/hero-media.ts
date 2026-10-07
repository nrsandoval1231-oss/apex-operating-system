/**
 * hero-media.ts — the hero's media contract.
 *
 * This is the single place that decides how the hero's background behaves. It exists so the
 * home page never has to be restructured when the Apex brand film is produced: the component
 * that renders the hero (components/home/HeroMedia.astro) reads this config, and the three
 * states below are three renderings of ONE component rather than three hero implementations.
 *
 *   1. POSTER   (shipped now)  — a still image. Zero bytes of JavaScript.
 *   2. PLAYBACK (future)       — one continuous approved video, autoplaying muted and looping.
 *   3. SCRUB    (future)       — the same video, driven by scroll position.
 *
 * TODAY ONLY `poster` is implemented. The other two are described here, and deliberately NOT
 * stubbed: a `mode` field that is accepted but ignored would be a promise the code doesn't keep,
 * and a half-built scrub path is the exact accumulated complexity Homepage V2 exists to remove
 * (see docs/homepage-v2.md § "What was retired").
 *
 * WHY ONE VIDEO AND NOT A FRAME SEQUENCE
 * --------------------------------------
 * docs/cinematic-homepage-vision.md (D-22) originally specified a canvas image-sequence with
 * scroll-mapped frames. That is still the right instinct for a scroll-scrubbed hero, but it
 * only works if the frames come from ONE approved source clip — frames generated independently
 * drift in face, wardrobe, pool geometry, lighting and camera position, which is precisely what
 * makes a synthetic sequence look synthetic. So the source of truth is `film.src`: a single
 * continuous master clip. If scrubbing is wanted later, frames are extracted DETERMINISTICALLY
 * from that same file by a build step, not authored. The film has to exist either way, so the
 * poster state is what ships in the meantime — and the page has to be excellent without it.
 *
 * TO PROMOTE TO VIDEO LATER — no component changes required:
 *
 *   heroFilm.src = '/film/apex-brand-film-1080p.mp4'
 *
 * with `mode: 'playback'`. HeroMedia renders a <video> with the same poster as its poster
 * attribute, so there is no flash of empty background and no LCP regression while the film
 * downloads: the poster is already the LCP element and keeps being the LCP element.
 */

export type HeroMediaMode = 'poster' | 'playback' | 'scrub';

export interface HeroFilmSource {
  /** Path to the single continuous master clip, relative to /public. */
  readonly src: string;
  /** Larger tier for wide viewports; falls back to `src` when absent. */
  readonly srcLarge?: string;
  readonly type: string;
}

export interface HeroMediaConfig {
  readonly mode: HeroMediaMode;
  /**
   * Image slot id for the poster (content/images.ts). Required in every mode: it is what the
   * visitor sees before any film loads, what LCP measures, and what the reduced-motion and
   * no-JS states render. There is no state in which the hero has no image.
   */
  readonly poster: string;
  /** The master clip. Null until the brand film is produced — which is the current state. */
  readonly film: HeroFilmSource | null;
  /**
   * Object position for the poster, as an X/Y percentage pair. Separate from CSS because it is
   * art direction, and the V2 art direction is explicitly per-viewport: the desktop crop wants
   * the horizon high, the phone crop wants to keep the pool rather than the sky above it.
   * Passed to CSS custom properties so this stays a content change.
   */
  readonly focal: { readonly desktop: string; readonly mobile: string };
}

export const HERO_MEDIA: HeroMediaConfig = {
  mode: 'poster',
  poster: 'v2-hero-poster',
  film: null,
  // The poster is 4:5, near-native to a phone, so a phone needs almost no crop and can sit on
  // the centre. Desktop covers a landscape viewport by trimming top and bottom, and the focal
  // point is nudged up so the trim keeps the house and the water rather than the foreground
  // paving. See the note on the slot in content/images.ts for why this is not a 16:9 source.
  focal: { desktop: '50% 46%', mobile: '50% 52%' },
};
