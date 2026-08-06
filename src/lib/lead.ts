/**
 * lead.ts — assembles the lead object the quote form POSTs (Phase 3).
 *
 * This is the payload half of the spine: it takes the form input + the persisted first-touch
 * attribution + the vertical config and produces EXACTLY the JSON in docs/data-contract.md
 * (AC-1.1). Pure and framework-free so it can be unit-tested without a browser. The form
 * (QuoteForm.tsx) owns lead_id generation (once, never regenerated — AC-1.3) and the POST.
 */
import type { Attribution } from './attribution';
import { getVerticalConfig, type Vertical } from '@content/verticals';

/** The exact lead object sent to the webhook. Field order/types per data-contract.md. */
export interface LeadPayload {
  lead_id: string;
  vertical: Vertical;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  consent_sms: boolean;
  consent_text: string;
  source: string;
  medium: string;
  campaign: string;
  landing_page: string;
  referrer: string;
  fbclid: string;
  gclid: string;
  page_submitted: string;
  device: 'mobile' | 'tablet' | 'desktop';
  submitted_at: string;
}

export type DeviceType = LeadPayload['device'];

/**
 * The verbatim SMS consent disclosure for a vertical (D-06 / AC-3). The brand name is the
 * selected vertical's consent brand — never hardcoded (AC-3.4). This exact string is shown to
 * the user AND captured in `consent_text` (AC-3.3), so the two can never drift.
 */
export function buildConsentText(vertical: Vertical): string {
  const { consentBrand } = getVerticalConfig(vertical);
  return `I agree to receive text messages from ${consentBrand} about my quote. ~2 msgs/month, data rates may apply. Reply STOP to opt out.`;
}

/** Normalize a phone to digits only (AC-4.3) — what the payload carries. */
export function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

/** Classify the device by width + UA. Coarse but enough for the `device` field. */
export function detectDevice(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const w = window.innerWidth || 1024;
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua) || (w >= 600 && w <= 1024)) return 'tablet';
  if (/Mobi|iPhone|Android.*Mobile/i.test(ua) || w < 600) return 'mobile';
  return 'desktop';
}

/** ISO 8601 timestamp WITH the local timezone offset (e.g. 2026-07-25T14:32:11-05:00). */
export function isoWithOffset(date: Date = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -date.getTimezoneOffset(); // minutes east of UTC
  const sign = off >= 0 ? '+' : '-';
  const hh = pad(Math.trunc(off / 60));
  const mm = pad(off % 60);
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${hh}:${mm}`;
}

/** Default attribution when none was captured — never empty strings that break downstream (AC-1.6). */
export function emptyAttribution(landingPath: string): Attribution {
  return {
    source: 'direct',
    medium: 'none',
    campaign: '',
    landing_page: landingPath || '/',
    referrer: '',
    fbclid: '',
    gclid: '',
  };
}

export interface BuildLeadInput {
  leadId: string;
  vertical: Vertical;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consentSms: boolean;
  attribution: Attribution;
  pageSubmitted: string;
  device: DeviceType;
  submittedAt?: string;
}

/**
 * Assemble the complete, correctly-tagged lead object. `campaign` falls back to the vertical's
 * default when no utm_campaign was captured (data-contract.md); every other attribution field
 * comes straight from first touch. The vertical is the caller's resolved selection (AC-2.3),
 * and consent_text is rebuilt from that same vertical so it always names the right brand.
 */
export function buildLeadObject(input: BuildLeadInput): LeadPayload {
  const cfg = getVerticalConfig(input.vertical);
  const attr = input.attribution;
  return {
    lead_id: input.leadId,
    vertical: input.vertical,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    consent_sms: input.consentSms === true,
    consent_text: input.consentSms ? buildConsentText(input.vertical) : '',
    source: attr.source || 'direct',
    medium: attr.medium || 'none',
    campaign: attr.campaign || cfg.defaultCampaign,
    landing_page: attr.landing_page || '/',
    referrer: attr.referrer || '',
    fbclid: attr.fbclid || '',
    gclid: attr.gclid || '',
    page_submitted: input.pageSubmitted || '/',
    device: input.device,
    submitted_at: input.submittedAt || isoWithOffset(),
  };
}

/** Basic email shape check (AC-4.3). Deliberately lenient — real validation is deliverability. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** A phone is valid for our purposes when it normalizes to at least 10 digits (AC-4.3). */
export function isValidPhone(phone: string): boolean {
  return normalizePhone(phone).length >= 10;
}

/**
 * Did intake refuse to route this lead?
 *
 * The intake endpoint answers HTTP 200 for every outcome it has — `accepted`, `duplicate`,
 * and `quarantined` — and puts the real one in the body (apex-lead-engine
 * `docs/data-contract.md`). So a 2xx on its own does not mean a crew was told, and reading
 * only the status code let the form show "Lead captured & routed" to someone whose request
 * had been set aside. That is the worst failure this form has: the customer stops chasing,
 * and nobody is coming.
 *
 * Only an explicit `quarantined` counts as a refusal. A body that is not the intake contract
 * means the endpoint is not the lead engine — a test webhook during development, which is
 * what every non-production build points at — and treating those as failures would show a
 * false error on every submission before launch.
 */
export function isRejectedByIntake(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  return (body as { status?: unknown }).status === 'quarantined';
}
