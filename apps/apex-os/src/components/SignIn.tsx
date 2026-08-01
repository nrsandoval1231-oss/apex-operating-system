import { useState } from 'react';
import { setToken } from '../api/session';

/**
 * The signed-out screen.
 *
 * This is a controlled pilot: tokens are issued out of band and pasted here, and
 * the app never mints or stores a credential. That is unusual enough that the
 * screen has to say so plainly — a bare password box with no explanation is how
 * someone ends up staring at an app they cannot get into.
 */
export default function SignIn() {
  const [draft, setDraft] = useState('');
  const ready = draft.trim().length > 0;

  return (
    <main className="signin">
      <h1 className="lockup">Apex<em>OS</em></h1>
      <p className="sub">Designer Pools · Lubbock, TX</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) setToken(draft);
        }}
      >
        <label className="field" htmlFor="pilot-token">
          <span>Pilot access token</span>
          <textarea
            id="pilot-token"
            rows={4}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the token issued for this session"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>

        <button type="submit" className="action action-solid" disabled={!ready}>
          Open Apex OS
        </button>
      </form>

      <p className="notice" style={{ borderBottom: 0, paddingLeft: 0, paddingRight: 0 }}>
        Tokens are short-lived and issued outside this app. If yours has expired,
        ask for a new one — nothing here can create one for you.
      </p>
    </main>
  );
}
