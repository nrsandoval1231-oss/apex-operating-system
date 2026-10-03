import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { civilDay } from '@apex/contracts';
import { apiSend } from '../api/client';
import { useCalendar } from '../api/useJobs';
import QueryState from '../components/QueryState';
import { needsScheduling } from '../lib/calendarDisplay';

/** Add calendar days to a YYYY-MM-DD string. UTC noon keeps the civil day stable. */
const addDays = (iso: string, days: number): string => {
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(year!, (month! - 1), day! + days, 12));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const weekday = (iso: string): number => new Date(`${iso}T12:00:00Z`).getUTCDay();
const monthLabel = (cursor: string) => {
  const [year, month] = cursor.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
};
const shiftMonth = (cursor: string, delta: number): string => {
  const [year, month] = cursor.split('-').map(Number);
  const next = new Date(Date.UTC(year!, month! - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
};
const daySpan = (entry: { startsOn: string; endsOn: string }) => Math.round(
  (Date.parse(`${entry.endsOn}T12:00:00Z`) - Date.parse(`${entry.startsOn}T12:00:00Z`)) / 86400000,
);

type CalendarEntry = ReturnType<typeof useCalendar>['data'] extends readonly (infer Entry)[] | null ? Entry : never;

export default function Calendar() {
  const calendar = useCalendar();
  const [month, setMonth] = useState(() => civilDay().slice(0, 7));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const firstOfMonth = `${month}-01`;
  const gridStart = addDays(firstOfMonth, -weekday(firstOfMonth));
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const entries = calendar.data ?? [];
  const unscheduledEntries = entries.filter(needsScheduling);
  const monthPrefix = month;

  const datedEntries = entries.filter((entry): entry is CalendarEntry & { startsOn: string; endsOn: string } => entry.startsOn !== null && entry.endsOn !== null);
  const monthEntries = datedEntries.filter((entry) => entry.startsOn.startsWith(monthPrefix));
  const byDay = useMemo(() => {
    const map = new Map<string, readonly (CalendarEntry & { startsOn: string; endsOn: string })[]>();
    for (const entry of datedEntries) {
      for (let day = entry.startsOn; day <= entry.endsOn; day = addDays(day, 1)) {
        const key = day;
        map.set(key, [...(map.get(key) ?? []), entry]);
      }
    }
    return map;
  }, [datedEntries]);

  const moveEntry = async (entry: CalendarEntry & { startsOn: string; endsOn: string }, targetDay: string) => {
    if (!entry.movable || entry.visitId === null) return;
    const span = daySpan(entry);
    const ends = addDays(targetDay, span);
    if (entry.startsOn === targetDay) return;
    setSavingId(entry.visitId);
    setMessage(null);
    try {
      await apiSend(`/api/visits/${entry.visitId}/move`, z.unknown(), {
        method: 'POST',
        body: { startsOn: targetDay, endsOn: ends, reason: 'Moved from Apex Calendar.' },
      });
      window.dispatchEvent(new Event('apex:data-changed'));
      setMessage(`${entry.customerName} moved to ${targetDay}. Today, Project, and Gate schedule reads will refresh.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The task could not be moved.');
    } finally {
      setSavingId(null);
      setDraggedId(null);
    }
  };

  return (
    <>
      <header className="title-block calendar-title-block">
        <div>
          <h1>Calendar</h1>
          <p className="dek">Move scheduled work once; Projects and Today stay aligned · conflicts stay visible</p>
        </div>
        <div className="calendar-controls">
          <button className="btn ghost" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</button>
          <strong>{monthLabel(month)}</strong>
          <button className="btn ghost" onClick={() => setMonth(shiftMonth(month, 1))}>Next</button>
        </div>
      </header>

      {message !== null && <p className="notice" role="status">{message}</p>}
      <QueryState loading={calendar.loading} error={calendar.error} isEmpty={entries.length === 0} emptyTitle="No scheduled work" emptyBody="Active jobs have no crew visits on the schedule." onRetry={calendar.reload} />

      {entries.length > 0 && <>
        <div className="calendar-legend">
          <span><i className="calendar-dot" /> Scheduled work</span>
          <span><i className="calendar-dot conflict" /> Conflict</span>
          <span>Gunite/shotcrete occupies one day</span>
          {savingId !== null && <span>Saving move…</span>}
        </div>
        {unscheduledEntries.length > 0 && <section className="calendar-unscheduled" aria-label="Tasks needing scheduling">
          <h2>Needs scheduling</h2>
          <p>These project tasks exist but do not have an operational date yet.</p>
          <div className="calendar-unscheduled-list">
            {unscheduledEntries.map((entry) => <Link className="calendar-unscheduled-task" to={`/projects/${entry.jobId}`} key={entry.taskId}>
              <b>{entry.customerName} · {entry.title}</b>
              <span>{entry.taskType} · {entry.status} · Open project to schedule or complete</span>
            </Link>)}
          </div>
        </section>}
        {monthEntries.length === 0 && unscheduledEntries.length === 0 && (
          <p className="state-quiet">No dated work in {monthLabel(month)}. Nothing unfinished is waiting for a date.</p>
        )}
        <div className="calendar-grid" aria-label={`${monthLabel(month)} operational calendar`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
          {days.map((day) => {
            const dayKey = day;
            const dayEntries = byDay.get(dayKey) ?? [];
            const inMonth = day.startsWith(monthPrefix);
            return <div
              className={`calendar-day ${inMonth ? '' : 'outside'} ${draggedId !== null ? 'drop-target' : ''}`}
              key={dayKey}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
              onDrop={(event) => {
                event.preventDefault();
                const entry = datedEntries.find((candidate) => candidate.visitId === event.dataTransfer.getData('text/plain'));
                if (entry !== undefined) void moveEntry(entry, dayKey);
              }}
            >
              <div className="calendar-date">{Number(day.slice(8, 10))}</div>
              {dayEntries.map((entry) => <Link
                draggable={entry.movable && savingId === null}
                onDragStart={(event) => { if (!entry.movable || entry.visitId === null) return; event.dataTransfer.setData('text/plain', entry.visitId); event.dataTransfer.effectAllowed = 'move'; setDraggedId(entry.visitId); }}
                onDragEnd={() => setDraggedId(null)}
                className={`calendar-entry ${entry.conflict ? 'is-conflict' : ''} ${draggedId === entry.visitId ? 'is-dragging' : ''}`}
                to={`/projects/${entry.jobId}`}
                key={`${entry.visitId}-${dayKey}`}
                title={`${entry.customerName} · ${entry.trade} · Drag to move`}
                onClick={(event) => { if (draggedId !== null) event.preventDefault(); }}
              >
                <b>{entry.customerName} · {entry.title}</b>
                <span>{entry.taskType === 'visit' ? `${entry.trade ?? 'Crew'} · ${entry.phaseKey === 'gunite' ? 'Gunite — 1 day' : entry.phaseKey ?? ''}` : `${entry.taskType} · ${entry.status}`}</span>
              </Link>)}
            </div>;
          })}
        </div>
        <div className="calendar-agenda" aria-label={`${monthLabel(month)} operational agenda`}>
          {monthEntries.length === 0
            ? <p className="state-quiet">No dated work this month.</p>
            : monthEntries.map((entry) => <Link className="calendar-agenda-entry" to={`/projects/${entry.jobId}`} key={entry.taskId}>
                <time dateTime={entry.startsOn}>{new Date(`${entry.startsOn}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</time>
                <span><b>{entry.customerName} · {entry.title}</b><small>{entry.taskType} · {entry.status}</small></span>
                {entry.conflict && <strong>Conflict</strong>}
              </Link>)}
        </div>
      </>}
    </>
  );
}
