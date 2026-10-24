import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, NavLink, useLocation } from 'react-router';
import { setToken } from '../api/session';
import { useMe, useToken, type StaffSession } from '../api/useJobs';
import { clearPendingReads } from '../api/client';
import SignIn from './SignIn';
import Icon, { type IconName } from './Icon';

const ROLE_LABEL: Readonly<Record<string, string>> = {
  admin: 'Admin', office: 'Office', superintendent: 'Superintendent', field: 'Field', customer: 'Customer',
};
const destinations: { to: string; label: string; icon: IconName }[] = [
  { to: '/today', label: 'Today', icon: 'today' },
  { to: '/checklist', label: 'Checklist', icon: 'checklist' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/projects', label: 'Jobs', icon: 'jobs' },
  { to: '/more', label: 'More', icon: 'more' },
];
const actions: { label: string; icon: IconName; to: string; intent: string }[] = [
  { label: 'Add Photos', icon: 'photo', to: '/projects', intent: 'add-photos' },
  { label: 'Add Task', icon: 'checklist', to: '/checklist', intent: 'add-task' },
  { label: 'Add Note', icon: 'note', to: '/projects', intent: 'add-note' },
  { label: 'Schedule Event', icon: 'calendar', to: '/calendar', intent: 'schedule-event' },
];

export default function Layout() {
  const token = useToken();
  // Remount protected views on identity changes: stale data must never survive sign-out.
  return <AuthenticatedShell key={token} token={token} />;
}

function AuthenticatedShell({ token }: { token: string }) {
  const me = useMe();
  if (me.error?.isAuthFailure || me.error?.status === 401) return <SignIn />;
  if (me.data === null) return <div className="shell-status" role="status">
    <img src={`${import.meta.env.BASE_URL}brand/official-apex-logo.png`} alt="APEX" />
    {me.loading ? <p>Opening your workspace…</p> : <><p>Unable to open your workspace. {me.error?.message}</p><button type="button" className="btn" onClick={me.reload}>Try again</button></>}
  </div>;
  // Provider/cookie sessions may change actor while the pilot token stays empty.
  return <ActorShell key={JSON.stringify([me.data.userId, me.data.role])} token={token} actor={me.data} />;
}

function ActorShell({ token, actor }: { token: string; actor: StaffSession }) {
  // This runs before child resource effects. Do not dispatch data-changed here:
  // /me itself is a resource and a notification would create a refresh loop.
  useLayoutEffect(() => clearPendingReads(), []);
  const location = useLocation();
  const [quickOpen, setQuickOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const quickPanel = useRef<HTMLDivElement>(null);
  const lastLocation = useRef(location);
  const routeProject = /^\/projects\/([^/]+)/.exec(location.pathname)?.[1];
  let project = new URLSearchParams(location.search).get('project');
  if (routeProject) {
    try { project = decodeURIComponent(routeProject); } catch { project = routeProject; }
  }
  const moreActive = ['/more', '/designer', '/historical', '/brief'].some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));

  useEffect(() => {
    if (lastLocation.current !== location) {
      setQuickOpen(false);
      lastLocation.current = location;
    }
  }, [location]);
  useEffect(() => {
    if (!quickOpen) return;
    quickPanel.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setQuickOpen(false); trigger.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !quickPanel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setQuickOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); };
  }, [quickOpen]);

  return (
    <div className="app apex-shell">
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <header className="shell-header">
        <Link className="shell-brand" to="/today" aria-label="APEX 2.0 home">
          <img src={`${import.meta.env.BASE_URL}brand/official-apex-logo.png`} alt="" />
          <span>APEX <strong>2.0</strong></span>
        </Link>
        <nav className="shell-nav" aria-label="Main navigation">
          {destinations.map(item => item.to === '/more'
            ? <Link key={item.to} to={item.to} className={`shell-destination${moreActive ? ' selected' : ''}`} aria-current={moreActive ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>
            : <NavLink key={item.to} to={item.to} className={({ isActive }) => `shell-destination${isActive ? ' selected' : ''}`}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}
        </nav>
        <div className="shell-identity">
          <span className="shell-user">{actor.displayName}<small>{ROLE_LABEL[actor.role] ?? actor.role}</small></span>
          {token !== '' && <button type="button" className="shell-signout" onClick={() => { setQuickOpen(false); setToken(''); }}>Sign out</button>}
        </div>
      </header>
      <div id="workspace-content" className="sheet shell-content" tabIndex={-1}><Outlet /></div>
      {!/^\/historical\/[^/]+/.test(location.pathname) && <div className="shell-quick">
        {quickOpen && <div ref={quickPanel} id="quick-actions" className="quick-panel" aria-label="Quick actions" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) setQuickOpen(false);
        }}>
          <span className="quick-heading">Quick actions</span>
          {actions.map(action => {
            const query = new URLSearchParams({ action: action.intent });
            if (project) query.set('project', project);
            const to = project && (action.intent === 'add-photos' || action.intent === 'add-note') ? `/projects/${encodeURIComponent(project)}` : action.to;
            return <Link key={action.intent} to={`${to}?${query}`} onClick={() => setQuickOpen(false)}><Icon name={action.icon} />{action.label}</Link>;
          })}
        </div>}
        <button ref={trigger} type="button" className="quick-trigger" aria-label={quickOpen ? 'Close quick actions' : 'Open quick actions'} aria-expanded={quickOpen} aria-controls="quick-actions" onClick={() => setQuickOpen(open => !open)}>
          <Icon name={quickOpen ? 'close' : 'plus'} size={26} /><span>Quick add</span>
        </button>
      </div>}
    </div>
  );
}
