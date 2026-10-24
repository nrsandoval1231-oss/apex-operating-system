import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Database } from '@apex/database';
import { createCanonicalId } from '@apex/contracts';
import { z } from 'zod';

export const PUBLIC_LEAD_PATH = '/api/public/v1/leads';
const text = (max = 200) => z.string().trim().max(max);
const ProjectSchema = z.strictObject({
  type: text().min(1), city: text().min(1), timeline: text().optional().default(''),
  budget: text().optional().default(''), size: text().optional().default(''),
  features: z.array(text()).max(30).optional().default([]), condition: text().optional().default(''),
  description: text(4000).optional().default(''),
});
const verticals = ['Designer Pools', 'Concrete Coating', 'Design & Renovation', 'Pool Service'] as const;
const consentBrands: Record<(typeof verticals)[number], string> = {
  'Designer Pools': 'Apex Designer Pools',
  'Concrete Coating': 'Apex Concrete Coating',
  'Design & Renovation': 'Apex Design & Renovation',
  'Pool Service': 'Apex Pool Service',
};
const expectedConsent = (vertical: (typeof verticals)[number]) =>
  `I agree to receive text messages from ${consentBrands[vertical]} about my quote. ~2 msgs/month, data rates may apply. Reply STOP to opt out.`;
const PublicLeadSchema = z.strictObject({
  schema_version: z.literal(2),
  lead_id: z.string().regex(/^apex_\d+_[0-9a-z]{4}$/), vertical: z.enum(verticals),
  first_name: text().min(1), last_name: text().min(1), email: z.union([z.literal(''), z.string().trim().email().max(200)]), phone: text(40),
  consent_sms: z.boolean(), consent_text: text(), source: text(), medium: text(), campaign: text(),
  landing_page: text(), referrer: text(), fbclid: text(), gclid: text(), page_submitted: text(),
  device: z.enum(['mobile', 'tablet', 'desktop']), submitted_at: z.string().datetime({ offset: true }),
  project: ProjectSchema,
  website: z.string().max(200),
  consent_version: z.literal('website-2-20261024'),
});

const canonicalPayload = (value: z.infer<typeof PublicLeadSchema>) => ({
  schema_version: value.schema_version,
  lead_id: value.lead_id,
  vertical: value.vertical,
  first_name: value.first_name,
  last_name: value.last_name,
  email: value.email,
  phone: value.phone,
  consent_sms: value.consent_sms,
  consent_text: value.consent_text,
  source: value.source,
  medium: value.medium,
  campaign: value.campaign,
  landing_page: value.landing_page,
  referrer: value.referrer,
  fbclid: value.fbclid,
  gclid: value.gclid,
  page_submitted: value.page_submitted,
  device: value.device,
  submitted_at: value.submitted_at,
  project: value.project,
  consent_version: value.consent_version,
  customerName: `${value.first_name} ${value.last_name}`.trim(),
  city: value.project.city,
  intakeSource: 'website',
});
const substantive = (value: Record<string, unknown>) => {
  const { website: _honeypot, ...rest } = value;
  return rest;
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reply = (res: ServerResponse, status: number, body?: unknown) => {
  const serialized = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    ...(body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }),
    ...(body === undefined ? {} : { 'content-length': Buffer.byteLength(serialized) }),
  });
  res.end(serialized);
};

export interface PublicLeadOptions { db: Database; enabled?: boolean; origins?: readonly string[] }
export function createPublicLeadHandler(options: PublicLeadOptions) {
  const allowed = new Set((options.origins ?? []).map((origin) => new URL(origin).origin));
  const rates = new Map<string, { start: number; count: number }>();
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== PUBLIC_LEAD_PATH) return false;
    const origin = req.headers.origin;
    const permitted = typeof origin === 'string' && allowed.has(origin);
    if (permitted) res.setHeader('access-control-allow-origin', origin!);
    res.setHeader('vary', 'Origin');
    if (!options.enabled) { reply(res, 404, { error: 'Intake unavailable.' }); return true; }
    if (req.method === 'OPTIONS') {
      if (!permitted) { reply(res, 403, { error: 'Origin not allowed.' }); return true; }
      res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
      res.setHeader('access-control-allow-headers', 'content-type, idempotency-key');
      reply(res, 204); return true;
    }
    if (req.method !== 'POST') { reply(res, 405, { error: 'Method not allowed.' }); return true; }
    if (!permitted) { reply(res, 403, { error: 'Origin not allowed.' }); return true; }
    const remote = req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const rate = rates.get(remote);
    if (rate && now - rate.start < 60_000 && rate.count >= 8) { reply(res, 429, { error: 'Please try again later.' }); return true; }
    if (rates.size >= 10_000 && !rate) {
      for (const [address, entry] of rates) if (now - entry.start >= 60_000) rates.delete(address);
      if (rates.size >= 10_000) { reply(res, 429, { error: 'Please try again later.' }); return true; }
    }
    rates.set(remote, !rate || now - rate.start >= 60_000 ? { start: now, count: 1 } : { ...rate, count: rate.count + 1 });
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buf.length;
        if (size > 16_000) { reply(res, 413, { error: 'Request too large.' }); return true; }
        chunks.push(buf);
      }
      const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const parsed = PublicLeadSchema.safeParse(input);
      if (!parsed.success) { reply(res, 422, { error: 'Invalid request.' }); return true; }
      if (parsed.data.website.trim() !== '') { reply(res, 400, { error: 'Invalid request.' }); return true; }
      if (!parsed.data.email && parsed.data.phone.replace(/\D/g, '').length < 10) { reply(res, 422, { error: 'Invalid request.' }); return true; }
      if (parsed.data.consent_sms ? parsed.data.consent_text !== expectedConsent(parsed.data.vertical) : parsed.data.consent_text !== '') {
        reply(res, 422, { error: 'Invalid request.' }); return true;
      }
      const key = parsed.data.lead_id;
      const payload = canonicalPayload(parsed.data);
      const clean = substantive(payload);
      const payloadDigest = digest(clean);
      const leadId = createCanonicalId('lead');
      const inserted = await options.db.query<{ lead_id: string }>(
        `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload_version, accepted_payload)
         values ($1, 'website', $2, $3, 2, $4::jsonb)
         on conflict (idempotency_key) do nothing returning lead_id`,
        [leadId, parsed.data.lead_id, `website:${key}`, JSON.stringify({ ...payload, _website_payload_digest: payloadDigest })],
      );
      if (inserted.rows[0]) {
        reply(res, 201, { status: 'accepted', lead_id: parsed.data.lead_id, canonical_lead_id: leadId }); return true;
      }
      const prior = await options.db.query<{ lead_id: string; accepted_payload: Record<string, unknown> }>(
        'select lead_id, accepted_payload from leads where idempotency_key = $1', [`website:${key}`],
      );
      const row = prior.rows[0];
      if (!row) { reply(res, 503, { error: 'Intake unavailable.' }); return true; }
      const existing = row.accepted_payload;
      const existingDigest = existing._website_payload_digest ?? digest(substantive(existing));
      if (existingDigest !== payloadDigest) { reply(res, 409, { error: 'Idempotency key already used.' }); return true; }
      reply(res, 200, { status: 'duplicate', lead_id: String(existing.lead_id), canonical_lead_id: row.lead_id }); return true;
    } catch (error) {
      if (error instanceof SyntaxError) { reply(res, 400, { error: 'Invalid request.' }); return true; }
      reply(res, 503, { error: 'Intake unavailable.' }); return true;
    }
  };
}
