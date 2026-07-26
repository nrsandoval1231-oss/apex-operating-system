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
  /**
   * Lead intake webhooks (apex-lead-engine). Defaults point at Apex's live n8n instance;
   * override via env. The intake workflow must be active + its Airtable base configured for
   * these to succeed (D-21).
   */
  leadWebhookProd: envOr(
    'PUBLIC_LEAD_WEBHOOK_URL',
    'https://n8n.srv1758862.hstgr.cloud/webhook/apex-lead-intake',
  ),
  leadWebhookTest: envOr(
    'PUBLIC_LEAD_WEBHOOK_URL_TEST',
    'https://n8n.srv1758862.hstgr.cloud/webhook-test/apex-lead-intake',
  ),
} as const;

/** True when this is a real production build (gates live vs test webhook — Phase 3). */
export const isProduction = site.env === 'production';

/**
 * The webhook the quote form POSTs to. Hard rule 6 / AC-1.7: non-production builds MUST
 * target the test endpoint — never production. Only a build with PUBLIC_ENV=production uses
 * the live webhook.
 */
export const leadWebhookUrl = isProduction ? site.leadWebhookProd : site.leadWebhookTest;
