import { useState } from 'react';
import { JobSummarySchema, type JobSummary } from '@apex/contracts';
import { ApiError, apiSend } from '../api/client';

export default function CloseJob({ job, onClosed }: { job: JobSummary; onClosed: () => void }) {
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
      <h3>Ready to finish</h3>
      <p>Final work is marked complete. Close the job after reconciliation so the customer sees a finished pool and the record has a real ending.</p>
      <button type="button" className="action" disabled={busy} onClick={() => void close()}>
        {busy ? 'Closing…' : 'Close and reconcile job'}
      </button>
      {error !== null && <p role="alert" className="notice" style={{ color: 'var(--amber)' }}>{error}</p>}
    </div>
  );
}
