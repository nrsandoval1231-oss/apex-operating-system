import { useState, type ChangeEvent } from 'react';
import { ApprovedTakeoffRevisionSchema, DesignerTakeoffSubmissionSchema } from '@apex/contracts';
import { ApiError, apiSend } from '../api/client';

/**
 * Attach an approved Designer takeoff to a job.
 *
 * The office half of the handover. Designer exports a file — it runs on a
 * builder's machine and has no session here, so posting from there would need
 * CORS on this API and a second sign-in implementation over there. The file
 * crosses that gap; this posts it same-origin as whoever is signed in, which is
 * what makes the approval an act with a name against it.
 *
 * **The file is parsed before it is sent.** The API would refuse a malformed
 * submission anyway, but a 422 from a server reads as "something went wrong"
 * where a local parse can say which field. Nothing is repaired on the way
 * through: a file that does not satisfy the contract is refused, not patched
 * into shape, because the thing being attached is evidence.
 */
export default function AttachTakeoff({
  jobId,
  hasApproved,
  onAttached,
}: {
  jobId: string;
  hasApproved: boolean;
  onAttached: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [supersede, setSupersede] = useState(false);

  const attach = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing the input means picking the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const parsed = DesignerTakeoffSubmissionSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new Error(
          `This file is not a Designer takeoff export${first ? `: ${first.path.join('.')} ${first.message}` : '.'}`,
        );
      }

      await apiSend(`/api/jobs/${jobId}/approved-takeoff`, ApprovedTakeoffRevisionSchema, {
        method: 'POST',
        body: { ...parsed.data, supersedeExisting: supersede },
      });
      setSupersede(false);
      onAttached();
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : 'The takeoff could not be attached.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="attach-takeoff">
      <label className="action action-quiet">
        {busy ? 'Attaching…' : hasApproved ? 'Replace takeoff…' : 'Attach takeoff…'}
        <input
          type="file"
          accept="application/json,.json"
          onChange={attach}
          disabled={busy}
          style={{ display: 'none' }}
        />
      </label>

      {/*
        * Replacing is opt-in and says what it costs. The API refuses a second
        * approval without this, and repeating the reason here means somebody
        * reads it before the refusal rather than after.
        */}
      {hasApproved && (
        <label className="attach-supersede">
          <input
            type="checkbox"
            checked={supersede}
            onChange={(event) => setSupersede(event.target.checked)}
          />
          Replace the approved takeoff. Any pricing derived from it stops matching.
        </label>
      )}

      <p className="state-quiet attach-hint">
        Export from Apex Designer with <strong>Send to Apex OS</strong>, then choose that file here.
      </p>

      {error !== null && <p className="attach-error" role="alert">{error}</p>}
    </div>
  );
}
