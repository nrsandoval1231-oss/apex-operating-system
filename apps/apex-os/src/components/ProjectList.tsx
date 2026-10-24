import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { JobSummary, WorkspaceProject } from '@apex/contracts';
import { jobTitle, jobLocation, JOB_STATUS_LABEL } from '../lib/jobDisplay';
export default function ProjectList({
  jobs,
  metadata,
  onSelect,
  selected,
  dense = false,
}: {
  jobs: readonly JobSummary[];
  metadata: readonly WorkspaceProject[];
  onSelect?: (id: string) => void;
  selected?: string | null;
  dense?: boolean;
}) {
  const [params] = useSearchParams();
  const intent = params.get('action');
  const [search, setSearch] = useState(''),
    [division, setDivision] = useState(''),
    [status, setStatus] = useState(''),
    [sort, setSort] = useState('priority');
  const meta = new Map(metadata.map((m) => [m.jobId, m]));
  const rank = { normal: 0, high: 1, urgent: 2 };
  const filtered = jobs
    .filter(
      (j) =>
        !['closed', 'cancelled'].includes(j.status) &&
        (!division ||
          (meta.get(j.jobId)?.division ?? 'Unknown') === division) &&
        (!status || j.status === status) &&
        `${jobTitle(j)} ${jobLocation(j)} ${j.jobId}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? jobTitle(a).localeCompare(jobTitle(b))
        : sort === 'priority'
          ? rank[meta.get(b.jobId)?.priority ?? 'normal'] -
              rank[meta.get(a.jobId)?.priority ?? 'normal'] ||
            b.createdAt.localeCompare(a.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <section
      className={`project-list${dense ? ' project-list-dense' : ''}`}
      aria-label="Active Projects"
    >
      <div className="section-rule">
        <h2>Active Projects</h2>
        <span>{filtered.length}</span>
      </div>
      <div className="project-filters">
        <label>
          Search jobs
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, address or job ID"
          />
        </label>
        <label>
          Division
          <select
            aria-label="Division"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="">All divisions</option>
            {[
              'Designer Pools',
              'Concrete Coating',
              'Design & Renovation',
              'Pool Service',
              'Unknown',
            ].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All active statuses</option>
            {['active', 'on-hold', 'complete'].map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABEL[s as JobSummary['status']]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
            <option value="name">Customer name</option>
          </select>
        </label>
      </div>
      {!filtered.length && (
        <p className="state-quiet">
          No jobs match this view.
          {division && division !== 'Designer Pools'
            ? ' Division stage configuration is required before construction stages can be shown.'
            : ''}
        </p>
      )}
      {filtered.map((j) => {
        const m = meta.get(j.jobId);
        const content = (
          <>
            <span className="project-card-head">
              <strong>{jobTitle(j)}</strong>
              <span className="tag" data-priority={m?.priority}>
                {m?.priority ?? 'Loading priority…'}
              </span>
            </span>
            <span>{jobLocation(j)}</span>
            <span>
              {m?.division ?? 'Unknown division'} · {JOB_STATUS_LABEL[j.status]}
            </span>
            <strong>
              {m?.stageCatalog === 'pools'
                ? (j.project?.currentPhaseTitle ?? 'Project not opened')
                : 'Stage configuration required'}
            </strong>
            <span>
              {m?.gates
                ? `${m.gates.released} / ${m.gates.required} required gates released`
                : 'Gate requirements unavailable'}
            </span>
            <span>
              Next milestone:{' '}
              {m?.stageCatalog === 'pools'
                ? j.currentGate?.status !== 'released' && j.currentGate
                  ? j.currentGate.title
                  : 'Not scheduled'
                : 'Not configured'}
            </span>
            {j.project?.targetCompletionEnd && (
              <span>Target completion: {j.project.targetCompletionEnd}</span>
            )}
          </>
        );
        return onSelect ? (
          <button
            type="button"
            className="project-card"
            key={j.jobId}
            aria-pressed={selected === j.jobId}
            onClick={() => onSelect(j.jobId)}
            aria-label={`Select ${jobTitle(j)}`}
          >
            {content}
          </button>
        ) : (
          <Link
            className="project-card"
            key={j.jobId}
            to={`/projects/${j.jobId}${intent === 'add-photos' || intent === 'add-note' ? `?action=${intent}&project=${j.jobId}` : ''}`}
            aria-label={`Open ${jobTitle(j)}`}
          >
            {content}
          </Link>
        );
      })}
    </section>
  );
}
