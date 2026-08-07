import { useEffect, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiGet, apiSend } from '../api/client';

/**
 * Put a named superintendent on a job, or take one off.
 *
 * The Today feed has raised "no superintendent assigned" since the card engine
 * shipped, and until now the name could only be set when the project was first
 * opened — so the card named a fact nobody could change.
 *
 * The list is superintendents only and excludes anyone inactive: somebody who
 * has left the company must not be offered as the person responsible for a pour.
 */

const SuperintendentsSchema = z.array(z.strictObject({
  userId: z.string(),
  displayName: z.string(),
}));

export default function AssignSuperintendent({
  jobId,
  currentUserId,
  onAssigned,
}: {
  jobId: string;
  currentUserId: string | null;
  onAssigned: () => void;
}) {
  const [people, setPeople] = useState<readonly { userId: string; displayName: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiGet('/api/superintendents', SuperintendentsSchema)
      .then((rows) => { if (live) setPeople(rows); })
      // A list that will not load is not worth an alarm on this screen; the
      // control simply cannot be offered, and the reason shows on use.
      .catch(() => { if (live) setPeople([]); });
    return () => { live = false; };
  }, []);

  const assign = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/jobs/${jobId}/project/superintendent`, z.unknown(), {
        method: 'POST',
        body: { superintendentUserId: userId === '' ? null : userId },
      });
      onAssigned();
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error
        ? caught.message
        : 'The superintendent could not be assigned.');
    } finally {
      setBusy(false);
    }
  };

  if (people === null) return null;

  if (people.length === 0) {
    return (
      <p className="state-quiet">
        No active superintendent exists to assign.
      </p>
    );
  }

  return (
    <>
      <label className="field" style={{ maxWidth: '32ch' }}>
        <span>Superintendent</span>
        <select
          value={currentUserId ?? ''}
          disabled={busy}
          onChange={(event) => assign(event.target.value)}
        >
          <option value="">Nobody assigned</option>
          {people.map((person) => (
            <option key={person.userId} value={person.userId}>{person.displayName}</option>
          ))}
        </select>
      </label>
      {error !== null && <p className="attach-error" role="alert">{error}</p>}
    </>
  );
}
