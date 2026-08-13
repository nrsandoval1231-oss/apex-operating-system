import { Link } from 'react-router';
import { useJobs } from '../api/useJobs';
import QueryState from '../components/QueryState';
import {
  GATE_STATUS_LABEL,
  formatContract,
  jobLocation,
  jobTitle,
  milestoneTitle,
  shortId,
} from '../lib/jobDisplay';

/**
 * Every job, newest first. A schedule of work rather than a gallery of cards:
 * the phase, the milestone, and the contract value are what distinguish one
 * pool from another at a glance.
 */
export default function Projects() {
  const { data, error, loading, reload } = useJobs('active');
  const jobs = data ?? [];

  return (
    <>
      <header className="title-block">
        <h1>Projects</h1>
        {data !== null && (
          <div className="stamp">
            Active pools
            <b>{jobs.length}</b>
          </div>
        )}
      </header>

      <QueryState
        loading={loading}
        error={error}
        isEmpty={jobs.length === 0}
        emptyTitle="No projects yet"
        emptyBody="A project appears here once a signed proposal mints a Job ID."
        onRetry={reload}
      />

      {jobs.map((job) => (
        <Link key={job.jobId} to={`/projects/${job.jobId}`} className="row settle">
          <div className="row-head">
            <div style={{ minWidth: 0 }}>
              <div className="row-who">{jobTitle(job)}</div>
              <div className="row-where">{jobLocation(job)}</div>
            </div>
            <span className="tag tag-dim">{shortId(job.jobId)}</span>
          </div>

          <h3 className="row-action">
            {job.project === null
              ? 'Not opened as a project'
              : job.project.currentPhaseTitle}
          </h3>

          <div className="row-foot">
            <span className="due">
              {job.project === null
                ? 'No phase'
                : `Phase ${job.project.currentPhaseSequence} of 11 · ${milestoneTitle(job.project.customerMilestone)}`}
            </span>
            <span className="money">{formatContract(job.contractCents)}</span>
          </div>

          {job.currentGate !== null && (
            <div className="row-foot" style={{ marginTop: '10px' }}>
              <span className="due">{job.currentGate.title}</span>
              <span className={`tag ${job.currentGate.status === 'awaiting-countersign' ? 'tag-urgent' : job.currentGate.status === 'released' ? 'tag-clear' : 'tag-dim'}`}>
                {GATE_STATUS_LABEL[job.currentGate.status]}
              </span>
            </div>
          )}
        </Link>
      ))}
    </>
  );
}
