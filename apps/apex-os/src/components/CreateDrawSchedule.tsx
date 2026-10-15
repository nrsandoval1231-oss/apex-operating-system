import { useState } from 'react';
import { DrawScheduleSchema } from '@apex/contracts';
import { ApiError, apiSend } from '../api/client';

export default function CreateDrawSchedule({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/jobs/${jobId}/draws`, DrawScheduleSchema, { method: 'POST' });
      onDone();
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'The draw schedule could not be created.');
    } finally {
      setBusy(false);
    }
  };
  return <div>
    <p className="state-quiet">A signed contract is available, but its draw schedule has not been created.</p>
    <button type="button" className="action" disabled={busy} onClick={() => void create()}>
      {busy ? 'Creating…' : 'Create draw schedule'}
    </button>
    {error !== null && <p className="attach-error" role="alert">{error}</p>}
  </div>;
}
