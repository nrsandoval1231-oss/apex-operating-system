import { Link, useSearchParams } from 'react-router';
import { useJobs } from '../api/useJobs';
import { useProjectWorkspace } from '../api/useProjectWorkspace';
import ProjectList from '../components/ProjectList';
import QueryState from '../components/QueryState';
import '../components/ProjectWorkspace.css';
export default function Projects() {
  const jobs = useJobs(),
    metadata = useProjectWorkspace();
  const [params, setParams] = useSearchParams();
  const action = params.get('action');
  return (
    <div className="jobs-workspace">
      <header className="workspace-greeting">
        <div>
          <h1>Jobs</h1>
          <p>Your active project workspaces.</p>
        </div>
      </header>
      {(action === 'add-note' || action === 'add-photos') && (
        <section className="project-chooser" aria-label="Choose a project">
          <h2>Choose a project</h2>
          <p>
            {action === 'add-note'
              ? 'Select a project for your note.'
              : 'Select a project for photos.'}
          </p>
          {jobs.data
            ?.filter((j) => !['closed', 'cancelled'].includes(j.status))
            .map((j) => (
              <Link
                className="btn ghost"
                key={j.jobId}
                to={`/projects/${j.jobId}?action=${action}&project=${j.jobId}`}
              >
                {j.customerName ?? j.jobId}
              </Link>
            ))}
          <button
            className="btn ghost"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('action');
              setParams(next, { replace: true });
            }}
          >
            Cancel
          </button>
        </section>
      )}
      <QueryState
        loading={jobs.loading || metadata.loading}
        error={jobs.error ?? metadata.error}
        isEmpty={jobs.data !== null && jobs.data.length === 0}
        emptyTitle="No projects yet"
        emptyBody="A project appears after a signed proposal creates its Job ID."
        onRetry={() => {
          jobs.reload();
          metadata.reload();
        }}
      />
      <ProjectList jobs={jobs.data ?? []} metadata={metadata.data ?? []} />
    </div>
  );
}
