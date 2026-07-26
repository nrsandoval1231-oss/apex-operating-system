/**
 * site.ts — site-wide config read from PUBLIC_ env vars (see .env.example).
 *
 * Contact details are rendered in the header, footer, and CTAs and MUST come from env,
 * not be hardcoded in components. Values fall back to the current-site defaults from
 * .env.example so the build works before `.env` is filled. No secrets here — only
 * PUBLIC_ vars, which Astro exposes to the browser by design (Hard rule 5).
 */

/** Astro/Vite injects import.meta.env; type it loosely to read PUBLIC_ vars. */
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};

function envOr(key: string, fallback: string): string {
  const v = env[key];
  return v && v.trim() ? v.trim() : fallback;
}

export const site = {
  /** Canonical URL — BLOCKED on D-03; only used for absolute URLs in Phase 4. */
  url: envOr('PUBLIC_SITE_URL', 'https://apexgetsitdone.com'),
  /** "production" enables the live webhook; anything else is a non-prod build. */
  env: envOr('PUBLIC_ENV', 'development'),
  phoneDisplay: envOr('PUBLIC_PHONE_DISPLAY', '806.605.0502'),
  phoneE164: envOr('PUBLIC_PHONE_E164', '+18066050502'),
  contactEmail: envOr('PUBLIC_CONTACT_EMAIL', 'travis@apexgetsitdone.com'),
  city: 'Lubbock, TX',
} as const;

/** True when this is a real production build (gates live vs test webhook — Phase 3). */
export const isProduction = site.env === 'production';
