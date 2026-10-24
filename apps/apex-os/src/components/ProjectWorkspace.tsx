import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  ProjectNoteSchema,
  type JobSummary,
  type WorkspaceProject,
} from '@apex/contracts';
import { apiSend } from '../api/client';
import { useMe, useJobInspections, useDrawSchedule } from '../api/useJobs';
import {
  useProjectNotes,
  useProjectActivity,
  useProjectWorkspace,
} from '../api/useProjectWorkspace';
import { jobTitle, formatContract } from '../lib/jobDisplay';
import Checklist from './Checklist';
import CalendarWorkspace from './CalendarWorkspace';
import Procurement from './Procurement';
import Inspections from './Inspections';
import PhotoWorkspace from './PhotoWorkspace';
import DownloadRetainedTakeoff from './DownloadRetainedTakeoff';
import {
  civilDay,
  ProjectPhaseHistorySchema,
  CONSTRUCTION_PHASES,
} from '@apex/contracts';
import { apiGet } from '../api/client';
import { useResource } from '../api/useJobs';
const tabs = [
  'Overview',
  'Tasks',
  'Calendar',
  'Photos',
  'Procurement',
  'Inspections',
  'Documents',
  'Financials',
  'Activity',
] as const;
type Tab = (typeof tabs)[number];
function Notes({ jobId, readOnly }: { jobId: string; readOnly: boolean }) {
  const query = useProjectNotes(jobId);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const retry = useRef<{ text: string; key: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (params.get('action') === 'add-note') setOpen(true);
  }, [params, location.key]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);
  function close() {
    if (busy) return;
    dialog.current?.close();
    setOpen(false);
    setError('');
    retry.current = null;
    const next = new URLSearchParams(params);
    next.delete('action');
    setParams(next, { replace: true });
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get('note')).trim();
    const key =
      retry.current?.text === text ? retry.current.key : crypto.randomUUID();
    retry.current = { text, key };
    setBusy(true);
    setError('');
    try {
      await apiSend(`/api/jobs/${jobId}/notes`, ProjectNoteSchema, {
        method: 'POST',
        body: { text },
        idempotencyKey: key,
      });
      setBusy(false);
      dialog.current?.close();
      setOpen(false);
      retry.current = null;
      const next = new URLSearchParams(params);
      next.delete('action');
      setParams(next, { replace: true });
      query.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save note.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Project notes">
      <div className="section-rule">
        <h3>Notes</h3>
        {!readOnly && (
          <button className="btn ghost" onClick={() => setOpen(true)}>
            Add note
          </button>
        )}
      </div>
      {query.loading && <p>Loading notes…</p>}
      {query.error && (
        <p role="alert">
          {query.error.message}
          <button onClick={query.reload}>Retry</button>
        </p>
      )}
      {query.data?.length === 0 && <p>No notes recorded.</p>}
      {query.data?.map((n) => (
        <article className="workspace-note" key={n.noteId}>
          <p>{n.text}</p>
          <small>
            {new Date(n.at).toLocaleString()} · {n.actor}
          </small>
        </article>
      ))}
      {open && (
        <dialog
          ref={dialog}
          aria-label="Add project note"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <form onSubmit={save}>
            <h3>Add project note</h3>
            <label>
              Note
              <textarea
                name="note"
                required
                maxLength={4000}
                autoFocus
                disabled={readOnly}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            {readOnly && <p>Project closed or cancelled · view only</p>}
            <button className="btn" disabled={busy || readOnly}>
              Save note
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
          </form>
        </dialog>
      )}
    </section>
  );
}
function Activity({ jobId }: { jobId: string }) {
  const q = useProjectActivity(jobId);
  return (
    <section>
      <h3>Activity</h3>
      {q.loading && <p>Loading activity…</p>}
      {q.error && (
        <p role="alert">
          {q.error.message}
          <button onClick={q.reload}>Retry</button>
        </p>
      )}
      {q.data?.length === 0 && <p>No recorded activity.</p>}
      {q.data?.map((a) => (
        <p key={a.id}>
          {a.title}
          <small className="workspace-audit">
            {new Date(a.at).toLocaleString()} · {a.actor ?? 'System'} ·{' '}
            {a.source}
          </small>
        </p>
      ))}
    </section>
  );
}
function InspectionTab({
  jobId,
  readOnly,
}: {
  jobId: string;
  readOnly: boolean;
}) {
  const q = useJobInspections(jobId);
  return (
    <Inspections
      jobId={jobId}
      query={q}
      today={civilDay()}
      readOnly={readOnly}
      focus={null}
      anchorId={null}
    />
  );
}
function Financials({ jobId }: { jobId: string }) {
  const q = useDrawSchedule(jobId);
  return (
    <section>
      <h3>Financials</h3>
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.loading && <p>Loading financials…</p>}
      {q.data && (
        <>
          <p>Contract {formatContract(q.data.contractCents)}</p>
          <p>Ready to bill {formatContract(q.data.eligibleUnbilledCents)}</p>
          <p>
            Invoiced (staff recorded) {formatContract(q.data.invoicedCents)}
          </p>
          <p>
            Collections, costs and profitability unavailable. QuickBooks is not
            connected.
          </p>
          <Link to={`/projects/${jobId}#draws`}>Draw operations</Link>
        </>
      )}
    </section>
  );
}
const loadPhaseHistory = (path: string, signal: AbortSignal) =>
  apiGet(path, ProjectPhaseHistorySchema, signal);
function PhaseTimeline({ jobId }: { jobId: string }) {
  const query = useResource(
    `/api/jobs/${jobId}/project/history`,
    loadPhaseHistory,
  );
  const title = (key: string) =>
    CONSTRUCTION_PHASES.find((p) => p.key === key)?.title ?? key;
  return (
    <section aria-label="Recorded stage timeline">
      <h3>Recorded stage timeline</h3>
      {query.loading && <p>Loading stage history…</p>}
      {query.error && (
        <p role="alert">
          {query.error.message}
          <button onClick={query.reload}>Retry</button>
        </p>
      )}
      {query.data?.length === 0 && <p>No stage changes recorded.</p>}
      <ol>
        {query.data?.map((p, index) => (
          <li key={index}>
            {p.fromPhaseKey ? `${title(p.fromPhaseKey)} → ` : 'Opened at '}
            {title(p.toPhaseKey)}
            <small className="workspace-audit">
              {new Date(p.occurredAt).toLocaleString()} · {p.actorUserId}
            </small>
            {p.reason && <p>{p.reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
export default function ProjectWorkspace({
  job,
  metadata: provided,
  full = false,
  readOnly = false,
  reveal = false,
}: {
  job: JobSummary;
  metadata?: WorkspaceProject;
  full?: boolean;
  readOnly?: boolean;
  reveal?: boolean;
}) {
  const [params] = useSearchParams();
  const location = useLocation();
  const metaQuery = useProjectWorkspace();
  const metadata =
    provided ?? metaQuery.data?.find((m) => m.jobId === job.jobId);
  const me = useMe();
  const [tab, setTab] = useState<Tab>('Overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ body: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({
      preventScroll: !reveal || full || !window.matchMedia('(max-width: 900px)').matches,
    });
  }, [job.jobId, full, reveal]);
  useEffect(() => {
    const action = params.get('action');
    if (action === 'add-note') setTab('Overview');
    if (action === 'add-photos') setTab('Photos');
    if (action === 'add-task') setTab('Tasks');
    if (action === 'schedule-event') setTab('Calendar');
  }, [params, location.key]);
  const immutable = readOnly || ['closed', 'cancelled'].includes(job.status);
  const manager =
    !!me.data && ['admin', 'office', 'superintendent'].includes(me.data.role);
  const financial =
    !!me.data && ['admin', 'office', 'superintendent'].includes(me.data.role);
  const office = !!me.data && ['admin', 'office'].includes(me.data.role);
  async function priority(value: string) {
    if (!metadata) return;
    setBusy(true);
    setError('');
    const body = { priority: value, expectedRevision: metadata.revision },
      encoded = JSON.stringify(body),
      key =
        retry.current?.body === encoded
          ? retry.current.key
          : crypto.randomUUID();
    retry.current = { body: encoded, key };
    try {
      await apiSend(
        `/api/jobs/${job.jobId}/priority`,
        z.object({
          jobId: z.string(),
          priority: z.string(),
          revision: z.number(),
        }),
        { method: 'POST', body, idempotencyKey: key },
      );
      retry.current = null;
      metaQuery.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save priority.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      className={`selected-project${full ? ' project-workspace-full' : ''}`}
      aria-label="Selected Project"
    >
      <div className="workspace-identity">
        <p className="workspace-eyebrow">Selected Project</p>
        <h2 tabIndex={-1} ref={heading}>
          {jobTitle(job)}
        </h2>
        <p>
          {metadata?.division ?? 'Unknown division'} · {job.status}
        </p>
        <p>
          {metadata?.stageCatalog === 'pools'
            ? (job.project?.currentPhaseTitle ?? 'Project not opened')
            : 'Stage configuration required'}
        </p>
        {financial && <p>Contract {formatContract(job.contractCents)}</p>}
        <p>
          Priority: <strong>{metadata?.priority ?? 'Unavailable'}</strong>
          {metadata?.revision === 0 && <small> (default)</small>}
        </p>
        {manager && !immutable && metadata && (
          <label>
            Project priority
            <select
              aria-label="Project priority"
              disabled={busy}
              value={metadata.priority}
              onChange={(e) => void priority(e.target.value)}
            >
              {['normal', 'high', 'urgent'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        {immutable ? (
          <p>Historical record · view only</p>
        ) : (
          <div className="workspace-actions">
            <Link
              className="btn ghost"
              to={`/checklist?action=add-task&project=${job.jobId}`}
            >
              Add Task
            </Link>
            <Link
              className="btn ghost"
              to={`/projects/${job.jobId}?action=add-photos&project=${job.jobId}`}
            >
              Add Photos
            </Link>
          </div>
        )}
      </div>
      <nav className="workspace-tabs" aria-label="Project workspace sections">
        {tabs
          .filter(
            (t) =>
              (t !== 'Financials' || financial) &&
              (t !== 'Procurement' || office),
          )
          .map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              className="btn ghost"
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
      </nav>
      <div className="workspace-tab" key={`${job.jobId}:${tab}`}>
        {tab === 'Overview' && (
          <>
            <h3>Overview</h3>
            <p>
              Current stage:{' '}
              {metadata?.stageCatalog === 'pools'
                ? (job.project?.currentPhaseTitle ?? 'Not opened')
                : 'Configuration required'}
            </p>
            <p>
              {metadata?.gates
                ? `${metadata.gates.released} / ${metadata.gates.required} required gates released`
                : 'Gate requirements unavailable for this division.'}
            </p>
            <p>
              Next milestone:{' '}
              {metadata?.stageCatalog === 'pools'
                ? job.currentGate?.status !== 'released' && job.currentGate
                  ? job.currentGate.title
                  : 'Not scheduled'
                : 'Not configured'}
            </p>
            {job.project?.targetCompletionEnd && (
              <p>Target completion {job.project.targetCompletionEnd}</p>
            )}
            {job.project?.riskNote && <p>{job.project.riskNote}</p>}
            <p className="state-quiet">
              Stage position records the current phase. Gate release is tracked
              separately.
            </p>
            {metadata?.stageCatalog === 'pools' && job.project && (
              <PhaseTimeline jobId={job.jobId} />
            )}
            <Notes jobId={job.jobId} readOnly={immutable} />
          </>
        )}
        {tab === 'Tasks' && (
          <Checklist
            jobId={job.jobId}
            scope="all"
            compact
            readOnly={immutable}
          />
        )}
        {tab === 'Calendar' && (
          <CalendarWorkspace compact jobId={job.jobId} readOnly={immutable} />
        )}
        {tab === 'Photos' && (
          <PhotoWorkspace jobId={job.jobId} readOnly={immutable} />
        )}
        {tab === 'Procurement' && office && (
          <Procurement
            jobId={job.jobId}
            readOnly={immutable}
            hasApprovedTakeoff={job.approvedTakeoffRevisionId !== null}
            anchorId={null}
          />
        )}
        {tab === 'Inspections' &&
          (metadata?.stageCatalog === 'pools' ? (
            <InspectionTab jobId={job.jobId} readOnly={immutable} />
          ) : (
            <section aria-label="Inspection configuration">
              <h3>Inspection configuration required</h3>
              <p>
                No approved inspection catalog is configured for{' '}
                {metadata?.division ?? 'this division'}.
              </p>
            </section>
          ))}
        {tab === 'Documents' && (
          <section>
            <h3>Retained documents</h3>
            {job.approvedTakeoffRevisionId ? (
              <DownloadRetainedTakeoff jobId={job.jobId} />
            ) : (
              <p>No approved takeoff retained.</p>
            )}
            {metadata?.proposalVersionId && (
              <p>
                <Link to={`/proposals/${metadata.proposalVersionId}`}>
                  Open retained signed proposal
                </Link>
              </p>
            )}
            {job.proposalId && (
              <p>
                Retained proposal ID:{' '}
                <span className="mono">{job.proposalId}</span>
              </p>
            )}
            <p>
              <Link
                to={`${immutable ? '/historical' : '/projects'}/${job.jobId}#gates`}
              >
                Gate evidence and documents
              </Link>
            </p>
          </section>
        )}
        {tab === 'Financials' && financial && <Financials jobId={job.jobId} />}
        {tab === 'Activity' && <Activity jobId={job.jobId} />}
      </div>
      <Link
        className="btn ghost workspace-operations"
        to={`${immutable ? '/historical' : '/projects'}/${job.jobId}#construction`}
      >
        {full ? 'Operations ↓' : 'Open full project / Operations'}
      </Link>
    </aside>
  );
}
