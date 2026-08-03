import { useEffect, useState } from 'react';
import { beginSignIn, loadAuthConfig, type AuthConfig } from '../api/auth';
import { setToken } from '../api/session';

/**
 * The signed-out screen.
 *
 * Which way in exists is decided by the server, not by a build flag: it asks
 * `/api/auth/config` and shows what that deployment actually supports. A local
 * pilot pastes a token; a deployment signs in with the identity provider. The
 * screen therefore cannot offer a sign-in button that leads nowhere, which is
 * what a hard-coded mode would eventually do.
 */
export default function SignIn() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadAuthConfig()
      .then((loaded) => { if (active) setConfig(loaded); })
      .catch((cause: unknown) => {
        if (active) setFailure(cause instanceof Error ? cause.message : 'Could not reach the Apex API.');
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="signin">
      <h1 className="lockup">Apex<em>OS</em></h1>
      <p className="sub">Designer Pools · Lubbock, TX</p>

      {failure !== null && (
        <div className="state is-error" role="alert">
          <h3>Cannot sign in</h3>
          <p>{failure}</p>
        </div>
      )}

      {config === null && failure === null && <p className="state-quiet" aria-busy="true">Loading…</p>}

      {config?.mode === 'oidc' && (
        <>
          <p className="sub">Sign in with your Apex account.</p>
          <button
            type="button"
            className="action action-solid"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setFailure(null);
              beginSignIn(config).catch((cause: unknown) => {
                setBusy(false);
                setFailure(cause instanceof Error ? cause.message : 'Could not start the sign-in.');
              });
            }}
          >
            {busy ? 'Redirecting…' : 'Sign in'}
          </button>
        </>
      )}

      {config?.mode === 'pilot' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim().length > 0) setToken(draft);
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
          {/* Stated plainly: this deployment has no identity provider, which is
              expected locally and would be a misconfiguration anywhere else. */}
          <p className="state-quiet">
            This environment has no identity provider configured, so tokens are
            issued out of band and pasted here.
          </p>
          <button type="submit" className="action action-solid" disabled={draft.trim().length === 0}>
            Use this token
          </button>
        </form>
      )}
    </main>
  );
}
