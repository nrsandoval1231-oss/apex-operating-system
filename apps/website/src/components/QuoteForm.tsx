/**
 * QuoteForm.tsx — the Phase 3 quote form (React island, client:visible).
 *
 * The signature capture interaction: a service selector (pre-selectable via CTA — AC-2.2/2.3),
 * contact fields, a live per-vertical SMS-consent line (AC-3), then it assembles the complete
 * lead object (AC-1), generates lead_id exactly once (AC-1.3), and POSTs to the webhook.
 * Success shows the capture panel as a real confirmation (AC-4.2); failure tells the user to
 * call (AC-4.1). The "demo" framing from the mockup is dropped.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { VERTICAL_LIST, getVerticalConfig, isVertical, type Vertical } from '../content/verticals';
import { getAttribution } from '../lib/attribution';
import { generateLeadId } from '../lib/lead-id';
import {
  buildConsentText,
  buildLeadObject,
  detectDevice,
  emptyAttribution,
  isRejectedByIntake,
  isValidEmail,
  isValidPhone,
  type LeadPayload,
} from '../lib/lead';

interface Props {
  initialVertical?: Vertical;
  webhookUrl: string;
  phoneDisplay: string;
  phoneE164: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const DEFAULT_VERTICAL: Vertical = VERTICAL_LIST[0].vertical;

export default function QuoteForm({ initialVertical, webhookUrl, phoneDisplay, phoneE164 }: Props) {
  const [vertical, setVertical] = useState<Vertical>(initialVertical ?? DEFAULT_VERTICAL);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [captured, setCaptured] = useState<LeadPayload | null>(null);

  // lead_id is minted once per submission and reused across retries — never regenerated (AC-1.3).
  const leadIdRef = useRef<string | null>(null);

  // Pre-selection from a vertical CTA (AC-2.2). A CTA click sets window.__apexPreselect and
  // dispatches 'apex:preselect'; we honor whichever arrives, and the user can still change it.
  useEffect(() => {
    const initial = (window as unknown as { __apexPreselect?: string }).__apexPreselect;
    if (initial && isVertical(initial)) setVertical(initial);
    const onPreselect = (e: Event) => {
      const v = (e as CustomEvent<string>).detail;
      if (isVertical(v)) {
        setVertical(v);
        if (status === 'success') return; // don't reopen a completed submission
      }
    };
    window.addEventListener('apex:preselect', onPreselect as EventListener);
    return () => window.removeEventListener('apex:preselect', onPreselect as EventListener);
  }, [status]);

  const consentText = buildConsentText(vertical);

  /**
   * At least one way to reach them, and whatever they did give must be well-formed (AC-4.3).
   *
   * Requiring BOTH was stricter than the contract on the other end: intake quarantines a lead
   * only when email and phone are *both* empty (apex-lead-engine `docs/data-contract.md`).
   * Someone willing to leave a phone number but not an email is a lead the engine would have
   * accepted, and this form was refusing to send it.
   */
  function validate(): boolean {
    const errs: { email?: string; phone?: string } = {};
    const emailGiven = email.trim() !== '';
    const phoneGiven = phone.trim() !== '';

    if (!emailGiven && !phoneGiven) {
      const needOne = 'Add an email or a phone number so we can reach you.';
      errs.email = needOne;
      errs.phone = needOne;
    } else {
      if (emailGiven && !isValidEmail(email)) errs.email = 'Enter a valid email so we can reach you.';
      if (phoneGiven && !isValidPhone(phone))
        errs.phone = 'Enter a phone number with area code — that’s how we text you back.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'submitting' || status === 'success') return; // no double-submit (AC-4.2)
    if (!validate()) return;

    if (!leadIdRef.current) leadIdRef.current = generateLeadId();
    const attribution = getAttribution() ?? emptyAttribution(window.location.pathname);

    const payload = buildLeadObject({
      leadId: leadIdRef.current,
      vertical,
      firstName,
      lastName,
      email,
      phone,
      consentSms: consent,
      attribution,
      pageSubmitted: window.location.pathname,
      device: detectDevice(),
    });

    setStatus('submitting');
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);

      // A 200 is not proof the lead was routed — intake answers 200 for a quarantined lead
      // too, and the outcome is in the body (AC-4.4). Showing "captured & routed" for one of
      // those tells the customer to stop chasing us when no crew has been notified.
      const outcome: unknown = await res.json().catch(() => null);
      if (isRejectedByIntake(outcome)) throw new Error('Lead was quarantined by intake');

      // GA4 / GTM: lead_submit with vertical + source (AC-5.5). No-op if no dataLayer.
      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: 'lead_submit', vertical: payload.vertical, source: payload.source });

      setCaptured(payload);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success' && captured) {
    return <CapturePanel payload={captured} phoneDisplay={phoneDisplay} />;
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <fieldset className="svc-fieldset">
        <legend className="fq-label">1 · Which service?</legend>
        <div className="svc" role="group" aria-label="Choose a service">
          {VERTICAL_LIST.map((cfg) => (
            <button
              key={cfg.vertical}
              type="button"
              data-v={cfg.vertical}
              style={{ ['--sv' as string]: `var(${cfg.accentVar})` }}
              aria-pressed={vertical === cfg.vertical}
              onClick={() => setVertical(cfg.vertical)}
            >
              <span className="dot" aria-hidden="true" />
              {cfg.vertical}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="fq-label">2 · Your details</div>
      <div className="row2">
        <div className="field">
          <label className="sr-only" htmlFor="fn">First name</label>
          <input id="fn" name="fn" placeholder="First name" autoComplete="given-name"
            value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label className="sr-only" htmlFor="ln">Last name</label>
          <input id="ln" name="ln" placeholder="Last name" autoComplete="family-name"
            value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="sr-only" htmlFor="em">Email</label>
        <input id="em" name="em" type="email" placeholder="Email" autoComplete="email"
          aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'em-err' : undefined}
          value={email} onChange={(e) => setEmail(e.target.value)} />
        {fieldErrors.email && <p className="field-err" id="em-err" role="alert">{fieldErrors.email}</p>}
      </div>
      <div className="field">
        <label className="sr-only" htmlFor="ph">Phone</label>
        <input id="ph" name="ph" type="tel" placeholder="Phone" autoComplete="tel"
          aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? 'ph-err' : undefined}
          value={phone} onChange={(e) => setPhone(e.target.value)} />
        {fieldErrors.phone && <p className="field-err" id="ph-err" role="alert">{fieldErrors.phone}</p>}
      </div>

      <label className="consent-check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span className="consent">{consentText}</span>
      </label>

      {status === 'error' && (
        <p className="form-error" role="alert">
          Something went wrong sending your request. Please call us at{' '}
          <a href={`tel:${phoneE164}`}>{phoneDisplay}</a> and we’ll get you routed to the right crew.
        </p>
      )}

      <button className="btn" type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending…' : 'Get my quote →'}
      </button>
      <p className="note mono">One form, routed to the right crew. We’ll text you back fast.</p>
    </form>
  );
}

function CapturePanel({ payload, phoneDisplay }: { payload: LeadPayload; phoneDisplay: string }) {
  const cfg = getVerticalConfig(payload.vertical);
  const name = `${payload.first_name} ${payload.last_name}`.trim() || '—';
  return (
    <div className="capture" role="status" aria-live="polite">
      <div className="cap-top mono"><span className="dots"><i /><i /><i /></span> request received</div>
      <div className="cap-body">
        <div className="cap-tag">● Lead captured &amp; routed</div>
        <p className="cap-lead mono">
          Thanks{payload.first_name ? `, ${payload.first_name}` : ''} — your request is in. The{' '}
          {payload.vertical} crew will reach out shortly. Need us now? Call {phoneDisplay}.
        </p>
        <div className="kv">
          <span className="k">service:</span><span className="v hi">{payload.vertical}</span>
          <span className="k">contact:</span><span className="v">{name}</span>
          <span className="k">phone:</span><span className="v">{payload.phone || '—'}</span>
          <span className="k">email:</span><span className="v">{payload.email || '—'}</span>
          <span className="k">source:</span><span className="v">{payload.source} / {payload.medium}</span>
          <span className="k">campaign:</span><span className="v">{payload.campaign}</span>
          <span className="k">routed_to:</span><span className="v">{cfg.routedTo}</span>
          <span className="k">reference:</span><span className="v">{payload.lead_id}</span>
          <span className="k">status:</span><span className="v ok">⏱ we’ll text you back fast</span>
        </div>
      </div>
    </div>
  );
}
