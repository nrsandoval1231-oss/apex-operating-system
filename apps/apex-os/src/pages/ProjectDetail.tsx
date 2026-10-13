import { useState } from 'react';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { CONSTRUCTION_PHASES, civilDay, type DrawStatus, type VisitStatus } from '@apex/contracts';
import { useDrawSchedule, useJob, useJobCloseout, useJobGates, useJobInspections, useJobSchedule, useMe } from '../api/useJobs';
import AttachTakeoff from '../components/AttachTakeoff';
import AssignSuperintendent from '../components/AssignSuperintendent';
import ConfirmInvoice from '../components/ConfirmInvoice';
import CloseJob from '../components/CloseJob';
import DownloadRetainedTakeoff from '../components/DownloadRetainedTakeoff';
import { apiSend } from '../api/client';
import GateWorkflow from '../components/GateWorkflow';
import Inspections from '../components/Inspections';
import OpenProject from '../components/OpenProject';
import QueryState from '../components/QueryState';
import {
  GATE_STATUS_LABEL,
  JOB_STATUS_LABEL,
  formatContract,
  jobLocation,
  jobTitle,
  milestoneTitle,
  targetWindow,
} from '../lib/jobDisplay';

const DRAW_STATUS_LABEL: Readonly<Record<DrawStatus, string>> = {
  scheduled: 'Not earned',
  eligible: 'Ready to bill',
  invoiced: 'Invoiced',
  paid: 'Paid',
};

const DRAW_TAG: Readonly<Record<DrawStatus, string>> = {
  scheduled: 'tag-dim',
  // Earned and unbilled is the one that should catch the eye.
  eligible: 'tag-urgent',
  invoiced: 'tag-dim',
  paid: 'tag-clear',
};

const VISIT_STATUS_LABEL: Readonly<Record<VisitStatus, string>> = {
  planned: 'Planned',
  confirmed: 'Confirmed',
  done: 'Done',
  cancelled: 'Cancelled',
};

const VISIT_TAG: Readonly<Record<VisitStatus, string>> = {
  planned: 'tag-dim',
  confirmed: 'tag-pool',
  done: 'tag-clear',
  cancelled: 'tag-dim',
};

const GATE_TAG = (status: string | null): string => {
  if (status === null) return 'tag-dim';
  if (status === 'released') return 'tag-clear';
  if (status === 'blocked' || status === 'awaiting-countersign') return 'tag-urgent';
  return 'tag-pool';
};

export default function ProjectDetail({ historical = false }: { historical?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Today cards carry the exact Gate they need. Opening it here means the
  // action feed and the unified Projects workflow are one continuous path.
  const requestedGate = searchParams.get('gate');
  const [openGate, setOpenGate] = useState<string | null>(requestedGate);
  const [movingVisitId, setMovingVisitId] = useState<string | null>(null);
  const [moveStartsOn, setMoveStartsOn] = useState('');
  const [moveEndsOn, setMoveEndsOn] = useState('');
  const [targetEnd, setTargetEnd] = useState('');
  const [nextPhase, setNextPhase] = useState('');
  const [phaseReason, setPhaseReason] = useState('');
  const [phaseBusy, setPhaseBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: job, error, loading, reload } = useJob(id);
  const me = useMe();
  const showCloseout = job !== null && (
    job.status === 'complete'
    || job.status === 'closed'
    || job.project?.currentPhaseKey === 'plaster-fill'
  );
  const closeout = useJobCloseout(showCloseout ? id : undefined);
  const gates = useJobGates(id);
  const gatePlan = gates.data ?? [];
  const draws = useDrawSchedule(id);
  const drawPlan = draws.data;
  const schedule = useJobSchedule(id);
  const inspections = useJobInspections(id);
  // One clock for the whole screen, read once. The inspection rules take today
  // as an argument for the same reason the card engine does: the same state has
  // to produce the same answer every time it is asked.
  const today = civilDay();
  const visits = schedule.data?.visits ?? [];
  const conflicts = schedule.data?.conflicts ?? [];
  const phase = job?.project ?? null;

  const moveVisit = async (visitId: string) => {
    setActionError(null);
    try {
      await apiSend(`/api/visits/${visitId}/move`, z.unknown(), {
        method: 'POST', body: { startsOn: moveStartsOn, endsOn: moveEndsOn, reason: 'Resolved from Apex Today conflict.' },
      });
      setMovingVisitId(null);
      schedule.reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Visit could not be moved.'); }
  };

  const changePhase = async () => {
    if (id === undefined || nextPhase === '') return;
    setActionError(null);
    setPhaseBusy(true);
    try {
      await apiSend(`/api/jobs/${id}/project/phase`, z.unknown(), {
        method: 'POST',
        body: { toPhaseKey: nextPhase, ...(phaseReason.trim() ? { reason: phaseReason.trim() } : {}) },
      });
      setPhaseReason('');
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Phase could not be changed.');
    } finally {
      setPhaseBusy(false);
    }
  };

  const updateTarget = async () => {
    if (id === undefined || phase === null) return;
    setActionError(null);
    try {
      await apiSend(`/api/jobs/${id}/project/target`, z.unknown(), {
        method: 'POST', body: { targetCompletionStart: phase.targetCompletionStart, targetCompletionEnd: targetEnd || null },
      });
      reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Target could not be updated.'); }
  };

  if (job === null) {
    return (
      <>
        <header className="title-block">
          <h1>Project</h1>
          <div className="stamp"><Link to="/projects" className="link-quiet">← All projects</Link></div>
        </header>
        <QueryState
          loading={loading}
          error={error}
          isEmpty={false}
          emptyTitle=""
          emptyBody=""
          onRetry={reload}
        />
      </>
    );
  }

  const archived = job.status === 'closed' || job.status === 'cancelled';
  if (!historical && archived) return <Navigate replace to={`/historical/${job.jobId}`} />;
  if (historical && !archived) return <Navigate replace to={`/projects/${job.jobId}`} />;
  const readOnly = historical && archived;
  const backTo = readOnly ? '/historical' : '/projects';
  const backLabel = readOnly ? 'History' : 'All projects';
  const justArchived = (location.state as { archived?: boolean } | null)?.archived === true;

  return (
    <>
      <header className="title-block">
        <div style={{ minWidth: 0 }}>
          <Link to={backTo} className="link-quiet" style={{ display: 'inline-block', marginBottom: '10px' }}>
            ← {backLabel}
          </Link>
          <h1>{jobTitle(job)}</h1>
        </div>
        <div className="stamp">
          {JOB_STATUS_LABEL[job.status]}
          <b>{formatContract(job.contractCents)}</b>
        </div>
      </header>

      <p className="notice">{jobLocation(job)}</p>
      {readOnly && (
        <p className="notice" role={justArchived ? 'status' : undefined}>
          {justArchived ? 'Project closed and archived. ' : ''}
          Historical record — changes are disabled.
          {closeout.data?.closedAt
            ? ` Closed ${new Date(closeout.data.closedAt).toLocaleString()} by ${closeout.data.closedByName ?? 'recorded staff'}.`
            : ''}
        </p>
      )}
      {actionError !== null && <p className="error" role="alert">{actionError}</p>}

      <nav className="project-jump" aria-label="Project sections">
        <a href="#construction">Construction</a>
        <a href="#gates">Gates</a>
        <a href="#schedule">Schedule</a>
        <a href="#draws">Draws</a>
        <a href="#takeoff">Takeoff</a>
        <a href="#inspections">Inspections</a>
        <a href="#completion">Completion</a>
        {!readOnly && <a href="#customer">Customer</a>}
      </nav>

      {/* ---------------------------------------------------------- phases */}

      <div className="section-rule" id="construction"><h2>Construction</h2></div>

      {phase === null ? (
        <>
          <p className="state-quiet">
            This job has not been opened as a construction project, so it has no phase.
          </p>
          {/*
            * The Today feed has raised "job not opened as a project" since the
            * card engine shipped and there was nowhere to act on it. Opening is
            * the deliberate act that says a signed job is now under
            * construction — a signed contract is not the same thing.
            */}
          {id !== undefined && !readOnly && (
            <OpenProject jobId={id} onOpened={() => { reload(); gates.reload(); }} />
          )}
        </>
      ) : (
        <>
          <ol className="track-line" aria-label="Construction phase">
            {CONSTRUCTION_PHASES.map((step) => {
              const done = step.sequence < phase.currentPhaseSequence;
              const current = step.sequence === phase.currentPhaseSequence;
              return (
                <li
                  key={step.key}
                  className={`mark ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
                  aria-current={current ? 'step' : undefined}
                  title={step.title}
                >
                  {step.sequence}
                </li>
              );
            })}
          </ol>

          <div className="track-caption">
            <span className="now">{phase.currentPhaseTitle}</span>
            <span className="of">
              {phase.currentPhaseSequence} of 11 · {milestoneTitle(phase.customerMilestone)}
            </span>
          </div>

          <p className="notice" style={{ marginTop: '14px' }}>
            Releasing a Gate moves the project onto that Gate&apos;s phase, or one step past it when the project is already there. Steel, rough-in, and tile can also be set here. A skip or a step backward needs a reason, and the progress bar follows the same history.
          </p>
          {!readOnly && me.data !== null && ['admin', 'office', 'superintendent'].includes(me.data.role) && (
            <form
              className="state"
              style={{ textAlign: 'left', marginTop: '12px' }}
              onSubmit={(event) => { event.preventDefault(); void changePhase(); }}
            >
              <h3>Set construction phase</h3>
              <label className="field">
                <span>Phase</span>
                <select value={nextPhase} onChange={(event) => setNextPhase(event.target.value)} aria-label="Construction phase">
                  <option value="">Choose a phase</option>
                  {CONSTRUCTION_PHASES.filter((step) => step.key !== phase.currentPhaseKey).map((step) => (
                    <option key={step.key} value={step.key}>{step.sequence}. {step.title}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Reason (required to skip or go back)</span>
                <input value={phaseReason} onChange={(event) => setPhaseReason(event.target.value)} />
              </label>
              <button type="submit" className="action" disabled={phaseBusy || nextPhase === ''}>
                {phaseBusy ? 'Saving…' : 'Set phase'}
              </button>
            </form>
          )}

          <dl className="facts">
            <dt>Super</dt>
            <dd className={phase.superintendentName === null ? 'unset' : ''}>
              {phase.superintendentName ?? 'Not assigned'}
              {id !== undefined && !readOnly && (
                <AssignSuperintendent
                  jobId={id}
                  currentUserId={phase.superintendentUserId ?? null}
                  onAssigned={reload}
                />
              )}
            </dd>
            <dt>Target</dt>
            <dd className={targetWindow(phase) === null ? 'unset' : ''}>
              {targetWindow(phase) ?? 'Not recorded'}
              {id !== undefined && !readOnly && (
                <span className="inline-action">
                  <input type="date" aria-label="New target completion date" value={(targetEnd || phase.targetCompletionEnd) ?? ''} onChange={(event) => setTargetEnd(event.target.value)} />
                  <button className="btn ghost" onClick={updateTarget}>Update target</button>
                </span>
              )}
            </dd>
            <dt>Risks</dt>
            <dd className={phase.riskNote === null ? 'unset' : ''}>
              {phase.riskNote ?? 'None recorded'}
            </dd>
          </dl>
        </>
      )}

      {/* ----------------------------------------------------------- gates */}

      <div className="section-rule" id="gates">
        <h2>Gates</h2>
        <span className="count">{gatePlan.filter((g) => g.status === 'released').length} of {gatePlan.length} released</span>
      </div>

      <QueryState
        loading={gates.loading}
        error={gates.error}
        isEmpty={gatePlan.length === 0}
        emptyTitle="No gate templates"
        emptyBody="No active gate definitions were returned."
        onRetry={gates.reload}
        quiet
      />

      {gatePlan.length > 0 && (
        <ul className="schedule">
          {gatePlan.map((entry) => (
            <li key={entry.definitionKey} className="is-stacked">
              <div className="row-line">
                <div style={{ minWidth: 0 }}>
                  <div className="what">{entry.title}</div>
                  <div className="note">
                    {[
                      entry.phaseKey === null ? null : CONSTRUCTION_PHASES.find((step) => step.key === entry.phaseKey)?.title,
                      entry.drawCode === null ? 'No draw' : 'Releases a draw',
                      entry.requiresCountersign ? 'Owner countersign' : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="figure">
                  <span className={`tag ${GATE_TAG(entry.status)}`}>
                    {/* Not opened is not the same as skipped, and must never read as passed. */}
                    {entry.status === null ? 'Not opened' : GATE_STATUS_LABEL[entry.status]}
                  </span>
                  {/*
                    * Only a Gate that exists can be looked into. One never opened
                    * has no requirements, no evidence and nothing to review — an
                    * expander there would open onto an empty box.
                    */}
                  {(entry.gateInstanceId !== null || entry.status === null) && (
                    <button
                      type="button"
                      className="action action-quiet"
                      aria-expanded={openGate === entry.definitionKey}
                      onClick={() => setOpenGate(openGate === entry.definitionKey ? null : entry.definitionKey)}
                    >
                      {openGate === entry.definitionKey ? 'Hide record' : readOnly ? 'View record' : 'Open workflow'}
                    </button>
                  )}
                </div>
              </div>
              {openGate === entry.definitionKey && id !== undefined && (
                <GateWorkflow
                  jobId={id}
                  entry={entry}
                  customerName={job.customerName ?? 'this customer'}
                  role={me.data?.role ?? null}
                  readOnly={readOnly}
                  onChanged={() => { gates.reload(); reload(); }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* -------------------------------------------------------- schedule */}

      <div className="section-rule" id="schedule">
        <h2>Schedule</h2>
        {conflicts.length > 0 && <span className="count">{conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}</span>}
      </div>

      <QueryState
        loading={schedule.loading}
        error={schedule.error}
        isEmpty={visits.length === 0}
        emptyTitle="Nothing booked"
        emptyBody="No subcontractor visits are scheduled on this job."
        onRetry={schedule.reload}
        quiet
      />

      {visits.length > 0 && (
        <ul className="schedule">
          {visits.map((visit) => {
            const against = conflicts.filter((conflict) => conflict.visitId === visit.visitId);
            return (
              <li key={visit.visitId}>
                <div style={{ minWidth: 0 }}>
                  <div className="what">{visit.subcontractorName}</div>
                  <div className="note">
                    {[
                      visit.trade,
                      visit.startsOn === visit.endsOn ? visit.startsOn : `${visit.startsOn} – ${visit.endsOn}`,
                      visit.rescheduleCount > 0
                        ? `Moved ${visit.rescheduleCount} time${visit.rescheduleCount === 1 ? '' : 's'}`
                        : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {/* The conflict is stated on the row it belongs to, in full.
                      A count alone would make the owner go hunting for it. */}
                  {against.map((conflict) => (
                    <div key={conflict.kind + conflict.visitId} className="note" style={{ color: 'var(--amber)', marginTop: '6px' }}>
                      {conflict.kind === 'crew-double-booked'
                        ? `Also booked on ${conflict.otherJobName ?? 'another job'} for ${conflict.overlapStartsOn}${conflict.overlapEndsOn === conflict.overlapStartsOn ? '' : ` – ${conflict.overlapEndsOn}`}`
                        : `Booked before the ${conflict.gateTitle} gate has released`}
                    </div>
                  ))}
                  {!readOnly && against.length > 0 && visit.status !== 'done' && visit.status !== 'cancelled' && (
                    movingVisitId === visit.visitId ? (
                      <span className="inline-action">
                        <input type="date" aria-label="Move visit start" value={moveStartsOn} onChange={(event) => setMoveStartsOn(event.target.value)} />
                        <input type="date" aria-label="Move visit end" value={moveEndsOn} onChange={(event) => setMoveEndsOn(event.target.value)} />
                        <button className="btn ghost" onClick={() => moveVisit(visit.visitId)}>Save move</button>
                        <button className="btn ghost" onClick={() => setMovingVisitId(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button className="btn ghost" onClick={() => { setMovingVisitId(visit.visitId); setMoveStartsOn(visit.startsOn); setMoveEndsOn(visit.endsOn); }}>Move visit</button>
                    )
                  )}
                </div>
                <div className="figure">
                  <span className={`tag ${against.length > 0 ? 'tag-stamp' : VISIT_TAG[visit.status]}`}>
                    {against.length > 0 ? 'Conflict' : VISIT_STATUS_LABEL[visit.status]}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ----------------------------------------------------------- draws */}

      <div className="section-rule" id="draws">
        <h2>Draws</h2>
        {drawPlan !== null && drawPlan.eligibleUnbilledCents > 0 && (
          <span className="count">{formatContract(drawPlan.eligibleUnbilledCents)} ready</span>
        )}
      </div>

      <QueryState
        loading={draws.loading}
        error={draws.error}
        isEmpty={drawPlan !== null && drawPlan.draws.length === 0}
        emptyTitle="No draw schedule"
        emptyBody="This job has no draw schedule, so no gate release can make anything billable."
        onRetry={draws.reload}
        quiet
      />

      {drawPlan !== null && drawPlan.draws.length > 0 && (
        <>
          <ul className="schedule">
            {drawPlan.draws.map((draw) => (
              <li key={draw.drawId}>
                <div style={{ minWidth: 0 }}>
                  <div className="what">{draw.label}</div>
                  <div className="note">
                    {[
                      draw.percentBasisPoints === null ? null : `${draw.percentBasisPoints / 100}%`,
                      draw.releaseCondition === 'contract-signed'
                        ? 'On signing'
                        : `On ${draw.gateDefinitionKey ?? 'gate'}`,
                      draw.invoiceReference === null ? null : draw.invoiceReference,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="figure">
                  {/* An amount is never invented; a draw without one says so. */}
                  <div className={`money ${draw.amountCents === null ? 'is-none' : ''}`}>
                    {draw.amountCents === null ? 'No amount' : formatContract(draw.amountCents)}
                  </div>
                  <span className={`tag ${DRAW_TAG[draw.status]}`}>{DRAW_STATUS_LABEL[draw.status]}</span>
                  {/*
                    * Only an earned draw can be billed. A scheduled one has not
                    * been released by its Gate, and an invoiced one is already
                    * recorded — offering the action there would invite the
                    * refusal the service already gives.
                    */}
                  {id !== undefined && !readOnly && draw.status === 'eligible' && (
                    <ConfirmInvoice jobId={id} draw={draw} onDone={() => { draws.reload(); reload(); }} />
                  )}
                </div>
              </li>
            ))}
          </ul>

          <dl className="totals">
            <div style={{ display: 'contents' }} className="lead">
              <dt>Ready to bill</dt>
              <dd>{formatContract(drawPlan.eligibleUnbilledCents)}</dd>
            </div>
            <dt>Contract</dt>
            <dd>{formatContract(drawPlan.contractCents)}</dd>
            <dt>Invoiced</dt>
            <dd>{formatContract(drawPlan.invoicedCents)}</dd>
            <dt>Collected</dt>
            <dd>{formatContract(drawPlan.collectedCents)}</dd>
            <dt>Remaining</dt>
            <dd>{formatContract(drawPlan.remainingCents)}</dd>
          </dl>

          <p className="notice">
            Apex OS records what a passed gate makes billable and what a person says they
            invoiced. It does not issue invoices; QuickBooks remains the financial authority.
          </p>
        </>
      )}

      {/* --------------------------------------------------------- takeoff */}

      <div className="section-rule" id="takeoff"><h2>Takeoff</h2></div>
      <dl className="facts">
        <dt>Approved</dt>
        <dd className={job.approvedTakeoffRevisionId === null ? 'unset' : 'mono'}>
          {job.approvedTakeoffRevisionId === null
            ? 'None — no gate can open without one'
            : job.approvedTakeoffRevisionId.slice(-12)}
        </dd>
      </dl>
      {id !== undefined && !readOnly && (
        <AttachTakeoff
          jobId={id}
          hasApproved={job.approvedTakeoffRevisionId !== null}
          /*
           * Gates reload too: a job with no approved takeoff cannot open one, so
           * attaching is exactly the moment that list stops being refusals.
           */
          onAttached={() => { reload(); gates.reload(); }}
        />
      )}
      {id !== undefined && readOnly && job.approvedTakeoffRevisionId !== null && (
        <DownloadRetainedTakeoff jobId={id} />
      )}
      {readOnly && job.proposalId !== null && (
        <p className="state-quiet">Retained proposal ID: <span className="mono">{job.proposalId}</span></p>
      )}

      {/* ----------------------------------------------------- inspections */}

      {id !== undefined && (
        <Inspections
          jobId={id}
          query={inspections}
          today={today}
          readOnly={readOnly}
          focus={new URLSearchParams(window.location.search).get('focus')}
        />
      )}

      <div className="section-rule" id="completion"><h2>Completion</h2></div>
      {!readOnly && (
        <CloseJob
          job={job}
          closeout={closeout.data}
          phaseKey={phase?.currentPhaseKey ?? null}
          role={me.data?.role ?? null}
          onChanged={(archived) => {
            if (archived) navigate(`/historical/${job.jobId}`, { replace: true, state: { archived: true } });
            else reload();
          }}
        />
      )}

      {/* --------------------------------------------------------- customer */}

      <div className="section-rule" id="customer"><h2>Customer</h2></div>
      <p className="state-quiet">
        The link the customer opens, which photos they can see, and what Apex is
        waiting on them for.
      </p>
      {!readOnly && <div style={{ marginTop: '12px' }}>
        <Link to={`/projects/${job.jobId}/customer`} className="action">
          Customer page
        </Link>
      </div>}


    </>
  );
}
