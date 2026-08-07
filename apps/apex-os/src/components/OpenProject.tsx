import { useState } from 'react';
import { z } from 'zod';
import { ApiError, apiSend } from '../api/client';

/**
 * Open a signed job as a construction project.
 *
 * The endpoint has existed since the project model shipped and no screen called
 * it, so the Today card saying a job was not open could never be cleared.
 *
 * Deliberately a plain button with no phase picker. A project opens at design
 * and permitting; every other phase is reached by moving through them, or now by
 * releasing the Gate that guards one. Offering a starting phase here would let
 * somebody begin a job halfway through with nothing recorded about why.
 */
export default function OpenProject({
  jobId,
  onOpened,
}: {
  jobId: string;
  onOpened: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      /*
       * The response is not read. The project is re-fetched through the same
       * query every other screen uses, so validating a shape here would assert
       * something this component never relies on — and a schema nothing checks
       * is a schema that quietly goes stale.
       */
      await apiSend(`/api/jobs/${jobId}/project`, z.unknown(), { method: 'POST', body: {} });
      onOpened();
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error
        ? caught.message
        : 'The project could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: '12px' }}>
      <button type="button" className="action action-quiet" onClick={open} disabled={busy}>
        {busy ? 'Opening…' : 'Open as a construction project'}
      </button>
      {error !== null && <p className="attach-error" role="alert">{error}</p>}
    </div>
  );
}
