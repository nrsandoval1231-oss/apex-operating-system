import { useCallback, useEffect, useState } from 'react';
import { JobInspectionSchema, type JobInspection } from '@apex/contracts';
// The pressure rule is imported rather than restated: this screen and the
// Today feed must never disagree about whether an inspection is late.
import { inspectionPressure, type InspectionPressure } from '@apex/domain';
import { ApiError, apiSend } from '../api/client';
import type { Query } from '../api/useJobs';
import InlineForm from './InlineForm';
import QueryState from './QueryState';

/**
 * Inspections on one job — PRD §9.7.
 *
 * The column that matters is not the inspection date. It is the last day the
 * request can still go in and arrive before the work needs it, and that is what
 * this screen leads with.
 *
 * An inspection with nothing booked behind it shows no deadline at all rather
 * than a soothing one. That is the honest state: without a planned date there
 * is nothing to be late for, and saying otherwise would train the reader to
 * distrust the dates that do matter.
 */

const PRESSURE_TAG: Readonly<Record<InspectionPressure, string>> = {
  overdue: 'tag-urgent',
  due: 'tag-urgent',
  ahead: 'tag-pool',
  unscheduled: 'tag-dim',
  clear: 'tag-clear',
};

const STATUS_LABEL: Readonly<Record<string, string>> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  passed: 'Passed',
  failed: 'Failed',
  waived: 'Waived',
};

const label = (inspection: JobInspection, pressure: InspectionPressure): string => {
  if (inspection.status === 'failed') return 'Failed';
  if (inspection.status === 'passed') return 'Passed';
  if (inspection.status === 'waived') return 'Waived';
  if (pressure === 'overdue') return 'Overdue';
  if (pressure === 'due') return 'Request today';
  if (pressure === 'unscheduled') return inspection.status === null ? 'Not requested' : STATUS_LABEL[inspection.status] ?? '';
  return inspection.status === null ? 'Not requested' : STATUS_LABEL[inspection.status] ?? '';
};

export default function Inspections({
  jobId,
  query,
  today,
  focus,
  readOnly,
}: {
  jobId: string;
  query: Query<readonly JobInspection[]>;
  /** Passed in rather than read here, so the screen matches the feed exactly. */
  today: string;
  /** Feed cards use this to land the operator at the resolving workflow. */
  focus?: string | null;
  readOnly: boolean;
}) {
  const [asking, setAsking] = useState<
    | { kind: 'request'; inspection: JobInspection }
    | { kind: 'result'; inspection: JobInspection }
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setAsking(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (focus === 'inspections') document.getElementById('inspections')?.scrollIntoView({ block: 'start' });
  }, [focus]);

  const inspections = query.data ?? [];
  const outstanding = inspections.filter(
    (inspection) => inspectionPressure(inspection, today) === 'overdue'
      || inspectionPressure(inspection, today) === 'due',
  );

  const request = (inspection: JobInspection, values: Readonly<Record<string, string>>) => run(async () => {
    await apiSend(`/api/jobs/${jobId}/inspections/${inspection.inspectionKey}/request`, JobInspectionSchema, {
      method: 'POST',
      body: {
        requestedOn: values['requestedOn'],
        ...(values['scheduledFor'] ? { scheduledFor: values['scheduledFor'] } : {}),
      },
    });
    query.reload();
  });

  const record = (inspection: JobInspection, values: Readonly<Record<string, string>>) => run(async () => {
    const outcome = values['outcome'];
    if (outcome !== 'passed' && outcome !== 'failed' && outcome !== 'waived') {
      throw new Error('Choose passed, failed, or waived.');
    }
    await apiSend(`/api/jobs/${jobId}/inspections/${inspection.inspectionKey}/result`, JobInspectionSchema, {
      method: 'POST',
      body: {
        outcome,
        occurredOn: values['occurredOn'],
        ...(values['note'] ? { note: values['note'] } : {}),
        ...(outcome === 'failed' && values['corrections'] ? { corrections: values['corrections'] } : {}),
      },
    });
    query.reload();
  });

  return (
    <>
      <div className="section-rule" id="inspections">
        <h2>Inspections</h2>
        {outstanding.length > 0 && <span className="count">{outstanding.length} need calling in</span>}
      </div>

      {error !== null && <p className="notice" role="alert" style={{ color: 'var(--amber)' }}>{error}</p>}

      <QueryState
        loading={query.loading}
        error={query.error}
        isEmpty={inspections.length === 0}
        emptyTitle="No inspections"
        emptyBody="No inspection list is configured."
        onRetry={query.reload}
        quiet
      />

      {!readOnly && asking?.kind === 'request' && (
        <InlineForm
          title={`Call in ${asking.inspection.title}`}
          note={`${asking.inspection.requestMethod}. ${asking.inspection.authority}.`}
          fields={[
            { name: 'requestedOn', label: 'Requested on (YYYY-MM-DD)', required: true, initial: today },
            { name: 'scheduledFor', label: 'Date the city gave (YYYY-MM-DD)' },
          ]}
          submitLabel="Record the request"
          busy={busy}
          onSubmit={(values) => request((asking as { inspection: JobInspection }).inspection, values)}
          onCancel={() => setAsking(null)}
        />
      )}

      {!readOnly && asking?.kind === 'result' && (
        <InlineForm
          title={`Result — ${asking.inspection.title}`}
          note="Passed, failed, or waived. A failure has to say what must be corrected; a waiver has to say why it does not apply to this pool."
          fields={[
            {
              name: 'outcome',
              label: 'Outcome',
              required: true,
              initial: 'passed',
              options: [
                { value: 'passed', label: 'Passed' },
                { value: 'failed', label: 'Failed' },
                { value: 'waived', label: 'Waived' },
              ],
            },
            { name: 'occurredOn', label: 'Date (YYYY-MM-DD)', required: true, initial: today },
            { name: 'note', label: 'Note, or why it was waived', multiline: true },
            { name: 'corrections', label: 'What must be corrected (on a failure)', multiline: true },
          ]}
          submitLabel="Record the result"
          busy={busy}
          onSubmit={(values) => record((asking as { inspection: JobInspection }).inspection, values)}
          onCancel={() => setAsking(null)}
        />
      )}

      {inspections.length > 0 && (
        <ul className="schedule">
          {inspections.map((inspection) => {
            const pressure = inspectionPressure(inspection, today);
            const settled = inspection.status === 'passed' || inspection.status === 'waived';
            return (
              <li key={inspection.inspectionKey}>
                <div style={{ minWidth: 0 }}>
                  <div className="what">{inspection.title}</div>
                  <div className="note">
                    {[
                      inspection.requestedBy === 'apex'
                        ? 'Apex books it'
                        : `${inspection.requesterTrade ?? 'Sub'} books it`,
                      `${inspection.leadTimeBusinessDays} working days`,
                      `Holds ${inspection.blocksGateTitle}`,
                    ].join(' · ')}
                  </div>

                  {/* The deadline, or the honest absence of one. */}
                  <div
                    className="note"
                    style={{
                      marginTop: '4px',
                      color: pressure === 'overdue' || pressure === 'due' ? 'var(--amber)' : undefined,
                    }}
                  >
                    {inspection.lastSafeRequestOn === null
                      ? 'No date booked into the work it holds, so no deadline yet.'
                      : `Request by ${inspection.lastSafeRequestOn} to make ${inspection.neededBy}`
                        + `${inspection.neededBySource === 'crew-booking' ? ' (from the crew booking)' : ''}`}
                  </div>

                  {inspection.corrections !== null && (
                    <div className="note" style={{ marginTop: '4px', color: 'var(--amber)' }}>
                      Corrections: {inspection.corrections}
                    </div>
                  )}
                  {/* A pass never erases the failure that came before it. */}
                  {inspection.failureCount > 0 && inspection.status === 'passed' && (
                    <div className="note" style={{ marginTop: '4px' }}>
                      Passed after {inspection.failureCount} failure
                      {inspection.failureCount === 1 ? '' : 's'}
                    </div>
                  )}
                </div>

                <div className="figure">
                  <span className={`tag ${PRESSURE_TAG[pressure]}`}>{label(inspection, pressure)}</span>
                  {!readOnly && !settled && (
                    <>
                      <button
                        type="button"
                        className="action"
                        style={{ marginTop: '6px' }}
                        disabled={busy}
                        onClick={() => setAsking({ kind: 'request', inspection })}
                      >
                        {inspection.status === null ? 'Call in' : 'Update'}
                      </button>
                      <button
                        type="button"
                        className="action action-quiet"
                        style={{ marginTop: '6px' }}
                        disabled={busy}
                        onClick={() => setAsking({ kind: 'result', inspection })}
                      >
                        Result
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="notice">
        A Gate will not release until every inspection holding it has a result. Waiving one
        is a recorded act with a stated reason, not a box that can be cleared.
      </p>
    </>
  );
}
