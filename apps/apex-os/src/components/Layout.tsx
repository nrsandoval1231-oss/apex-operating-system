import { Outlet, NavLink } from 'react-router';
import { setToken } from '../api/session';
import { useActionCards, useToken } from '../api/useJobs';
import SignIn from './SignIn';

// Designer is an Apex OS workspace, served at the same origin under /app/designer.

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
          <a className="workspace-brand" href="/app/today" aria-label="Apex workspace home">APEX <span>OS</span></a>
          <NavLink to="/today">
            <span>Today</span>
            {/* The count is the reason to look. It only appears when it is not zero. */}
            {needsYou > 0 && <span className="badge">{needsYou}</span>}
          </NavLink>
          <NavLink to="/calendar">
            <span>Calendar</span>
          </NavLink>
          <NavLink to="/designer">
            <span>Designer</span>
          </NavLink>
          <NavLink to="/projects">
            <span>Projects</span>
          </NavLink>
          <NavLink to="/historical">
            <span>History</span>
          </NavLink>
          <NavLink to="/brief">
            <span>Brief</span>
          </NavLink>

        </div>
      </nav>

      <div className="sheet">
        {/* Only worth a strip when there is a session to end. A single-machine
            pilot with GATE_LOCAL_USER has no credential at all, so showing
            "sign out" there would offer to undo nothing. */}
        {signedInWithToken && (
          <div className="session">
            <span className="who">
              <span className="dot" aria-hidden="true" />
              {/* Not "pilot session": the same bar shows after a real provider
                  sign-in, and a label that names the wrong mechanism is the
                  kind of small untruth that makes people distrust the rest. */}
              Signed in
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
