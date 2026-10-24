import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isVertical, type Vertical } from '../content/verticals';
import { getAttribution } from '../lib/attribution';
import { generateLeadId } from '../lib/lead-id';
import { buildConsentText, buildLeadObject, detectDevice, emptyAttribution, isValidEmail, isValidPhone } from '../lib/lead';
import type { LeadPayload } from '../lib/lead';
import { isIntakeResponseAccepted } from '../lib/intake-response';

interface Props { initialVertical?: Vertical; webhookUrl: string; phoneDisplay: string; phoneE164: string }
type Project = { type: string; city: string; timeline: string; budget: string; size: string; features: string[]; condition: string; description: string };
const blank: Project = { type: '', city: 'Lubbock', timeline: '', budget: '', size: '', features: [], condition: '', description: '' };
const choices = ['Designer Pools', 'Concrete Coating', 'Design & Renovation'] as const;
const featureOptions: Record<string, string[]> = { 'Designer Pools': ['New pool', 'Remodel', 'Repair', 'Pool care'], 'Concrete Coating': ['Garage', 'Patio or pool deck', 'Shop or commercial', 'Other surface'], 'Design & Renovation': ['Kitchen or bath', 'Addition', 'Roofing or exterior', 'Interior updates', 'Other'], 'Pool Service': ['Maintenance', 'Repair', 'Equipment', 'Other'] };
export default function QuoteForm({ initialVertical, webhookUrl, phoneDisplay, phoneE164 }: Props) {
  const [vertical, setVertical] = useState<Vertical>(initialVertical ?? 'Designer Pools');
  const [step, setStep] = useState(1); const [project, setProject] = useState<Project>(blank);
  const [first, setFirst] = useState(''); const [last, setLast] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle'|'sending'|'error'|'rejected'|'success'>('idle'); const [error, setError] = useState(''); const [fieldError, setFieldError] = useState(''); const [website, setWebsite] = useState('');
  const pending = useRef<{ id: string; payload: Record<string, unknown> } | null>(null); const [accepted, setAccepted] = useState<LeadPayload | null>(null);
  useEffect(() => {
    const initial = (window as Window & {__apexPreselect?: string}).__apexPreselect;
    if (initial && isVertical(initial)) choose(initial);
    const onPreselect = (event: Event) => { const value = (event as CustomEvent<string>).detail; if (isVertical(value)) choose(value); };
    window.addEventListener('apex:preselect', onPreselect); return () => window.removeEventListener('apex:preselect', onPreselect);
  }, []);
  // The mount-only CTA listener must read the live frozen request, not captured status.
  function choose(value: Vertical) { if (pending.current) return; setVertical(value); setProject({ ...blank, type: '' }); }
  function update<K extends keyof Project>(key: K, value: Project[K]) { setProject((p) => ({ ...p, [key]: value })); }
  function toggleFeature(value: string) { update('features', project.features.includes(value) ? project.features.filter((x) => x !== value) : [...project.features, value]); }
  function next() { if (step === 1 && !isVertical(vertical)) { setFieldError('Choose a division to continue.'); return; } setFieldError(''); setStep(Math.min(3, step + 1)); }
  function back() { if (status !== 'error') setStep(Math.max(1, step - 1)); }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (status === 'sending' || status === 'success') return;
    if (!email.trim() && !phone.trim()) { setFieldError('Add an email or phone number so we can reach you.'); setStep(3); return; }
    if ((email.trim() && !isValidEmail(email)) || (phone.trim() && !isValidPhone(phone))) { setFieldError('Check your email or phone number and try again.'); return; }
    if (!project.type.trim() || !project.city.trim()) { setFieldError('Choose a project type and enter the project city.'); setStep(2); return; }
    if (!first.trim() || !last.trim()) { setFieldError('Enter your first and last name.'); setStep(3); return; }
    if (!pending.current) {
      const id = generateLeadId(); const attribution = getAttribution() ?? emptyAttribution(location.pathname);
      const lead = buildLeadObject({ leadId:id, vertical, firstName:first, lastName:last, email, phone, consentSms:consent, attribution, pageSubmitted:location.pathname, device:detectDevice() });
      pending.current = { id, payload: { ...lead, schema_version:2, project:{ ...project, type:project.type || vertical }, website, consent_version:'website-2-20261024' } };
    }
    setStatus('sending'); setError('');
    try {
      if (!webhookUrl) throw new Error('Online requests are temporarily unavailable. Please call us to share your project.');
      const res = await fetch(webhookUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(pending.current.payload), signal:AbortSignal.timeout(15000) });
      const body = await res.json().catch(() => null) as {status?:string;lead_id?:string;canonical_lead_id?:string}|null;
      if (!res.ok && (res.status === 400 || res.status === 422)) { pending.current = null; setError('The server rejected this request. Review the details and submit again, or call us.'); setStatus('rejected'); setStep(2); return; }
      if (!res.ok || !isIntakeResponseAccepted(body, pending.current.id)) throw new Error('The request was not confirmed. Your details are retained for a safe retry; retry or call us.');
      const confirmed = JSON.parse(JSON.stringify(pending.current.payload)) as LeadPayload;
      setAccepted(confirmed); setStatus('success');
      // Emit only after the matching acknowledgement, using the frozen payload.
      try {
        const w = window as unknown as { dataLayer?: unknown[] };
        w.dataLayer = w.dataLayer || [];
        w.dataLayer.push({ event: 'lead_submit', vertical: confirmed.vertical, source: confirmed.source });
      } catch {
        // Optional analytics must never turn a confirmed lead into a retry.
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'The request could not be confirmed. Keep this page open and retry, or call us. If you leave or reload, call before submitting again.'); setStatus('error'); }
  }
  if (status === 'success') return <div className="quote-success" role="status" aria-live="polite"><p className="eyebrow">Request received</p><h3>Thanks{accepted?.first_name ? `, ${accepted.first_name}` : ''}.</h3><p>Your request was accepted. Need to talk now? Call <a href={`tel:${phoneE164}`}>{phoneDisplay}</a>.</p></div>;
  const frozen = status === 'sending' || (status === 'error' && pending.current !== null);
  return <form className="form quote-wizard" onSubmit={submit} noValidate>
    <div className="wizard-progress" aria-label={`Step ${step} of 3`}><span>0{step} / 03</span><span>{['Your project','Project details','Your contact'][step-1]}</span><div><i style={{width:`${step/3*100}%`}} /></div></div>
    {step === 1 && <fieldset disabled={frozen}><legend className="fq-label">Which division can help?</legend><div className="svc" role="group" aria-label="Choose a division">{choices.map((v) => <button key={v} type="button" aria-pressed={vertical === v} onClick={() => choose(v)}>{v}</button>)}</div></fieldset>}
    {step === 2 && <fieldset disabled={frozen}><legend className="fq-label">A little about the project</legend><label>Project type<select value={project.type} onChange={(e) => update('type',e.target.value)}><option value="">Choose one</option>{(featureOptions[vertical] ?? []).map((x)=><option key={x}>{x}</option>)}</select></label><label>Project city<input value={project.city} onChange={(e)=>update('city',e.target.value)} maxLength={200} /></label>{vertical==='Designer Pools'&&<label>Approximate pool size or dimensions (optional)<input value={project.size} onChange={(e)=>update('size',e.target.value)} maxLength={200}/></label>}{vertical==='Concrete Coating'&&<><label>Approximate area or square footage (optional)<input value={project.size} onChange={(e)=>update('size',e.target.value)} maxLength={200}/></label><label>Current surface condition (optional)<input value={project.condition} onChange={(e)=>update('condition',e.target.value)} maxLength={200}/></label></>}{vertical==='Design & Renovation'&&<label>Project scope (optional)<input value={project.size} onChange={(e)=>update('size',e.target.value)} maxLength={200}/></label>}<label>Budget range (optional)<input value={project.budget} onChange={(e)=>update('budget',e.target.value)} maxLength={200}/></label><label>When are you thinking?<select value={project.timeline} onChange={(e)=>update('timeline',e.target.value)}><option value="">Choose one</option>{['As soon as possible','Within 3 months','3–6 months','6+ months','Just exploring'].map(x=><option key={x}>{x}</option>)}</select></label><fieldset className="feature-set"><legend>What should we know? (optional)</legend>{(featureOptions[vertical] ?? []).map((x)=><label key={x}><input type="checkbox" checked={project.features.includes(x)} onChange={()=>toggleFeature(x)} />{x}</label>)}</fieldset><label>Anything else? (optional)<textarea maxLength={4000} value={project.description} onChange={(e)=>update('description',e.target.value)} /></label></fieldset>}
    {step === 3 && <fieldset disabled={frozen}><legend className="fq-label">How can we reach you?</legend><div className="row2"><label>First name<input autoComplete="given-name" value={first} onChange={(e)=>setFirst(e.target.value)} maxLength={200}/></label><label>Last name<input autoComplete="family-name" value={last} onChange={(e)=>setLast(e.target.value)} maxLength={200}/></label></div><label>Email<input type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} maxLength={200}/></label><label>Phone<input type="tel" autoComplete="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} maxLength={40}/></label><label className="consent-check"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /><span>{buildConsentText(vertical)} Consent is optional and not required to request a quote.</span></label><label className="honeypot">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e)=>setWebsite(e.target.value)} /></label></fieldset>}
    {fieldError && <p className="field-err" role="alert">{fieldError}</p>}{(status === 'error' || status === 'rejected') && <p className="form-error" role="alert">{error} <a href={`tel:${phoneE164}`}>{phoneDisplay}</a></p>}
    <div className="wizard-actions">{step>1 && <button type="button" className="btn ghost" onClick={back} disabled={frozen}>Back</button>}{step<3 ? <button type="button" className="btn" onClick={next} disabled={frozen}>Continue →</button> : <button className="btn" type="submit" disabled={status==='sending'}>{status==='sending'?'Sending…':status==='error'?'Retry request':status==='rejected'?'Send updated request →':'Send project request →'}</button>}</div>
    <p className="note">Your information is used to respond to this request. <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms</a></p>
  </form>;
}
