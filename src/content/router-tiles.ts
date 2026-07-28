/**
 * router-tiles.ts — content for the four home-page router tiles.
 *
 * The tiles are the site's primary job: route a visitor to the right vertical. One tile
 * per vertical, keyed by the enum (imported from verticals.ts — never a raw string), in
 * enum order (AC-2.1). Copy/subtitles are content data; the accent colour and consent
 * brand come from verticals.ts.
 */

import type { Vertical } from './verticals';
import type { ImageSlotId } from './images';

export interface RouterTile {
  readonly vertical: Vertical;
  /** Small caps subtitle under the tile title, e.g. "Build · Remodel · Feature". */
  readonly subtitle: string;
  /*
   * NOTE — there is deliberately no `href` field. Phase 4 gave every vertical its own landing
   * page, and a tile's destination is now derived in Hero.astro as `/${cfg.slug}` from
   * verticals.ts. Storing the URL here would be a second list to keep in sync with the slugs,
   * and its failure mode — a tile silently pointing at the wrong vertical — is exactly the
   * routing bug this site exists to eliminate.
   */
  /** Call-to-action label on the tile. */
  readonly cta: string;
  /** Image manifest slot rendered behind the tile. */
  readonly image: ImageSlotId;
}

/** Keyed by vertical; rendered in verticals.ts VERTICAL_LIST order. */
export const ROUTER_TILES: Readonly<Record<Vertical, RouterTile>> = {
  'Designer Pools': {
    vertical: 'Designer Pools',
    subtitle: 'Build · Remodel · Feature',
    cta: 'Explore',
    image: 'tile-pools',
  },
  'Concrete Coating': {
    vertical: 'Concrete Coating',
    subtitle: 'Garages · Patios · Shops',
    cta: 'Explore',
    image: 'tile-coating',
  },
  'Design & Renovation': {
    vertical: 'Design & Renovation',
    subtitle: 'Kitchen · Bath · Additions',
    cta: 'Explore',
    image: 'tile-renovation',
  },
  'Pool Service': {
    vertical: 'Pool Service',
    subtitle: 'Clean · Repair · Maintain',
    cta: 'Explore',
    image: 'tile-service',
  },
};
