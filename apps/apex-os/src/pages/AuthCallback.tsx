import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { completeSignIn, loadAuthConfig } from '../api/auth';

/**
 * Where the identity provider sends the browser back.
 *
 * Deliberately routed outside the app shell. The shell decides what to render
 * from whether the API is refusing requests, and at this moment it is — there is
 * no token yet. Nesting this inside it would show the sign-in screen over the
 * top of the exchange that is trying to complete.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const config = await loadAuthConfig();
      if (config.mode !== 'oidc') {
        throw new Error('This environment has no identity provider configured.');
      }
      await completeSignIn(config, window.location.search);
      if (!active) return;
      // `replace`, so the back button does not return to a URL carrying a
      // one-time authorization code that has already been spent.
      navigate('/today', { replace: true });
    })().catch((cause: unknown) => {
      if (active) setFailure(cause instanceof Error ? cause.message : 'The sign-in could not be completed.');
    });
    return () => { active = false; };
  }, [navigate]);

  return (
    <main className="signin">
      <h1 className="lockup">Apex<em>OS</em></h1>
      {failure === null ? (
        <p className="state-quiet" aria-busy="true">Completing sign-in…</p>
      ) : (
        <div className="state is-error" role="alert">
          <h3>Sign-in did not complete</h3>
          <p>{failure}</p>
          <button type="button" className="action action-quiet" onClick={() => navigate('/today', { replace: true })}>
            Start again
          </button>
        </div>
      )}
    </main>
  );
}
