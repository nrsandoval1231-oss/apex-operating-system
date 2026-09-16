/**
 * attribution.ts — the attribution spine.
 *
 * Implements docs/data-contract.md "Attribution capture rules":
 *   1. Capture at FIRST TOUCH, persist for the session (sessionStorage). Later pageviews
 *      must NOT overwrite it (AC-1.5: landing_page survives navigation).
 *   2. Resolve source/medium by priority: explicit utm_source/utm_medium →
 *      else derive from referrer → else direct/none.
 *   4. landing_page = first path this session; page_submitted (captured later, at submit)
 *      = where the form was actually submitted.
 *
 * This module owns ONLY the persisted first-touch attribution set. The rest of the lead
 * object (vertical, contact fields, consent, page_submitted, device, timestamps, lead_id)
 * is assembled at submit time in Phase 3. Everything here is SSR-safe: functions that
 * touch the browser guard on `window` and no-op on the server.
 */

/** The first-touch attribution set persisted for the whole session. */
export interface Attribution {
  /** utm_source, else referrer-derived, else "direct". Never empty (AC-1.6). */
  source: string;
  /** utm_medium, else derived, else "none". Never empty (AC-1.6). */
  medium: string;
  /** utm_campaign if present, else "". Vertical-default fallback is applied at submit. */
  campaign: string;
  /** First path the visitor landed on this session, e.g. "/pools". */
  landing_page: string;
  /** document.referrer at first touch (may be ""). */
  referrer: string;
  /** fbclid from the URL at first touch, else "". */
  fbclid: string;
  /** gclid from the URL at first touch, else "". */
  gclid: string;
}

const STORAGE_KEY = 'apex_attribution';

/**
 * Resolve source/medium from utm params + referrer, per data-contract rule 2.
 * Exported so it can be unit-tested without a browser.
 *
 * @param utmSource explicit utm_source ("" if absent)
 * @param utmMedium explicit utm_medium ("" if absent)
 * @param referrer  document.referrer ("" if none)
 * @param hasFbclid whether an fbclid was present on the URL
 */
export function resolveSourceMedium(
  utmSource: string,
  utmMedium: string,
  referrer: string,
  hasFbclid: boolean,
): { source: string; medium: string } {
  // Priority 1: explicit UTM. If either is set, honour what's given and only fill the
  // missing half with a sensible default (an explicit utm_source with no medium is
  // treated as referral; an explicit medium with no source is treated as direct).
  if (utmSource || utmMedium) {
    return {
      source: utmSource || 'direct',
      medium: utmMedium || (utmSource ? 'referral' : 'none'),
    };
  }

  // Priority 2: derive from referrer.
  const host = referrerHost(referrer);
  if (host) {
    if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('l.facebook')) {
      // Facebook: paid if an fbclid rode along, else an organic/referral click.
      return { source: 'facebook', medium: hasFbclid ? 'paid' : 'referral' };
    }
    if (host.includes('google.')) {
      return { source: 'google', medium: 'organic' };
    }
    // Any other external referrer.
    return { source: host, medium: 'referral' };
  }

  // Priority 3: no utm, no referrer → direct.
  return { source: 'direct', medium: 'none' };
}

/** Extract a lowercased hostname from a referrer URL; "" if empty/unparseable. */
function referrerHost(referrer: string): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Compute the first-touch attribution from a URL + referrer. Pure — no storage, no
 * globals — so it is fully testable. `captureFirstTouch` wraps this with persistence.
 */
export function computeAttribution(url: URL, referrer: string): Attribution {
  const p = url.searchParams;
  const get = (k: string) => (p.get(k) ?? '').trim();

  const utmSource = get('utm_source');
  const utmMedium = get('utm_medium');
  const utmCampaign = get('utm_campaign');
  const fbclid = get('fbclid');
  const gclid = get('gclid');

  const { source, medium } = resolveSourceMedium(
    utmSource,
    utmMedium,
    referrer,
    fbclid.length > 0,
  );

  return {
    source,
    medium,
    campaign: utmCampaign, // "" when absent — vertical fallback applied at submit (Phase 3)
    landing_page: url.pathname || '/',
    referrer,
    fbclid,
    gclid,
  };
}

/** Read the persisted attribution, or null if none stored / unavailable. */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Capture first-touch attribution and persist it for the session.
 *
 * Idempotent by design: if attribution already exists for this session it is returned
 * UNCHANGED, so navigating between pages before submitting never overwrites the original
 * landing_page / source (AC-1.5). Safe to call on every page load.
 */
export function captureFirstTouch(): Attribution | null {
  if (typeof window === 'undefined') return null;

  const existing = getAttribution();
  if (existing) return existing;

  const attribution = computeAttribution(
    new URL(window.location.href),
    document.referrer || '',
  );

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // sessionStorage can throw (private mode, quota). Attribution still works for this
    // pageview via the returned object; it just won't survive navigation. Non-fatal.
  }

  return attribution;
}

/** Storage key — exported for tests and debugging. */
export const ATTRIBUTION_STORAGE_KEY = STORAGE_KEY;
