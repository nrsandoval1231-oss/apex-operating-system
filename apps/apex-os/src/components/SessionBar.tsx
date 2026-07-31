import { useState } from 'react';
import { setToken } from '../api/session';
import { useToken } from '../api/useJobs';

/**
 * Pilot access bar. Tokens are issued out of band per the controlled-pilot
 * runbook and pasted here; this app never mints or stores credentials.
 */
export default function SessionBar() {
  const token = useToken();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  if (token !== '' && !open) {
    return (
      <div className="session-bar connected">
        <span className="session-status">Signed in for this pilot session</span>
        <div className="flex gap-2">
          <button type="button" className="action-button secondary session-button" onClick={() => setOpen(true)}>
            Replace token
          </button>
          <button type="button" className="action-button secondary session-button" onClick={() => setToken('')}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="session-bar"
      onSubmit={(event) => {
        event.preventDefault();
        setToken(draft);
        setDraft('');
        setOpen(false);
      }}
    >
      <label className="session-label" htmlFor="pilot-token">
        Pilot access token
      </label>
      <div className="flex gap-2">
        <input
          id="pilot-token"
          className="session-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the short-lived token issued for this session"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="action-button session-button" disabled={draft.trim() === ''}>
          Use token
        </button>
        {token !== '' && (
          <button type="button" className="action-button secondary session-button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
