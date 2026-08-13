import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useJobs } from '../api/useJobs';
import QueryState from '../components/QueryState';
import { formatContract, jobLocation, jobTitle, shortId } from '../lib/jobDisplay';

/** Read-only index of completed and closed jobs retained for historical reference. */
export default function HistoricalProjects() {
  const { data, error, loading, reload } = useJobs('historical');
  const [query, setQuery] = useState('');
  const jobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return data ?? [];
    return (data ?? []).filter((job) => [
      job.customerName,
      job.addressLine,
      job.jobId,
      job.leadId,
      job.proposalId,
    ].some((value) => value?.toLowerCase().includes(needle)));
  }, [data, query]);

  return (
    <>
      <header className="title-block">
        <div>
          <p className="eyebrow">ARCHIVE / HISTORICAL JOBS</p>
          <h1>Historical jobs</h1>
          <p className="lede">Completed and closed work remains available for reference. Historical records are read-only.</p>
        </div>
        {data !== null && <div className="stamp">Saved jobs<b>{data.length}</b></div>}
      </header>
      <label className="archive-search">
        <span>Search customer, address, Job ID, lead ID, or proposal ID</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search historical jobs" />
      </label>
      <QueryState loading={loading} error={error} isEmpty={jobs.length === 0} emptyTitle={query ? 'No matching historical jobs' : 'No historical jobs yet'} emptyBody={query ? 'Try a customer name, address, Job ID, lead ID, or proposal ID.' : 'A project appears here after it is explicitly closed and archived.'} onRetry={reload} />
      {jobs.map((job) => (
        <Link key={job.jobId} to={`/historical/${job.jobId}`} className="row settle archive-row">
          <div className="row-head">
            <div style={{ minWidth: 0 }}>
              <div className="row-who">{jobTitle(job)}</div>
              <div className="row-where">{jobLocation(job)}</div>
            </div>
            <span className="tag tag-clear">{job.status}</span>
          </div>
          <h3 className="row-action">Historical record</h3>
          <div className="row-foot"><span className="due">{shortId(job.jobId)} · Read-only reference</span><span className="money">{formatContract(job.contractCents)}</span></div>
        </Link>
      ))}
    </>
  );
}
