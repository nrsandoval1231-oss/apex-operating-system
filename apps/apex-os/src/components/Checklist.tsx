import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  TaskSchema,
  TaskHistorySchema,
  civilDay,
  type Task,
} from '@apex/contracts';
import { apiGet, apiSend } from '../api/client';
import { useMe, useJobs, useLeadFollowupsToday } from '../api/useJobs';
import { useTasks, useTaskAssignees } from '../api/useTasks';
import './Checklist.css';
import { taskInScope, canEditTask } from '../lib/taskAccess';
type Filter =
  | 'Today'
  | 'Overdue'
  | 'Upcoming'
  | 'Assigned'
  | 'Completed'
  | 'All';
export default function Checklist({
  compact = false,
  scope = 'all',
  jobId,
  readOnly = false,
  summary = false,
}: {
  compact?: boolean;
  scope?: 'mine' | 'all';
  jobId?: string;
  readOnly?: boolean;
  summary?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const me = useMe();
  const jobs = useJobs();
  const query = useTasks(jobId);
  const users = useTaskAssignees();
  const followups = useLeadFollowupsToday(
    me.data?.role === 'admin' || me.data?.role === 'office',
  );
  const [filter, setFilter] = useState<Filter>(compact ? 'Today' : 'All');
  const [project, setProject] = useState(
    jobId ?? (scope === 'mine' ? '' : (params.get('project') ?? '')),
  );
  const [draftJob, setDraftJob] = useState(project);
  const [compose, setCompose] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof loadHistory>
  > | null>(null);
  const [intent, setIntent] = useState<{ body: string; key: string } | null>(
    null,
  );
  const completionKeys = useRef(new Map<string, string>());
  useEffect(() => {
    if (readOnly || params.get('action') !== 'add-task') return;
    setProject(params.get('project') ?? '');
    setDraftJob(params.get('project') ?? '');
    setEditing(null);
    setCompose(true);
    setIntent(null);
  }, [params, location.key]);
  const clearActionIntent = () => {
    if (params.has('action')) {
      const next = new URLSearchParams(params);
      next.delete('action');
      setParams(next, { replace: true });
    }
  };
  const loadHistory = (id: string) =>
    apiGet(`/api/tasks/${id}/history`, TaskHistorySchema);
  const today = civilDay();
  const tasks = (query.data ?? []).filter(
    (t) =>
      taskInScope(t, scope, me.data?.userId) &&
      (!jobId || t.jobId === jobId) &&
      (!project || t.jobId === project) &&
      (filter === 'Completed'
        ? !!t.completedAt
        : filter === 'All'
          ? true
          : !t.completedAt &&
            (filter === 'Today'
              ? (t.dueDate !== null && t.dueDate <= today) ||
                t.priority === 'urgent'
              : filter === 'Overdue'
                ? !!t.dueDate && t.dueDate < today
                : filter === 'Upcoming'
                  ? !!t.dueDate && t.dueDate > today
                  : t.assignedUserId === me.data?.userId)),
  );
  const jobName = (id: string | null) =>
    id
      ? (jobs.data?.find((j) => j.jobId === id)?.customerName ?? id)
      : 'Personal';
  const isClosed = (t: Task) =>
    t.jobId !== null &&
    jobs.data?.some(
      (j) =>
        j.jobId === t.jobId &&
        (j.status === 'closed' || j.status === 'cancelled'),
    );
  const userName = (id: string | null) =>
    users.data?.find((u) => u.userId === id)?.displayName ??
    (id ? 'Inactive assignee' : 'Unassigned');
  async function complete(t: Task) {
    const intentId = `${t.taskId}:${t.revision}`;
    const idempotencyKey =
      completionKeys.current.get(intentId) ?? crypto.randomUUID();
    completionKeys.current.set(intentId, idempotencyKey);
    setBusy(true);
    setError('');
    try {
      await apiSend(`/api/tasks/${t.taskId}/complete`, TaskSchema, {
        method: 'POST',
        body: { expectedRevision: t.revision },
        idempotencyKey,
      });
      completionKeys.current.delete(intentId);
      query.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete task.');
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const fields = {
      title: String(f.get('title')),
      detail: String(f.get('detail') ?? '') || null,
      assignedUserId: String(f.get('assignee') ?? '') || null,
      dueDate: String(f.get('dueDate') ?? '') || null,
      priority: String(f.get('priority')),
      milestone: String(f.get('milestone') ?? '') || null,
      recurrence: String(f.get('recurrence')),
    };
    const body = editing
      ? { ...fields, expectedRevision: editing.revision }
      : { ...fields, jobId: String(f.get('job') ?? '') || null };
    const selectedJob = String(f.get('job') ?? '');
    if (
      !editing &&
      selectedJob &&
      !jobs.data?.some(
        (j) =>
          j.jobId === selectedJob &&
          j.status !== 'closed' &&
          j.status !== 'cancelled',
      )
    ) {
      setError(
        'The selected project is unavailable. Choose an active project or explicitly choose Personal.',
      );
      return;
    }
    const encoded = JSON.stringify(body);
    const key = intent?.body === encoded ? intent.key : crypto.randomUUID();
    setIntent({ body: encoded, key });
    setBusy(true);
    setError('');
    try {
      await apiSend(
        editing ? `/api/tasks/${editing.taskId}/edit` : '/api/tasks',
        TaskSchema,
        { method: 'POST', body, idempotencyKey: key },
      );
      setCompose(false);
      setEditing(null);
      setIntent(null);
      clearActionIntent();
      query.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save task.');
    } finally {
      setBusy(false);
    }
  }
  if (summary) {
    const rank = { low: 0, normal: 1, high: 2, urgent: 3 };
    const due = (query.data ?? [])
      .filter(
        (t) =>
          taskInScope(t, scope, me.data?.userId) &&
          !t.completedAt &&
          ((t.dueDate !== null && t.dueDate <= today) ||
            t.priority === 'urgent'),
      )
      .sort(
        (a, b) =>
          rank[b.priority] - rank[a.priority] ||
          (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
          b.taskId.localeCompare(a.taskId),
      )
      .slice(0, 2);
    return (
      <section className="checklist checklist-summary" aria-label="Checklist">
        <div className="section-rule">
          <h2>My Checklist</h2>
          <Link className="action action-quiet" to="/checklist?action=add-task">
            Add task
          </Link>
        </div>
        <p className="task-summary-label">Urgent and due work</p>
        {(error || query.error) && (
          <p role="alert">
            {error || query.error?.message}
            <button className="action action-quiet" onClick={query.reload}>
              Retry
            </button>
          </p>
        )}
        {query.loading && <p>Loading tasks…</p>}
        {!query.loading && query.data && due.length === 0 && (
          <p>No urgent or due tasks.</p>
        )}
        {due.map((t) => (
          <article className="task-row" key={t.taskId}>
            <input
              type="checkbox"
              aria-label={`Complete ${t.title}`}
              checked={!!t.completedAt}
              disabled={
                busy ||
                !!t.completedAt ||
                isClosed(t) ||
                !canEditTask(t, me.data)
              }
              onChange={() => void complete(t)}
            />
            <div>
              <h3>{t.title}</h3>
              <p>
                {t.dueDate ?? 'No due date'} ·{' '}
                <span className="task-priority" data-priority={t.priority}>
                  {t.priority}
                </span>
              </p>
            </div>
          </article>
        ))}
        <Link className="action action-quiet full-checklist" to="/checklist">
          Full checklist
        </Link>
      </section>
    );
  }
  return (
    <section className="checklist" aria-label="Checklist">
      <div className="section-rule">
        <h2>{scope === 'mine' ? 'My Checklist' : 'Tasks'}</h2>
        {!readOnly && (
          <button
            className="action"
            onClick={() => {
              setEditing(null);
              setCompose(true);
              setDraftJob(project);
              setIntent(null);
            }}
          >
            Add task
          </button>
        )}
      </div>
      <div className="task-filters">
        {(
          [
            'Today',
            'Overdue',
            'Upcoming',
            'Assigned',
            'Completed',
            'All',
          ] as Filter[]
        ).map((v) => (
          <button
            key={v}
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
          >
            {v}
          </button>
        ))}
        {!jobId && (
          <label>
            Project{' '}
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All projects and personal</option>
              {jobs.data?.map((j) => (
                <option key={j.jobId} value={j.jobId}>
                  {j.customerName}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {(error || query.error || users.error || jobs.error || me.error) && (
        <p role="alert" className="error">
          {error ||
            query.error?.message ||
            users.error?.message ||
            jobs.error?.message ||
            me.error?.message}{' '}
          <button
            onClick={() => {
              query.reload();
              users.reload();
              jobs.reload();
              me.reload();
            }}
          >
            Retry loading
          </button>
        </p>
      )}
      {(compose || editing) && (!me.data || !users.data || !jobs.data) && (
        <p aria-live="polite">Loading task form…</p>
      )}
      {(compose || editing) && me.data && users.data && jobs.data && (
        <form
          className="task-form"
          key={editing?.taskId ?? `new:${project}`}
          onSubmit={save}
          onChange={() => setIntent(null)}
        >
          <h3>{editing ? 'Edit task' : 'Add task'}</h3>
          <label>
            Title
            <input
              name="title"
              required
              maxLength={240}
              defaultValue={editing?.title ?? ''}
            />
          </label>
          <label>
            Detail
            <textarea
              name="detail"
              maxLength={4000}
              defaultValue={editing?.detail ?? ''}
            />
          </label>
          {!editing && (
            <label>
              Project
              <select
                aria-label="Project"
                name="job"
                value={draftJob}
                onChange={(e) => setDraftJob(e.target.value)}
              >
                <option value="">Personal</option>
                {draftJob &&
                  !jobs.data.some(
                    (j) =>
                      j.jobId === draftJob &&
                      j.status !== 'closed' &&
                      j.status !== 'cancelled',
                  ) && (
                    <option value={draftJob}>
                      Selected project unavailable — choose another
                    </option>
                  )}
                {jobs.data
                  ?.filter(
                    (j) => j.status !== 'closed' && j.status !== 'cancelled',
                  )
                  .map((j) => (
                    <option key={j.jobId} value={j.jobId}>
                      {j.customerName}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Due date
            <input
              name="dueDate"
              type="date"
              defaultValue={editing?.dueDate ?? ''}
            />
          </label>
          <label>
            Priority
            <select
              aria-label="Priority"
              name="priority"
              defaultValue={editing?.priority ?? 'normal'}
            >
              {['low', 'normal', 'high', 'urgent'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Assigned to
            <select
              aria-label="Assigned to"
              name="assignee"
              defaultValue={
                editing ? (editing.assignedUserId ?? '') : me.data.userId
              }
            >
              <option value="">Unassigned</option>
              {editing?.assignedUserId &&
                !users.data?.some((u) => u.userId === editing.assignedUserId) && (
                  <option value={editing.assignedUserId}>
                    Current assignee (unavailable)
                  </option>
                )}
              {users.data?.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recurrence
            <select
              aria-label="Recurrence"
              name="recurrence"
              defaultValue={editing?.recurrence ?? 'none'}
            >
              {['none', 'daily', 'weekly', 'monthly'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Milestone (descriptive)
            <input
              name="milestone"
              maxLength={240}
              defaultValue={editing?.milestone ?? ''}
            />
          </label>
          <p>
            Personal tasks are shared with their assignee. Project tasks are
            visible to staff. Recurrence requires a due date.
          </p>
          <button className="action" disabled={busy || !me.data || !users.data}>
            {busy ? 'Saving…' : 'Save task'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCompose(false);
              setEditing(null);
              setIntent(null);
              clearActionIntent();
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {query.loading && <p aria-live="polite">Loading tasks…</p>}
      {!query.loading && query.data && tasks.length === 0 && (
        <p className="state-quiet">No tasks in this view.</p>
      )}
      {tasks.map((t) => (
        <article className="task-row" key={t.taskId}>
          <input
            type="checkbox"
            aria-label={`Complete ${t.title}`}
            checked={!!t.completedAt}
            disabled={
              readOnly ||
              busy ||
              !!t.completedAt ||
              isClosed(t) ||
              !canEditTask(t, me.data)
            }
            onChange={() => void complete(t)}
          />
          <div>
            <h3>{t.title}</h3>
            {isClosed(t) && <p>Project closed or cancelled · view only</p>}
            <p>
              {t.jobId ? (
                <Link to={`/projects/${t.jobId}`}>{jobName(t.jobId)}</Link>
              ) : (
                'Personal'
              )}{' '}
              · {t.dueDate ?? 'No due date'} ·{' '}
              <span className="task-priority" data-priority={t.priority}>
                {t.priority}
              </span>{' '}
              · {userName(t.assignedUserId)}
            </p>
            {t.detail && <p>{t.detail}</p>}
            {t.milestone && <p>Milestone: {t.milestone}</p>}
            {t.recurrence !== 'none' && <p>Repeats {t.recurrence}</p>}
            {t.completedAt && <p>Completed {t.completedAt.slice(0, 10)}</p>}
            <div className="task-actions">
              {!readOnly &&
                !t.completedAt &&
                !isClosed(t) &&
                canEditTask(t, me.data) && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(t);
                      setCompose(false);
                      setIntent(null);
                    }}
                  >
                    Edit
                  </button>
                )}
              <button
                disabled={busy}
                onClick={() => {
                  setError('');
                  void loadHistory(t.taskId)
                    .then(setHistory)
                    .catch((e) => setError(String(e)));
                }}
              >
                History
              </button>
            </div>
          </div>
        </article>
      ))}
      {history && (
        <aside aria-label="Task history">
          <h3>Task history</h3>
          {history.map((h, i) => (
            <p key={i}>
              {h.action} · {h.at} · {userName(h.actor)} · {h.snapshot.title} ·
              revision {h.snapshot.revision}
            </p>
          ))}
          <button onClick={() => setHistory(null)}>Close history</button>
        </aside>
      )}
      {!compact && followups.data && followups.data.length > 0 && (
        <section aria-label="Opportunity checklist links">
          <h3>Pre-contract follow-ups</h3>
          <p>
            Managed on the opportunity; these are separate from ordinary tasks.
          </p>
          {followups.data.map((f) => (
            <p key={f.leadId}>
              <Link to={`/opportunities/${f.leadId}`}>
                Opportunity · {f.customerName ?? f.leadId}:{' '}
                {f.nextAction ?? 'Set next action'}
              </Link>{' '}
              · {f.dueDate ?? 'No due date'}
            </p>
          ))}
        </section>
      )}
    </section>
  );
}
