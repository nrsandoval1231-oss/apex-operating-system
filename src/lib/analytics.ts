/**
 * analytics.ts — Phase 4 analytics config (GTM / GA4 / Meta pixel).
 *
 * Everything is env-driven (Hard rule 5 — no ids committed as literals) and, critically,
 * GATED ON THE BUILD ENVIRONMENT (Hard rule 6 / AC-1.7's sibling concern): a preview or
 * local build must not pollute the real GA4 property or fire real Meta conversions.
 *
 * Load rules:
 *   - PUBLIC_ENV=production            → tags load.
 *   - PUBLIC_ANALYTICS_FORCE=true      → tags load anywhere. Explicit opt-in, used to verify
 *                                        AC-5.5 (`lead_submit` reaching GTM) from a staging
 *                                        build. Never set this in a shared preview deploy.
 *   - otherwise                        → no tag loads at all.
 *
 * The dataLayer itself is ALWAYS initialised, in every environment. QuoteForm pushes
 * `lead_submit` unconditionally; with no container loaded the push is an inert array append,
 * which is what makes the event assertable in a test build without sending anything.
 *
 * NOTE (D-01): GTM-WSHKQ3X is Monsoon's container. Confirm the access transfer before
 * pointing a production build at it, or the events land in an account Apex can't read.
 */

import { isProduction } from './site';

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};

function envOrEmpty(key: string): string {
  const v = env[key];
  return v && v.trim() ? v.trim() : '';
}

/** Explicit override so analytics can be exercised from a non-production build on purpose. */
export const analyticsForced = envOrEmpty('PUBLIC_ANALYTICS_FORCE').toLowerCase() === 'true';

/** True when tag containers are allowed to load at all. */
export const analyticsEnabled = isProduction || analyticsForced;

export const analytics = {
  /** Google Tag Manager container, e.g. "GTM-XXXXXXX". Empty = do not load GTM. */
  gtmId: envOrEmpty('PUBLIC_GTM_ID'),
  /**
   * GA4 measurement id, e.g. "G-XXXXXXXXXX". Only used as a DIRECT gtag.js load when there
   * is no GTM container — if GTM is present, GA4 is configured inside it and loading both
   * would double-count every event.
   */
  ga4Id: envOrEmpty('PUBLIC_GA4_MEASUREMENT_ID'),
  /** Meta browser pixel. The server-side Conversions API lives in apex-lead-engine (D-05). */
  metaPixelId: envOrEmpty('PUBLIC_META_PIXEL_ID'),
} as const;

/** GTM owns the page when a container id is set. */
export const loadGtm = analyticsEnabled && analytics.gtmId !== '';

/** Direct GA4 only as the fallback when GTM is absent — never both (double-counting). */
export const loadGa4 = analyticsEnabled && !loadGtm && analytics.ga4Id !== '';

export const loadMetaPixel = analyticsEnabled && analytics.metaPixelId !== '';

/** True when a build is configured for analytics but no id was supplied — surfaced at build. */
export const analyticsMisconfigured =
  analyticsEnabled && !loadGtm && !loadGa4 && !loadMetaPixel;
