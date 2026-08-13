import { useState } from 'react';
import { JobSummarySchema, type JobCloseout, type JobSummary } from '@apex/contracts';
import { ApiError, apiSend } from '../api/client';

export default function CloseJob({
  job,
  closeout,
  onClosed,
}: {
  job: JobSummary;
  closeout: JobCloseout | null;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (job.status === 'closed') {
    return <p className="notice" style={{ color: 'var(--sage)' }}>Job closed. Reconciliation is recorded.</p>;
  }
  if (job.status !== 'complete') return null;

  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/jobs/${job.jobId}/close`, JobSummarySchema, { method: 'POST' });
      onClosed();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not close this job.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="state" style={{ borderColor: 'var(--sage)' }}>
      <h3>{closeout?.ready ? 'Ready to archive' : 'Closeout checklist'}</h3>
      <ul className="schedule" aria-label="Closeout checklist">
        <li><span>Final construction phase</span><span className="tag">{closeout?.finalPhaseComplete ? 'Complete' : 'Pending'}</span></li>
        <li><span>Required gates</span><span className="tag">{closeout ? `${closeout.gates.released} / ${closeout.gates.required}` : 'Loading'}</span></li>
        <li><span>Required inspections</span><span className="tag">{closeout ? `${closeout.inspections.cleared} / ${closeout.inspections.required}` : 'Loading'}</span></li>
        <li><span>Draws invoiced</span><span className="tag">{closeout ? `${closeout.draws.invoiced} / ${closeout.draws.required}` : 'Loading'}</span></li>
        <li><span>Customer handover</span><span className="tag">{closeout?.customerHandoverComplete ? 'Complete' : 'Pending'}</span></li>
      </ul>
      <button type="button" className="action" disabled={busy || closeout?.ready !== true} onClick={() => void close()}>
        {busy ? 'Closing…' : 'Close and archive project'}
      </button>
      {error !== null && <p role="alert" className="notice" style={{ color: 'var(--amber)' }}>{error}</p>}
    </div>
  );
}
