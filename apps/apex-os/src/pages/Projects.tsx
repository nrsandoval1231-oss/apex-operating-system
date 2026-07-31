import { Link } from 'react-router';
import { useJobs } from '../api/useJobs';
import QueryState from '../components/QueryState';
import {
  GATE_STATUS_LABEL,
  JOB_STATUS_LABEL,
  formatContract,
  gateBadgeClass,
  gateSummaryLine,
  jobLocation,
  jobTitle,
} from '../lib/jobDisplay';

export default function Projects() {
  const { data, error, loading, reload } = useJobs();
  const jobs = data ?? [];

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">Projects</h1>
        {data !== null && <span className="section-count">{jobs.length} total</span>}
      </div>

      <QueryState
        loading={loading}
        error={error}
        isEmpty={jobs.length === 0}
        emptyTitle="No projects yet"
        emptyBody="A project appears here once a signed proposal mints a Job ID."
        onRetry={reload}
      />

      {jobs.map((job) => (
        <Link
          key={job.jobId}
          to={`/projects/${job.jobId}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="card" style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div>
                <div className="card-title">{jobTitle(job)}</div>
                <div className="text-muted" style={{ fontSize: '12px' }}>{jobLocation(job)}</div>
                <div className="text-muted" style={{ fontSize: '12px' }}>Job {job.jobId.slice(-6)}</div>
              </div>
              <span className={`card-badge ${job.status === 'active' ? 'badge-success' : 'badge-info'}`}>
                {JOB_STATUS_LABEL[job.status]}
              </span>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                {job.currentGate?.phase ?? 'No phase recorded'}
              </span>
              {job.currentGate !== null && (
                <span className={`card-badge ${gateBadgeClass(job.currentGate.status)}`}>
                  {GATE_STATUS_LABEL[job.currentGate.status]}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {gateSummaryLine(job)}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {formatContract(job.contractCents)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
