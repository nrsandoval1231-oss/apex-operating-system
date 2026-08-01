import { Outlet, NavLink } from 'react-router';
import { setToken } from '../api/session';
import { useActionCards, useToken } from '../api/useJobs';
import SignIn from './SignIn';

/**
 * The app shell.
 *
 * Signed out shows nothing but the way in — no nav, no empty screens behind a
 * wall. Signed in, navigation sits under the thumb at phone width and moves to
 * the top once there is room for it.
 */
export default function Layout() {
  const token = useToken();
  const { data, error } = useActionCards();

  // Sign-in appears only when the server actually refuses. On a single-machine
  // pilot it never does, so there is nothing to paste and nothing in the way.
  if (error?.isAuthFailure === true) return <SignIn />;

  const needsYou = (data ?? []).filter((card) => card.group === 'needs-you').length;
  const signedInWithToken = token !== '';

  return (
    <div className="app">
      <nav className="nav">
        {/* The bar spans the screen so its rule does; the links inside stay in
            the same column as the content, or nothing on the page lines up. */}
        <div className="sheet nav-inner">
          <NavLink to="/today">
            <span>Today</span>
            {/* The count is the reason to look. It only appears when it is not zero. */}
            {needsYou > 0 && <span className="badge">{needsYou}</span>}
          </NavLink>
          <NavLink to="/projects">
            <span>Projects</span>
          </NavLink>
        </div>
      </nav>

      <div className="sheet">
        {/* Only worth a strip when there is a session to end. A local pilot has
            no credential, so showing "sign out" would offer to undo nothing. */}
        {signedInWithToken && (
          <div className="session">
            <span className="who">
              <span className="dot" aria-hidden="true" />
              Pilot session
            </span>
            <button type="button" className="link-quiet" onClick={() => setToken('')}>
              Sign out
            </button>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
