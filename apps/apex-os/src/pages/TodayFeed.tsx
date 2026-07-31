import { Link } from 'react-router';
import type { JobSummary } from '@apex/contracts';
import { useJobs } from '../api/useJobs';
import QueryState from '../components/QueryState';
import {
  GATE_STATUS_LABEL,
  formatContract,
  gateBadgeClass,
  gateSummaryLine,
  jobLocation,
  jobTitle,
} from '../lib/jobDisplay';

/**
 * Jobs whose current Gate is open. This is a status view derived from stored
 * Gate state — not the §9.5 action-card feed, which needs the card engine to
 * supply a required action, reason, consequence, and urgency per card.
 */
const needsAttention = (job: JobSummary): boolean =>
  job.currentGate !== null
  && (job.currentGate.status === 'blocked' || job.currentGate.status === 'in-progress');

function JobRow({ job }: { job: JobSummary }) {
  return (
    <div className={`action-card ${job.currentGate?.status === 'blocked' ? 'urgent' : 'info'}`}>
      <div className="card-header">
        <div>
          <div className="action-project">{jobTitle(job)}</div>
          <div className="action-location">{jobLocation(job)}</div>
        </div>
        {job.currentGate !== null && (
          <span className={`card-badge ${gateBadgeClass(job.currentGate.status)}`}>
            {GATE_STATUS_LABEL[job.currentGate.status]}
          </span>
        )}
      </div>

      <div className="action-description">{gateSummaryLine(job)}</div>

      <div className="flex items-center justify-between">
        <span className="text-muted" style={{ fontSize: '12px' }}>
          {formatContract(job.contractCents)}
        </span>
        <Link to={`/projects/${job.jobId}`} className="action-button">
          Open project
        </Link>
      </div>
    </div>
  );
}

export default function TodayFeed() {
  const { data, error, loading, reload } = useJobs();
  const jobs = data ?? [];
  const open = jobs.filter(needsAttention);
  const rest = jobs.filter((job) => !needsAttention(job));

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">Today</h1>
        {data !== null && <span className="section-count">{open.length} open</span>}
      </div>

      <QueryState
        loading={loading}
        error={error}
        isEmpty={jobs.length === 0}
        emptyTitle="Nothing to show yet"
        emptyBody="Jobs appear here once a signed proposal mints a Job ID and a gate is opened."
        onRetry={reload}
      />

      {jobs.length > 0 && (
        <p className="notice">
          Showing live Gate status. Full action cards — with required action, reason, consequence
          and urgency — arrive with the action-card engine.
        </p>
      )}

      {open.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '16px' }}>Gates open</h2>
          </div>
          {open.map((job) => <JobRow key={job.jobId} job={job} />)}
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className="section-header mt-4">
            <h2 className="section-title" style={{ fontSize: '16px' }}>Running</h2>
          </div>
          {rest.map((job) => <JobRow key={job.jobId} job={job} />)}
        </>
      )}
    </div>
  );
}
