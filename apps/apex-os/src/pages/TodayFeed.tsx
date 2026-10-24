import { useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useActionCards, useJobs, useMe } from '../api/useJobs';
import { useProjectWorkspace } from '../api/useProjectWorkspace';
import Checklist from '../components/Checklist';
import CalendarWorkspace from '../components/CalendarWorkspace';
import ProjectList from '../components/ProjectList';
import ProjectWorkspace from '../components/ProjectWorkspace';
import QueryState from '../components/QueryState';
import '../components/ProjectWorkspace.css';
const mobileSnapshot = () => window.matchMedia('(max-width:900px)').matches;
const subscribeViewport = (listener: () => void) => {
  const media = window.matchMedia('(max-width:900px)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};
function Attention({
  query: actions,
}: {
  query: ReturnType<typeof useActionCards>;
}) {
  return (
    <section
      className="workspace-attention"
      aria-label="Jobs needing attention"
    >
      <div className="section-rule">
        <h2>Jobs needing attention</h2>
      </div>
      {actions.loading && <p>Loading attention items…</p>}
      {actions.error && (
        <p role="alert">
          {actions.error.message}
          <button onClick={actions.reload}>Retry</button>
        </p>
      )}
      {actions.data
        ?.filter((c) => c.group === 'needs-you')
        .slice(0, 4)
        .map((c) => (
          <Link
            className="workspace-attention-card"
            key={c.cardId}
            to={c.actionHref}
          >
            <strong>{c.title}</strong>
            <span>{c.customerName}</span>
            <span>{c.reason}</span>
            <small>{c.actionLabel}</small>
          </Link>
        ))}
      {actions.data && !actions.data.some((c) => c.group === 'needs-you') && (
        <p>No recorded items need a decision.</p>
      )}
    </section>
  );
}
export default function TodayFeed() {
  const mobile = useSyncExternalStore(
    subscribeViewport,
    mobileSnapshot,
    () => false,
  );
  const me = useMe(),
    jobs = useJobs(),
    metadata = useProjectWorkspace(),
    actions = useActionCards();
  const [params, setParams] = useSearchParams();
  const selected = params.get('project');
  const job = jobs.data?.find((j) => j.jobId === selected);
  return (
    <div className="command-center">
      <header className="workspace-greeting">
        <div>
          <h1>Today</h1>
          <p>
            {me.data
              ? `Good day, ${me.data.displayName.split(' ')[0]}.`
              : 'Your workspace'}
          </p>
        </div>
        <time>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </header>
      <div className="workspace-columns">
        <div className="workspace-checklist">
          <Checklist compact scope="mine" summary={mobile} />
        </div>
        <div className="workspace-center">
          <CalendarWorkspace compact summary={mobile} />
          {mobile && <Attention query={actions} />}
          <ProjectList
            dense
            jobs={jobs.data ?? []}
            metadata={metadata.data ?? []}
            selected={selected}
            onSelect={(id) => {
              const next = new URLSearchParams(params);
              next.set('project', id);
              next.delete('action');
              setParams(next);
            }}
          />
          <QueryState
            loading={jobs.loading || metadata.loading}
            error={jobs.error ?? metadata.error}
            isEmpty={false}
            emptyTitle=""
            emptyBody=""
            onRetry={() => {
              jobs.reload();
              metadata.reload();
            }}
          />
          {!mobile && <Attention query={actions} />}
        </div>
        {job ? (
          <ProjectWorkspace
            key={job.jobId}
            job={job}
            metadata={metadata.data?.find((m) => m.jobId === job.jobId)}
          />
        ) : (
          <aside
            className="selected-project workspace-unselected"
            aria-label="Selected Project"
          >
            <h2>Selected Project</h2>
            <p>
              {selected && !jobs.loading
                ? 'Project unavailable. Choose a project from the list.'
                : 'Choose a project to see its workspace.'}
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
