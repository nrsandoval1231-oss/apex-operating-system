import { useState, type FormEvent } from 'react';
import {
  PROCUREMENT_CODES,
  PROCUREMENT_LABELS,
  ProcurementLineSchema,
  ProcurementUpdateSchema,
  type ProcurementLine,
} from '@apex/contracts';
import { useApprovedTakeoff, useJobProcurement } from '../api/useJobs';
import { ApiError, apiSend } from '../api/client';

type Code = (typeof PROCUREMENT_CODES)[number];
const formatQuantity = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

export default function Procurement({ jobId, readOnly, hasApprovedTakeoff }: { jobId: string; readOnly: boolean; hasApprovedTakeoff: boolean }) {
  const tracked = useJobProcurement(jobId);
  const takeoff = useApprovedTakeoff(jobId, hasApprovedTakeoff);
  const [selected, setSelected] = useState<Code | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const quantities = takeoff.data?.quantities.filter((item) => PROCUREMENT_CODES.includes(item.code as Code)) ?? [];
  const available = quantities.filter((item) =>
    !tracked.data?.some((line) => line.revisionId === takeoff.data?.revisionId && line.quantityCode === item.code),
  );

  const create = async () => {
    if (selected === '') return;
    setBusy(true); setError(null);
    try {
      await apiSend(`/api/jobs/${jobId}/procurement`, ProcurementLineSchema, {
        method: 'POST', body: { quantityCode: selected },
      });
      setSelected('');
      tracked.reload();
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Material line could not be tracked.');
    } finally { setBusy(false); }
  };

  return <section className="procurement" aria-label="Material procurement">
    <div className="section-rule" id="procurement"><h2>Procurement</h2></div>
    <p className="state-quiet">Manual coordination only. Tracking an order here does not place an order or record a committed cost.</p>
    {!tracked.loading && tracked.data?.length === 0 && <p className="state-quiet">Procurement not tracked — material status is unknown.</p>}
    {!hasApprovedTakeoff && <p className="state-quiet">No approved takeoff is available. Material requirements cannot be tracked.</p>}
    {tracked.error && <p className="error" role="alert">Procurement could not be loaded. {tracked.error.message}</p>}
    {tracked.data?.map((line) => <MaterialLine key={line.lineId} line={line} disabled={readOnly} onError={setError} />)}
    {!readOnly && available.length > 0 && (
      <div className="inline-form">
        <label>Approved takeoff material
          <select value={selected} onChange={(event) => setSelected(event.target.value as Code | '')}>
            <option value="">Choose a material requirement</option>
            {available.map((item) => <option key={item.code} value={item.code}>{PROCUREMENT_LABELS[item.code as Code]} · {formatQuantity.format(item.value)} {item.unit}</option>)}
          </select>
        </label>
        <button type="button" className="action" disabled={busy || selected === ''} onClick={() => void create()}>
          {busy ? 'Tracking…' : 'Track material'}
        </button>
      </div>
    )}
    {takeoff.error && <p className="state-quiet">The approved takeoff could not be verified, so no material requirements can be added.</p>}
    {!readOnly && available.length === 0 && quantities.length === 0 && takeoff.data !== null
      && <p className="state-quiet">No supported ordered-material codes appear in this takeoff; no quantities were inferred.</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

function MaterialLine({ line, disabled, onError }: { line: ProcurementLine; disabled: boolean; onError: (value: string | null) => void }) {
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nullable = (key: string) => String(form.get(key) ?? '').trim() || null;
    const value = String(form.get('orderedQuantity') ?? '').trim();
    const parsed = ProcurementUpdateSchema.safeParse({
      expectedRevision: line.revision,
      orderedQuantity: value === '' ? null : Number(value),
      vendor: nullable('vendor'),
      orderReference: nullable('orderReference'),
      neededBy: nullable('neededBy'),
      expectedOn: nullable('expectedOn'),
      receivedQuantity: Number(form.get('receivedQuantity') ?? 0),
    });
    if (!parsed.success) {
      onError('Enter ordered quantity, vendor, and order reference together. Expected delivery requires an order.');
      return;
    }
    try {
      onError(null);
      await apiSend(`/api/procurement/${line.lineId}`, ProcurementLineSchema, { method: 'POST', body: parsed.data });
    } catch (cause) { onError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Material details could not be saved.'); }
  };
  return <article className="schedule procurement-line">
    <h3>{PROCUREMENT_LABELS[line.quantityCode]} <span className="tag">{line.staleTakeoff ? 'Earlier takeoff — reconcile' : `Takeoff ${line.revisionId.slice(-8)}`}</span></h3>
    <p>Required {formatQuantity.format(line.requiredQuantity)} {line.unit} · Received {formatQuantity.format(line.receivedQuantity)} · Outstanding {formatQuantity.format(line.outstandingQuantity)} {line.unit}</p>
    <form onSubmit={(event) => void save(event)}>
      <label>Ordered quantity <input name="orderedQuantity" type="number" min="0" step="any" defaultValue={line.orderedQuantity ?? ''} disabled={disabled} /></label>
      <label>Vendor <input name="vendor" defaultValue={line.vendor ?? ''} disabled={disabled} /></label>
      <label>Order reference <input name="orderReference" defaultValue={line.orderReference ?? ''} disabled={disabled} /></label>
      <label>Needed by <input name="neededBy" type="date" defaultValue={line.neededBy ?? ''} disabled={disabled} /></label>
      <label>Expected delivery <input name="expectedOn" type="date" defaultValue={line.expectedOn ?? ''} disabled={disabled} /></label>
      <label>Cumulative received <input name="receivedQuantity" type="number" min="0" step="any" defaultValue={line.receivedQuantity} disabled={disabled} /></label>
      {!disabled && <button className="action" type="submit">Save material update</button>}
    </form>
    <p className="state-quiet">Last updated by {line.updatedByName ?? line.updatedBy} · {new Date(line.updatedAt).toLocaleString()}</p>
  </article>;
}


