import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  CalendarEventSchema,
  CalendarEventHistorySchema,
  civilDay,
  type CalendarEvent,
  type WorkspaceCalendarEntry,
} from '@apex/contracts';
import { apiGet, apiSend } from '../api/client';
import { useJobs, useMe } from '../api/useJobs';
import { useTaskAssignees } from '../api/useTasks';
import { useProjectWorkspace } from '../api/useProjectWorkspace';
import { useWorkspaceCalendar } from '../api/useWorkspaceCalendar';
import {
  calendarAddDays,
  compareCalendarEntries,
  calendarDates as dates,
  calendarLocalInput as localInput,
  resolveCalendarLocalInstant,
  workspaceNeedsScheduling,
} from '../lib/calendarWorkspace';
import './CalendarWorkspace.css';
type View = 'Agenda' | 'Day' | 'Week' | 'Month';
const typeLabel = (value: string) =>
  ({
    'site-visit': 'Site visit',
    'material-delivery': 'Material delivery',
    crew: 'Crew coordination',
    deadline: 'Task deadline',
    visit: 'Crew booking',
  })[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
const types = [
  'meeting',
  'site-visit',
  'installation',
  'material-delivery',
  'crew',
  'milestone',
] as const;
const title = (item: WorkspaceCalendarEntry) =>
  item.source === 'appointment'
    ? item.event.title
    : item.source === 'task'
      ? item.task.title
      : item.entry.title;
const job = (item: WorkspaceCalendarEntry) =>
  item.source === 'appointment'
    ? item.event.jobId
    : item.source === 'task'
      ? item.task.jobId
      : item.entry.jobId;
const assigned = (item: WorkspaceCalendarEntry) =>
  item.source === 'appointment'
    ? item.event.assignedUserId
    : item.source === 'task'
      ? item.task.assignedUserId
      : null;
const kind = (item: WorkspaceCalendarEntry) =>
  item.source === 'appointment'
    ? item.event.eventType
    : item.source === 'task'
      ? 'deadline'
      : item.entry.taskType;
const sourceLink = (item: WorkspaceCalendarEntry) =>
  item.source === 'task'
    ? `/checklist${item.task.jobId ? `?project=${item.task.jobId}` : ''}`
    : `/projects/${job(item)}`;
export default function CalendarWorkspace({
  compact = false,
  jobId,
  readOnly = false,
  summary = false,
}: {
  compact?: boolean;
  jobId?: string;
  readOnly?: boolean;
  summary?: boolean;
}) {
  const query = useWorkspaceCalendar();
  const jobs = useJobs();
  const users = useTaskAssignees();
  const workspace = useProjectWorkspace();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [view, setView] = useState<View>(() =>
    compact || window.matchMedia('(max-width: 700px)').matches
      ? 'Agenda'
      : 'Week',
  );
  const [cursor, setCursor] = useState(civilDay());
  const [project, setProject] = useState(
    jobId ??
      (location.pathname === '/calendar' && !params.has('action')
        ? (params.get('project') ?? '')
        : ''),
  );
  const [member, setMember] = useState('');
  const [division, setDivision] = useState('');
  const [eventType, setEventType] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(
    () => !window.matchMedia('(max-width: 700px)').matches,
  );
  const filtersId = useId();
  const activeFilters = [division, project, member, eventType].filter(
    Boolean,
  ).length;
  const [detail, setDetail] = useState<WorkspaceCalendarEntry | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [compose, setCompose] = useState(false);
  const [draftJob, setDraftJob] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<z.infer<
    typeof CalendarEventHistorySchema
  > | null>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const [moveStart, setMoveStart] = useState<string | null>(null);
  useEffect(() => {
    if ((compose || detail) && modal.current && !modal.current.open)
      modal.current.showModal();
  }, [compose, detail]);
  const retry = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    if (readOnly || params.get('action') !== 'schedule-event') return;
    setDraftJob(params.get('project') ?? '');
    setEditing(null);
    setDetail(null);
    setCompose(true);
    setAllDay(true);
    setError('');
    retry.current = null;
  }, [params, location.key]);
  const clearIntent = () => {
    const next = new URLSearchParams(params);
    next.delete('action');
    setParams(next, { replace: true });
  };
  const close = () => {
    modal.current?.close();
    setCompose(false);
    setEditing(null);
    setDetail(null);
    setHistory(null);
    setError('');
    retry.current = null;
    clearIntent();
  };
  const activeJobs = (jobs.data ?? []).filter(
    (j) => j.status !== 'closed' && j.status !== 'cancelled',
  );
  const invalidProject =
    !!draftJob && !activeJobs.some((j) => j.jobId === draftJob);
  const name = (id: string | null) =>
    id
      ? (jobs.data?.find((j) => j.jobId === id)?.customerName ?? id)
      : 'Personal';
  const userName = (id: string | null) =>
    users.data?.find((u) => u.userId === id)?.displayName ??
    (id ? 'Inactive staff' : 'Unassigned');
  const divisionByJob = new Map(
    (workspace.data ?? []).map((item) => [item.jobId, item.division]),
  );
  const itemDivision = (item: WorkspaceCalendarEntry) => {
    const id = job(item);
    return id === null ? 'personal' : (divisionByJob.get(id) ?? 'unknown');
  };
  const entries = (query.data ?? []).filter(
    (item) =>
      !(item.source === 'appointment' && item.event.cancelledAt) &&
      (!jobId || job(item) === jobId) &&
      (!project || job(item) === project) &&
      (!division ||
        (workspace.data !== null && itemDivision(item) === division)) &&
      (!member || assigned(item) === member) &&
      (!eventType || kind(item) === eventType),
  ).sort(compareCalendarEntries);
  const first =
    view === 'Month'
      ? cursor.slice(0, 7) + '-01'
      : view === 'Week'
        ? calendarAddDays(cursor, -new Date(cursor + 'T12:00:00Z').getUTCDay())
        : cursor;
  const start =
    view === 'Month'
      ? calendarAddDays(first, -new Date(first + 'T12:00:00Z').getUTCDay())
      : first;
  const days = Array.from(
    {
      length:
        view === 'Month'
          ? 42
          : view === 'Week'
            ? 7
            : view === 'Day'
              ? 1
              : compact
                ? 7
                : 31,
    },
    (_, i) => calendarAddDays(start, i),
  );
  const onDay = (day: string) =>
    entries.filter((item) => {
      const [a, b] = dates(item);
      return a !== null && b !== null && a <= day && b >= day;
    });
  const shift = (delta: number) => {
    if (view !== 'Month')
      return setCursor(
        calendarAddDays(
          cursor,
          delta * (view === 'Week' ? 7 : view === 'Agenda' ? (compact ? 7 : 31) : 1),
        ),
      );
    const d = new Date(cursor.slice(0, 7) + '-01T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + delta);
    setCursor(d.toISOString().slice(0, 10));
  };
  const open = (item: WorkspaceCalendarEntry) => {
    setMoveStart(null);
    setDetail(item);
    setHistory(null);
    setError('');
  };
  const beginEdit = (event: CalendarEvent) => {
    setEditing(event);
    setDraftJob(event.jobId ?? '');
    setAllDay(event.allDay);
    setCompose(true);
    setDetail(null);
    retry.current = null;
  };
  async function save(form: HTMLFormElement) {
    if (jobs.loading || invalidProject) return;
    const data = new FormData(form);
    try {
      setBusy(true);
      setError('');
      const startsAt = allDay
        ? null
        : resolveCalendarLocalInstant(
            String(data.get('startsAt')),
            editing?.allDay === false ? editing.startsAt : null,
          );
      const endsAt = allDay
        ? null
        : resolveCalendarLocalInstant(
            String(data.get('endsAt')),
            editing?.allDay === false ? editing.endsAt : null,
          );
      const unchangedTimes =
        editing?.allDay === false &&
        !allDay &&
        startsAt === editing.startsAt &&
        endsAt === editing.endsAt;
      const fields = {
        title: String(data.get('title')),
        note: String(data.get('note') ?? '') || null,
        eventType: data.get('eventType'),
        assignedUserId: String(data.get('assignedUserId') ?? '') || null,
        allDay,
        startsOn: allDay ? String(data.get('startsOn')) : null,
        endsOn: allDay ? String(data.get('endsOn')) : null,
        startsAt,
        endsAt,
        timezone: unchangedTimes
          ? editing.timezone
          : allDay
            ? 'America/Chicago'
            : Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(editing
          ? { expectedRevision: editing.revision }
          : { jobId: draftJob || null }),
      };
      const body = JSON.stringify(fields);
      if (retry.current?.body !== body)
        retry.current = { body, key: crypto.randomUUID() };
      const saved = await apiSend(
        editing
          ? `/api/calendar-events/${editing.eventId}/edit`
          : '/api/calendar-events',
        CalendarEventSchema,
        { method: 'POST', body: fields, idempotencyKey: retry.current.key },
      );
      setCursor(
        dates({
          source: 'appointment',
          id: `appointment:${saved.eventId}`,
          event: saved,
        })[0]!,
      );
      window.dispatchEvent(new Event('apex:data-changed'));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save appointment.');
    } finally {
      setBusy(false);
    }
  }
  async function cancel(event: CalendarEvent) {
    try {
      setBusy(true);
      setError('');
      const body = JSON.stringify({ expectedRevision: event.revision });
      if (retry.current?.body !== body)
        retry.current = { body, key: crypto.randomUUID() };
      await apiSend(
        `/api/calendar-events/${event.eventId}/cancel`,
        CalendarEventSchema,
        {
          method: 'POST',
          body: JSON.parse(body),
          idempotencyKey: retry.current.key,
        },
      );
      window.dispatchEvent(new Event('apex:data-changed'));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to cancel.');
    } finally {
      setBusy(false);
    }
  }
  async function move(
    item: WorkspaceCalendarEntry,
    startsOn: string,
    endsOn: string,
    reason: string,
  ) {
    if (
      item.source !== 'operational' ||
      !item.entry.visitId ||
      readOnly ||
      !item.entry.movable
    )
      return;
    try {
      setBusy(true);
      setError('');
      await apiSend(`/api/visits/${item.entry.visitId}/move`, z.unknown(), {
        method: 'POST',
        body: { startsOn, endsOn, reason },
      });
      window.dispatchEvent(new Event('apex:data-changed'));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to move visit.');
    } finally {
      setBusy(false);
    }
  }
  const card = (item: WorkspaceCalendarEntry) => (
    <button
      type="button"
      className={`cw-entry ${item.source === 'operational' && item.entry.conflict ? 'cw-conflict' : ''}`}
      key={item.id}
      onClick={() => open(item)}
      draggable={
        !readOnly && item.source === 'operational' && item.entry.movable
      }
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
    >
      <span className="cw-kind">
        {typeLabel(kind(item))}
        {item.source === 'operational' && item.entry.conflict
          ? ' · Conflict'
          : ''}
      </span>
      <strong>{title(item)}</strong>
      <span>
        {name(job(item))}
        {item.source === 'operational' ? ` · ${item.entry.status}` : ''}
      </span>
      {item.source === 'appointment' && !item.event.allDay && (
        <small>
          {new Date(item.event.startsAt!).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: item.event.timezone,
          })}{' '}
          · {item.event.timezone}
        </small>
      )}
    </button>
  );
  if (summary) {
    const today = civilDay();
    const appointments = entries
      .filter((item) => {
        const [start, end] = dates(item);
        return (
          item.source === 'appointment' &&
          start !== null &&
          end !== null &&
          start <= today &&
          end >= today
        );
      })
      .slice(0, 2);
    const milestones = entries
      .filter((item) => {
        const [start] = dates(item);
        return (
          start !== null &&
          start >= today &&
          (kind(item) === 'milestone' ||
            (item.source === 'operational' &&
              ['gate', 'inspection'].includes(kind(item))))
        );
      })
      .sort((a, b) => (dates(a)[0] ?? '').localeCompare(dates(b)[0] ?? ''))
      .slice(0, 2);
    const link = (item: WorkspaceCalendarEntry) => (
      <Link
        key={item.id}
        className="cw-entry"
        to={`/calendar${job(item) ? `?project=${job(item)}` : ''}`}
      >
        <span className="cw-kind">{typeLabel(kind(item))}</span>
        <strong>{title(item)}</strong>
        <span>{name(job(item))}</span>
        {item.source === 'appointment' && !item.event.allDay && (
          <small>
            {new Date(item.event.startsAt!).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: item.event.timezone,
            })}{' '}
            · {item.event.timezone}
          </small>
        )}
      </Link>
    );
    return (
      <section
        className="calendar-workspace cw-compact cw-summary"
        aria-label="Today calendar"
      >
        <h2>Today's appointments</h2>
        {query.loading && <p>Loading appointments…</p>}
        {query.error && (
          <p role="alert">
            {query.error.message}
            <button className="btn ghost" onClick={query.reload}>
              Retry
            </button>
          </p>
        )}
        {appointments.map(link)}
        {query.data && !appointments.length && <p>No appointments today.</p>}
        <Link className="btn ghost" to="/calendar">
          Full calendar
        </Link>
        <section className="cw-summary-milestones">
          <h3>Upcoming milestones</h3>
          {milestones.map(link)}
          {query.data && !milestones.length && (
            <p>No dated milestones recorded.</p>
          )}
        </section>
      </section>
    );
  }
  return (
    <section className={`calendar-workspace${compact ? ' cw-compact' : ''}`}>
      <header className="title-block">
        <div>
          <p className="cw-eyebrow">THE WORK AHEAD</p>
          {compact ? <h2>Calendar</h2> : <h1>Calendar</h1>}
          <p className="dek">
            Appointments, deadlines and operational work in one place.
          </p>
        </div>
        {!readOnly && (
          <button
            className="btn"
            onClick={() => {
              setCompose(true);
              setEditing(null);
              setDraftJob(project);
              setAllDay(true);
              setError('');
              retry.current = null;
            }}
          >
            Schedule event
          </button>
        )}
      </header>
      <div className="cw-toolbar">
        <div className="cw-views" aria-label="Calendar views">
          {(
            (compact
              ? ['Agenda', 'Week']
              : ['Agenda', 'Day', 'Week', 'Month']) as View[]
          ).map((v) => (
            <button
              className="btn ghost"
              aria-pressed={v === view}
              key={v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="cw-navigation">
          <button
            className="btn ghost"
            aria-label="Previous period"
            onClick={() => shift(-1)}
          >
            ←
          </button>
          <button className="btn ghost" onClick={() => setCursor(civilDay())}>
            Today
          </button>
          <button
            className="btn ghost"
            aria-label="Next period"
            onClick={() => shift(1)}
          >
            →
          </button>
          <label>
            Date
            <input
              aria-label="Calendar date"
              type="date"
              value={cursor}
              onChange={(e) => e.target.value && setCursor(e.target.value)}
            />
          </label>
        </div>
      </div>
      {!compact && (
        <div className="cw-filter-panel">
          <button
            className="btn ghost cw-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters ({activeFilters} active)
          </button>
        <div className="cw-filters" id={filtersId} hidden={!filtersOpen}>
          <label>
            Division
            <select
              aria-label="Division"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              disabled={workspace.data === null}
            >
              <option value="">All divisions & personal</option>
              {[
                'Designer Pools',
                'Concrete Coating',
                'Design & Renovation',
                'Pool Service',
              ].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="personal">Personal</option>
              <option value="unknown">Unknown division</option>
            </select>
          </label>
          <label>
            Project
            <select
              aria-label="Project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All projects & personal</option>
              {(jobs.data ?? []).map((j) => (
                <option value={j.jobId} key={j.jobId}>
                  {j.customerName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team member
            <select
              aria-label="Team member"
              value={member}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">Everyone</option>
              {(users.data ?? []).map((u) => (
                <option value={u.userId} key={u.userId}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Event type
            <select
              aria-label="Event type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="">All work</option>
              {[...types, 'deadline', 'visit', 'gate', 'inspection'].map(
                (t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ),
              )}
            </select>
          </label>
          {workspace.loading && <span role="status">Loading divisions…</span>}
          {workspace.error && (
            <span role="alert">
              Divisions unavailable.{' '}
              <button className="btn ghost" onClick={workspace.reload}>
                Retry
              </button>
            </span>
          )}
        </div>
        </div>
      )}
      {query.loading && <p role="status">Loading calendar…</p>}
      {query.error && (
        <p role="alert">
          {query.error.message}{' '}
          <button className="btn ghost" onClick={query.reload}>
            Retry
          </button>
        </p>
      )}
      {division && workspace.data === null && (
        <p role="status">
          {workspace.error
            ? 'Division filtering is unavailable until divisions can be loaded.'
            : 'Waiting for divisions before filtering calendar work…'}
        </p>
      )}
      <h2 className="cw-period">
        {new Date(cursor + 'T12:00:00Z').toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          ...(view === 'Day' ? { day: 'numeric' } : {}),
          timeZone: 'UTC',
        })}{' '}
        <span>{view}</span>
      </h2>
      <div
        className={`cw-days cw-${view.toLowerCase()}`}
        aria-label={`${view} calendar`}
        tabIndex={compact ? 0 : undefined}
      >
        {days
          .filter((d) => view !== 'Agenda' || onDay(d).length > 0)
          .map((day) => (
            <section
              className={`cw-day ${day === civilDay() ? 'cw-today' : ''}`}
              key={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const item = entries.find(
                  (i) => i.id === e.dataTransfer.getData('text/plain'),
                );
                if (item) {
                  setCursor(day);
                  open(item);
                  setMoveStart(day);
                }
              }}
            >
              <h3>
                <time dateTime={day}>
                  {new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: view === 'Month' ? 'short' : 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </time>
              </h3>
              {onDay(day).map(card)}
              {view === 'Day' && onDay(day).length === 0 && (
                <p className="state-quiet">No work scheduled.</p>
              )}
            </section>
          ))}
      </div>
      {!query.loading &&
        !query.error &&
        query.data !== null &&
        (!division || workspace.data !== null) &&
        view === 'Agenda' &&
        !days.some((d) => onDay(d).length) && (
          <div className="cw-empty">
            <h3>A little room ahead</h3>
            <p>
              No dated work in this period. Schedule an appointment to start
              planning.
            </p>
          </div>
        )}
      <div className={compact ? 'cw-compact-footer' : undefined}>
        {entries.some(workspaceNeedsScheduling) &&
          (compact ? (
            <details className="cw-undated cw-compact-undated">
              <summary>
                Needs scheduling ·{' '}
                {entries.filter(workspaceNeedsScheduling).length}
              </summary>
              <p>Open the project to schedule gates or inspections.</p>
              {entries.filter(workspaceNeedsScheduling).slice(0, 4).map(card)}
            </details>
          ) : (
            <section className="cw-undated">
              <h2>Needs scheduling</h2>
              <p>
                Open the authoritative project to schedule gates or inspections.
              </p>
              {entries.filter(workspaceNeedsScheduling).map(card)}
            </section>
          ))}
        {compact && (
          <Link
            className="btn ghost cw-full-calendar"
            to={`/calendar${jobId ? `?project=${jobId}` : ''}`}
          >
            Full calendar
          </Link>
        )}
      </div>
      {(compose || detail) && (
        <dialog
          ref={modal}
          aria-label={
            compose
              ? editing
                ? 'Edit event'
                : 'Schedule event'
              : 'Event details'
          }
          className="cw-overlay"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) close();
          }}
        >
          <section
            className="cw-dialog"
            aria-label={
              compose
                ? editing
                  ? 'Edit event'
                  : 'Schedule event'
                : 'Event details'
            }
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !busy) close();
            }}
          >
            <button
              autoFocus
              type="button"
              className="btn ghost cw-close"
              aria-label="Close dialog"
              disabled={busy}
              onClick={close}
            >
              ✕
            </button>
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
            {compose ? (
              <>
                <p className="cw-eyebrow">MAKE A PLAN</p>
                <h2>{editing ? 'Edit event' : 'Schedule event'}</h2>
                <p className="cw-help">
                  Ordinary coordination only. Crew bookings and inspections stay
                  in their project workflow.
                </p>
                {jobs.loading || users.loading ? (
                  <p role="status">Loading project and staff choices…</p>
                ) : jobs.error || users.error ? (
                  <p role="alert">
                    Project or staff choices unavailable. Retry after reloading.
                  </p>
                ) : (
                  <form
                    key={editing?.eventId ?? location.key}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(e.currentTarget);
                    }}
                  >
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
                      Project
                      <select
                        aria-label="Event project"
                        value={draftJob}
                        disabled={!!editing}
                        onChange={(e) => setDraftJob(e.target.value)}
                      >
                        <option value="">Personal</option>
                        {invalidProject && (
                          <option value={draftJob}>
                            Unavailable selected project
                          </option>
                        )}
                        {activeJobs.map((j) => (
                          <option key={j.jobId} value={j.jobId}>
                            {j.customerName}
                          </option>
                        ))}
                      </select>
                    </label>
                    {invalidProject && (
                      <p role="alert">
                        The selected project is unavailable or closed. Choose an
                        active project or explicitly choose Personal.
                      </p>
                    )}
                    <div className="cw-form-pair">
                      <label>
                        Event type
                        <select
                          name="eventType"
                          defaultValue={editing?.eventType ?? 'meeting'}
                        >
                          {types.map((t) => (
                            <option key={t} value={t}>
                              {typeLabel(t)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Assigned staff
                        <select
                          aria-label="Assigned staff"
                          name="assignedUserId"
                          defaultValue={editing?.assignedUserId ?? ''}
                        >
                          <option value="">Unassigned</option>
                          {editing?.assignedUserId &&
                            !users.data?.some(
                              (u) => u.userId === editing.assignedUserId,
                            ) && (
                              <option value={editing.assignedUserId}>
                                Inactive assignee · choose active staff
                              </option>
                            )}
                          {(users.data ?? []).map((u) => (
                            <option key={u.userId} value={u.userId}>
                              {u.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="cw-checkbox">
                      <input
                        type="checkbox"
                        checked={allDay}
                        onChange={(e) => setAllDay(e.target.checked)}
                      />
                      All day
                    </label>
                    {allDay ? (
                      <div className="cw-form-pair">
                        <label>
                          Starts on
                          <input
                            type="date"
                            name="startsOn"
                            required
                            defaultValue={editing?.startsOn ?? cursor}
                          />
                        </label>
                        <label>
                          Ends on
                          <input
                            type="date"
                            name="endsOn"
                            required
                            defaultValue={editing?.endsOn ?? cursor}
                          />
                        </label>
                      </div>
                    ) : (
                      <>
                        <div className="cw-form-pair">
                          <label>
                            Starts at
                            <input
                              type="datetime-local"
                              name="startsAt"
                              required
                              defaultValue={localInput(
                                editing?.startsAt ?? null,
                              )}
                            />
                          </label>
                          <label>
                            Ends at
                            <input
                              type="datetime-local"
                              name="endsAt"
                              required
                              defaultValue={localInput(editing?.endsAt ?? null)}
                            />
                          </label>
                        </div>
                        <p className="cw-help">
                          Enter local time ·{' '}
                          {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                          The saved event records this timezone.
                        </p>
                      </>
                    )}
                    <label>
                      Note
                      <textarea
                        name="note"
                        maxLength={4000}
                        rows={3}
                        defaultValue={editing?.note ?? ''}
                      />
                    </label>
                    <button
                      className="btn"
                      type="submit"
                      disabled={busy || invalidProject}
                    >
                      {busy ? 'Saving…' : 'Save event'}
                    </button>
                  </form>
                )}
              </>
            ) : (
              detail && (
                <>
                  <p className="cw-eyebrow">{typeLabel(kind(detail))}</p>
                  <h2>{title(detail)}</h2>
                  <p>{name(job(detail))}</p>
                  <p>
                    {dates(detail)[0] ?? 'Not scheduled'}
                    {dates(detail)[1] !== dates(detail)[0]
                      ? ` → ${dates(detail)[1]}`
                      : ''}
                  </p>
                  {detail.source === 'appointment' ? (
                    <>
                      <p>
                        {detail.event.allDay
                          ? 'All day'
                          : `${new Date(detail.event.startsAt!).toLocaleString('en-US', { timeZone: detail.event.timezone })} → ${new Date(detail.event.endsAt!).toLocaleString('en-US', { timeZone: detail.event.timezone })}`}{' '}
                        · {detail.event.timezone}
                      </p>
                      <p>Assigned to {userName(detail.event.assignedUserId)}</p>
                      <p className="cw-note">{detail.event.note}</p>
                      {detail.event.eventType === 'crew' && (
                        <p className="notice">
                          Crew coordination · does not reserve subcontractor
                          capacity.
                        </p>
                      )}
                      {!readOnly &&
                        (detail.event.createdBy === me.data?.userId ||
                          detail.event.assignedUserId === me.data?.userId ||
                          (detail.event.jobId &&
                            ['admin', 'office', 'superintendent'].includes(
                              me.data?.role ?? '',
                            ))) && (
                          <div className="cw-actions">
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => beginEdit(detail.event)}
                            >
                              Edit event
                            </button>
                            <button
                              className="btn ghost"
                              disabled={busy}
                              onClick={() => void cancel(detail.event)}
                            >
                              Cancel event
                            </button>
                          </div>
                        )}
                      <button
                        className="btn ghost"
                        onClick={() =>
                          void apiGet(
                            `/api/calendar-events/${detail.event.eventId}/history`,
                            CalendarEventHistorySchema,
                          )
                            .then(setHistory)
                            .catch((e) => setError(e.message))
                        }
                      >
                        View history
                      </button>
                      {history && (
                        <ol className="cw-history">
                          {history.map((h) => (
                            <li key={h.snapshot.revision}>
                              {h.action} · revision {h.snapshot.revision}
                              <br />
                              <small>
                                {new Date(h.at).toLocaleString()} ·{' '}
                                {userName(h.actor)}
                              </small>
                            </li>
                          ))}
                        </ol>
                      )}
                    </>
                  ) : (
                    <>
                      <p>
                        {detail.source === 'task'
                          ? 'Read-only task deadline. Manage the task in Checklist.'
                          : 'Operational schedule. Its project workflow remains authoritative.'}
                      </p>
                      <Link className="btn" to={sourceLink(detail)}>
                        Open{' '}
                        {detail.source === 'task' ? 'Checklist' : 'project'}
                      </Link>
                      {detail.source === 'operational' &&
                        detail.entry.conflict && (
                          <p className="notice">
                            Conflict · review crew availability and gate
                            restrictions in the project.
                          </p>
                        )}
                      {detail.source === 'operational' &&
                        !readOnly &&
                        detail.entry.movable &&
                        detail.entry.visitId && (
                          <form
                            className="cw-move"
                            key={`${detail.entry.visitId}:${moveStart ?? 'original'}`}
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              void move(
                                detail,
                                String(f.get('start')),
                                String(f.get('end')),
                                String(f.get('reason')),
                              );
                            }}
                          >
                            <h3>Move crew booking</h3>
                            <label>
                              New start
                              <input
                                name="start"
                                type="date"
                                required
                                defaultValue={
                                  moveStart ?? detail.entry.startsOn ?? cursor
                                }
                              />
                            </label>
                            <label>
                              New end
                              <input
                                name="end"
                                type="date"
                                required
                                defaultValue={
                                  detail.entry.startsOn && detail.entry.endsOn
                                    ? calendarAddDays(
                                        moveStart ?? detail.entry.startsOn,
                                        Math.round(
                                          (Date.parse(detail.entry.endsOn) -
                                            Date.parse(detail.entry.startsOn)) /
                                            86400000,
                                        ),
                                      )
                                    : cursor
                                }
                              />
                            </label>
                            <label>
                              Reason
                              <input
                                name="reason"
                                minLength={3}
                                maxLength={2000}
                                required
                              />
                            </label>
                            <button className="btn" disabled={busy}>
                              Save move
                            </button>
                          </form>
                        )}
                    </>
                  )}
                </>
              )
            )}
          </section>
        </dialog>
      )}
    </section>
  );
}
