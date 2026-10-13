import { useState } from 'react';
import { JobSummarySchema, type AppRole, type JobCloseout, type JobSummary } from '@apex/contracts';
import { ApiError, apiSend } from '../api/client';

const COMPLETE_ROLES: readonly AppRole[] = ['admin', 'office', 'superintendent'];
const CLOSE_ROLES: readonly AppRole[] = ['admin', 'office'];

export default function CloseJob({
  job,
  closeout,
  phaseKey,
  role,
  onChanged,
}: {
  job: JobSummary;
  closeout: JobCloseout | null;
  phaseKey: string | null;
  role: AppRole | null;
  onChanged: (archived: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalPhase = phaseKey === 'plaster-fill';
  const showChecklist = finalPhase || job.status === 'complete' || job.status === 'closed';

  if (!showChecklist) return null;

  const run = async (path: string, archived: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await apiSend(path, JobSummarySchema, { method: 'POST' });
      onChanged(archived);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update this job.');
    } finally {
      setBusy(false);
    }
  };

  const canComplete = role !== null && COMPLETE_ROLES.includes(role)
    && (job.status === 'active' || job.status === 'on-hold');
  const canClose = role !== null && CLOSE_ROLES.includes(role) && job.status === 'complete';

  return (
    <div className="state" style={{ borderColor: 'var(--sage)' }}>
      <h3>{job.status === 'closed' ? 'Archived' : closeout?.ready ? 'Ready to archive' : 'Closeout checklist'}</h3>
      <ul className="schedule" aria-label="Closeout checklist">
        <li><span>Final construction phase</span><span className="tag">{closeout?.finalPhaseComplete ? 'Complete' : 'Pending'}</span></li>
        <li><span>Required gates</span><span className="tag">{closeout ? `${closeout.gates.released} / ${closeout.gates.required}` : 'Loading'}</span></li>
        <li><span>Required inspections</span><span className="tag">{closeout ? `${closeout.inspections.cleared} / ${closeout.inspections.required}` : 'Loading'}</span></li>
        <li><span>Draws invoiced</span><span className="tag">{closeout ? `${closeout.draws.invoiced} / ${closeout.draws.required}` : 'Loading'}</span></li>
        <li><span>Customer handover</span><span className="tag">{closeout?.customerHandoverComplete ? 'Complete' : 'Pending'}</span></li>
      </ul>
      {job.status === 'closed' && (
        <p className="notice" style={{ color: 'var(--sage)' }}>Job closed. Reconciliation is recorded.</p>
      )}
      {canComplete && (
        <button
          type="button"
          className="action"
          disabled={busy || !finalPhase}
          onClick={() => void run(`/api/jobs/${job.jobId}/complete`, false)}
        >
          {busy ? 'Saving…' : 'Mark complete and hand over'}
        </button>
      )}
      {canClose && (
        <button
          type="button"
          className="action"
          disabled={busy || closeout?.ready !== true}
          onClick={() => void run(`/api/jobs/${job.jobId}/close`, true)}
        >
          {busy ? 'Closing…' : 'Close and archive project'}
        </button>
      )}
      {error !== null && <p role="alert" className="notice" style={{ color: 'var(--amber)' }}>{error}</p>}
    </div>
  );
}
