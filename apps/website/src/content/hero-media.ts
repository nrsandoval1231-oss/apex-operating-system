/**
 * hero-media.ts — the hero's media contract.
 *
 * Homepage V2 renders this through one component (components/home/HeroMedia.astro). The rest
 * of the home page does not change when the film arrives.
 *
 *   poster    — a still image. What ships until the approved master is on disk. Zero
 *               bytes of hero JavaScript.
 *   playback  — that master, muted, inline, and looping, layered on the same poster.
 *
 * D-23 superseded D-22. There is no scroll-scrub mode. A scrub path that is accepted and
 * ignored would be a promise the code does not keep, and it is the mechanism Nick replaced
 * with video-first playback. See docs/cinematic-video-handoff.md.
 *
 * WHY THE FILE ON DISK DECIDES THE MODE
 * --------------------------------------
 * The approved master is the only source of truth. Resolving it while the site builds means
 * a deployment cannot request a film that has not been delivered. Drop
 * public/media/cinematic/apex-hero-family-master.mp4 in place and rebuild. Until that file
 * exists, `mode` stays `poster` and the markup contains no <video>.
 *
 * The poster slot stays the LCP image in both modes. Playback paints the film on top of an
 * image the browser is already fetching, so the film cannot regress that metric. Reduced
 * motion, save-data, and slow networks keep the still.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const mediaRoot = join(process.cwd(), 'public', 'media', 'cinematic');

/** Public URL for a delivered cinematic file, or null when it has not been approved yet. */
function file(name: string): string | null {
  return existsSync(join(mediaRoot, name)) ? `/media/cinematic/${name}` : null;
}

export type HeroMediaMode = 'poster' | 'playback';

export interface HeroFilmSource {
  /** The single continuous master clip, H.264, under /public. */
  readonly src: string;
  /** Smaller alternate encoding. Omitted from the markup when the file is absent. */
  readonly webm?: string;
  /** Portrait crop. Mobile stays on the poster until this file exists. */
  readonly mobile?: string;
  /** Still extracted from the master. The visible LCP image remains the poster slot. */
  readonly poster?: string;
  readonly mobilePoster?: string;
  readonly type: string;
}

export interface HeroMediaConfig {
  readonly mode: HeroMediaMode;
  /**
   * Image slot id for the poster (content/images.ts). Required in every mode: it is what the
   * visitor sees before any film loads, what LCP measures, and what reduced-motion and
   * save-data render. There is no state in which the hero has no image.
   */
  readonly poster: string;
  /** The master clip. Null until the approved file is in public/media/cinematic/. */
  readonly film: HeroFilmSource | null;
  /**
   * Object position for the still, as an X/Y percentage pair. The desktop crop keeps the
   * horizon high; the phone crop keeps the pool. Passed through as CSS custom properties.
   */
  readonly focal: { readonly desktop: string; readonly mobile: string };
}

const master = file('apex-hero-family-master.mp4');
const webm = file('apex-hero-family-master.webm');
const mobile = file('apex-hero-family-mobile.mp4');
const extractedPoster = file('apex-hero-family-poster.webp');
const extractedMobilePoster = file('apex-hero-family-mobile-poster.webp');

const film: HeroFilmSource | null = master
  ? {
      src: master,
      webm: webm ?? undefined,
      mobile: mobile ?? undefined,
      poster: extractedPoster ?? undefined,
      mobilePoster: extractedMobilePoster ?? undefined,
      type: 'video/mp4',
    }
  : null;

export const HERO_MEDIA: HeroMediaConfig = {
  mode: film ? 'playback' : 'poster',
  poster: 'v2-hero-poster',
  film,
  // The poster is 4:5, near-native to a phone, so a phone needs almost no crop and can sit on
  // the centre. Desktop covers a landscape viewport by trimming top and bottom, and the focal
  // point is nudged up so the trim keeps the house and the water rather than the foreground
  // paving. See the note on the slot in content/images.ts.
  focal: { desktop: '50% 46%', mobile: '50% 52%' },
};
