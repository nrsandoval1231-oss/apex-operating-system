import { Link, useParams } from 'react-router';
import { CONSTRUCTION_PHASES, type DrawStatus, type VisitStatus } from '@apex/contracts';
import { useDrawSchedule, useJob, useJobGates, useJobInspections, useJobSchedule } from '../api/useJobs';
import AttachTakeoff from '../components/AttachTakeoff';
import Inspections from '../components/Inspections';
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

/** Work still to be built on this screen, stated rather than implied. */
const PENDING = [
  ['Checklists and photos', 'Requirement checklists and evidence capture run in the Gate field console.'],
] as const;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error, loading, reload } = useJob(id);
  const gates = useJobGates(id);
  const gatePlan = gates.data ?? [];
  const draws = useDrawSchedule(id);
  const drawPlan = draws.data;
  const schedule = useJobSchedule(id);
  const inspections = useJobInspections(id);
  // One clock for the whole screen, read once. The inspection rules take today
  // as an argument for the same reason the card engine does: the same state has
  // to produce the same answer every time it is asked.
  const today = new Date().toISOString().slice(0, 10);
  const visits = schedule.data?.visits ?? [];
  const conflicts = schedule.data?.conflicts ?? [];

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

  const phase = job.project;

  return (
    <>
      <header className="title-block">
        <div style={{ minWidth: 0 }}>
          <Link to="/projects" className="link-quiet" style={{ display: 'inline-block', marginBottom: '10px' }}>
            ← All projects
          </Link>
          <h1>{jobTitle(job)}</h1>
        </div>
        <div className="stamp">
          {JOB_STATUS_LABEL[job.status]}
          <b>{formatContract(job.contractCents)}</b>
        </div>
      </header>

      <p className="notice">{jobLocation(job)}</p>

      {/* ---------------------------------------------------------- phases */}

      <div className="section-rule"><h2>Construction</h2></div>

      {phase === null ? (
        <p className="state-quiet">
          This job has not been opened as a construction project, so it has no phase.
        </p>
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
              {phase.currentPhaseSequence} of 9 · {milestoneTitle(phase.customerMilestone)}
            </span>
          </div>

          <dl className="facts">
            <dt>Super</dt>
            <dd className={phase.superintendentName === null ? 'unset' : ''}>
              {phase.superintendentName ?? 'Not assigned'}
            </dd>
            <dt>Target</dt>
            <dd className={targetWindow(phase) === null ? 'unset' : ''}>
              {targetWindow(phase) ?? 'Not recorded'}
            </dd>
            <dt>Risks</dt>
            <dd className={phase.riskNote === null ? 'unset' : ''}>
              {phase.riskNote ?? 'None recorded'}
            </dd>
          </dl>
        </>
      )}

      {/* ----------------------------------------------------------- gates */}

      <div className="section-rule">
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
            <li key={entry.definitionKey}>
              <div style={{ minWidth: 0 }}>
                <div className="what">{entry.title}</div>
                <div className="note">
                  {[
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
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* -------------------------------------------------------- schedule */}

      <div className="section-rule">
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

      <div className="section-rule">
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

      <div className="section-rule"><h2>Takeoff</h2></div>
      <dl className="facts">
        <dt>Approved</dt>
        <dd className={job.approvedTakeoffRevisionId === null ? 'unset' : 'mono'}>
          {job.approvedTakeoffRevisionId === null
            ? 'None — no gate can open without one'
            : job.approvedTakeoffRevisionId.slice(-12)}
        </dd>
      </dl>
      {id !== undefined && (
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

      {/* ----------------------------------------------------- inspections */}

      {id !== undefined && <Inspections jobId={id} query={inspections} today={today} />}

      {/* --------------------------------------------------------- customer */}

      <div className="section-rule"><h2>Customer</h2></div>
      <p className="state-quiet">
        The link the customer opens, which photos they can see, and what Apex is
        waiting on them for.
      </p>
      <div style={{ marginTop: '12px' }}>
        <Link to={`/projects/${job.jobId}/customer`} className="action">
          Customer page
        </Link>
      </div>

      <div className="section-rule"><h2>Not built yet</h2></div>
      <dl className="facts">
        {PENDING.map(([title, detail]) => (
          <div key={title} style={{ display: 'contents' }}>
            <dt>{title}</dt>
            <dd className="unset">{detail}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
