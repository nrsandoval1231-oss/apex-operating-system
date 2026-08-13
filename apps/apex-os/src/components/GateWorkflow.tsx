import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiGet, apiSend } from '../api/client';
import EvidenceProof from './EvidenceProof';
import { idSchemas, type JobGatePlanEntry } from '@apex/contracts';

const RequirementSchema = z.object({
  key: z.string(), status: z.string(), evidenceRequired: z.boolean(),
  acceptedEvidenceKinds: z.array(z.string()), evidenceIds: z.array(z.string()),
  note: z.string().nullable().optional(),
});
const GateSchema = z.object({
  gateInstanceId: z.string(), jobId: z.string(), definitionKey: z.string(),
  status: z.string(), requirements: z.array(RequirementSchema),
});
type Gate = z.infer<typeof GateSchema>;

const title = (key: string) => key.split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
const fileAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.readAsDataURL(file);
});

/** The Gate process is a Project capability; this is its staff workflow. */
export default function GateWorkflow({
  jobId,
  entry,
  onChanged,
}: { jobId: string; entry: JobGatePlanEntry; onChanged: () => void }) {
  const [gate, setGate] = useState<Gate | null>(null);
  const [gateId, setGateId] = useState(entry.gateInstanceId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    if (gateId === null) { setGate(null); return; }
    setGate(await apiGet(`/api/gates/${gateId}`, GateSchema));
  };
  useEffect(() => { void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load this hold point.')); }, [gateId]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await work(); await load(); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The hold point could not be updated.'); }
    finally { setBusy(false); }
  };

  const open = () => run(async () => {
    const opened = await apiSend(`/api/jobs/${jobId}/gates/${entry.definitionKey}`, z.unknown(), { method: 'POST', body: {} });
    const parsed = GateSchema.parse(opened);
    setGateId(idSchemas.gate.parse(parsed.gateInstanceId));
    setGate(parsed);
  });
  const start = () => run(async () => {
    await apiSend(`/api/gates/${gate?.gateInstanceId}/start`, z.unknown(), { method: 'POST', body: {} });
  });
  const evaluate = (requirementKey: string, outcome: 'passed' | 'failed') => run(async () => {
    const note = notes[requirementKey]?.trim();
    if (outcome === 'failed' && !note) throw new Error('Record why the requirement failed.');
    await apiSend(`/api/gates/${gate?.gateInstanceId}/requirements/${encodeURIComponent(requirementKey)}/evaluate`, z.unknown(), {
      method: 'POST', body: { outcome, ...(note ? { note } : {}) },
    });
  });
  const release = () => run(async () => {
    if (!window.confirm(`Release ${entry.title} for ${jobId}? This is irreversible.`)) return;
    await apiSend(`/api/gates/${gate?.gateInstanceId}/release`, z.unknown(), { method: 'POST', body: {} });
  });
  const upload = (requirementKey: string, file: File) => run(async () => {
    const kind = file.type === 'application/pdf' ? 'document' : file.type === 'video/mp4' ? 'video' : 'photo';
    const accepted = gate?.requirements.find((item) => item.key === requirementKey)?.acceptedEvidenceKinds ?? [];
    if (!accepted.includes(kind)) throw new Error(`This requirement does not accept ${kind} evidence.`);
    await apiSend(`/api/gates/${gate?.gateInstanceId}/evidence`, z.unknown(), {
      method: 'POST', body: { requirementKey, kind, mimeType: file.type, contentBase64: await fileAsBase64(file), capturedAt: new Date().toISOString() },
    });
  });

  if (error) return <p className="error" role="alert">{error}</p>;
  if (gate === null) return <div className="panel"><p className="state-quiet">{entry.title} is not open.</p><button className="action" disabled={busy} onClick={() => void open()}>Open {entry.title}</button></div>;

  const complete = gate.requirements.every((item) => item.status === 'passed' || item.status === 'overridden');
  return <div className="gate-workflow">
    <div className="row-foot"><span className="due">{entry.title} · {gate.status}</span><span className="tag tag-dim">{gate.requirements.filter((item) => item.status === 'passed' || item.status === 'overridden').length} / {gate.requirements.length} clear</span></div>
    {gate.status === 'not-started' && <button className="action" disabled={busy} onClick={() => void start()}>Start {entry.title}</button>}
    {gate.requirements.map((requirement) => <article className="gate-requirement" key={requirement.key}>
      <div className="gate-requirement-head"><span className="what">{title(requirement.key)}</span><span className="tag">{requirement.status}</span></div>
      {requirement.evidenceIds.length > 0 && <div className="proof-grid">{requirement.evidenceIds.map((id) => <EvidenceProof key={id} evidenceId={id} />)}</div>}
      {gate.status !== 'released' && gate.status !== 'not-started' && <>
        <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" disabled={busy || gate.status === 'not-started'} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(requirement.key, file); }} />
        <input aria-label={`${title(requirement.key)} note`} value={notes[requirement.key] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [requirement.key]: event.target.value }))} placeholder="Evaluation note" />
        <button className="action" disabled={busy || requirement.status === 'passed' || requirement.status === 'overridden'} onClick={() => void evaluate(requirement.key, 'passed')}>Pass</button>
        <button className="action action-quiet" disabled={busy} onClick={() => void evaluate(requirement.key, 'failed')}>Fail</button>
      </>}
    </article>)}
    {gate.status !== 'released' && gate.status !== 'not-started' && <button className="action" disabled={busy || !complete} onClick={() => void release()}>{complete ? `Release ${entry.title}` : 'Complete requirements to release'}</button>}
  </div>;
}