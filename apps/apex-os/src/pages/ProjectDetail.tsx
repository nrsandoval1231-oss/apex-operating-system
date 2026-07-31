import { Link, useParams } from 'react-router';
import { useJob } from '../api/useJobs';
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

/** Facts the project record still needs, in the order they are being built. */
const PENDING = [
  ['Construction phases', 'The 15-phase model and 6 customer milestones.'],
  ['Gate checklist and evidence', 'Per-requirement evidence capture and signoff, generalized past pre-gunite.'],
  ['Inspections and crew visits', 'Deadlines, jurisdictions, and same-crew conflict detection.'],
  ['Draw schedule', 'Draw release conditions and ready-to-bill confirmation.'],
  ['Customer progress page', 'Tokenized link, approved photos, and access log.'],
] as const;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error, loading, reload } = useJob(id);

  const state = (
    <QueryState
      loading={loading}
      error={error}
      isEmpty={false}
      emptyTitle=""
      emptyBody=""
      onRetry={reload}
    />
  );

  if (job === null) {
    return (
      <div>
        <Link to="/projects" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Back</Link>
        {state}
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="flex items-center justify-between mb-2">
          <Link to="/projects" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Back</Link>
          <span className={`card-badge ${job.status === 'active' ? 'badge-success' : 'badge-info'}`}>
            {JOB_STATUS_LABEL[job.status]}
          </span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{jobTitle(job)}</h1>
        <div className="text-muted">{jobLocation(job)}</div>
        <div className="text-muted" style={{ fontSize: '12px' }}>Job {job.jobId}</div>
        <div className="mt-4" style={{ fontSize: '18px', fontWeight: 600 }}>
          {formatContract(job.contractCents)}
        </div>
      </div>

      <div className="card">
        <div className="section-header" style={{ marginBottom: '12px', marginTop: 0 }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Current gate</h2>
          {job.currentGate !== null && (
            <span className={`card-badge ${gateBadgeClass(job.currentGate.status)}`}>
              {GATE_STATUS_LABEL[job.currentGate.status]}
            </span>
          )}
        </div>
        <p style={{ fontSize: '14px' }}>{gateSummaryLine(job)}</p>
        {job.currentGate !== null && (
          <dl className="fact-list">
            <div><dt>Phase</dt><dd>{job.currentGate.phase}</dd></div>
            <div><dt>Definition</dt><dd>{job.currentGate.definitionKey} v{job.currentGate.definitionVersion}</dd></div>
            <div>
              <dt>Customer milestone</dt>
              <dd>{job.currentGate.customerMilestone ?? 'Not mapped'}</dd>
            </div>
          </dl>
        )}
        <p className="notice mt-2">
          Checklist, evidence capture, and signoff run in the Gate field console for this pilot.
          They move into this screen when the gate engine is generalized past pre-gunite.
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Approved takeoff</h2>
        <p style={{ fontSize: '14px' }}>
          {job.approvedTakeoffRevisionId === null
            ? 'No approved Designer takeoff revision. A gate cannot open without one.'
            : `Revision ${job.approvedTakeoffRevisionId}`}
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Not built yet</h2>
        <dl className="fact-list">
          {PENDING.map(([title, detail]) => (
            <div key={title}><dt>{title}</dt><dd>{detail}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}
