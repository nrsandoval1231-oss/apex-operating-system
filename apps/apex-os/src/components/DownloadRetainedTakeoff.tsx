import { useState } from 'react';
import { ApprovedTakeoffRevisionSchema } from '@apex/contracts';
import { apiGet } from '../api/client';

/** Download the approved takeoff record through the existing staff read route. */
export default function DownloadRetainedTakeoff({ jobId }: { jobId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const takeoff = await apiGet(`/api/jobs/${jobId}/approved-takeoff`, ApprovedTakeoffRevisionSchema);
      const url = URL.createObjectURL(new Blob([JSON.stringify(takeoff, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${jobId}-approved-takeoff.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The retained takeoff could not be downloaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="attach-takeoff">
      <button type="button" className="action action-quiet" disabled={busy} onClick={() => void download()}>
        {busy ? 'Preparing download...' : 'Download retained takeoff'}
      </button>
      {error !== null && <p className="attach-error" role="alert">{error}</p>}
    </div>
  );
}
