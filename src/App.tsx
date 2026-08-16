import './styles.css';
import { useEffect, useState } from 'react';
import { SCENARIOS } from './engine/jobs/scenarios.ts';

/** Undo history: the jobs so far, and which one is showing. */
interface History {
  readonly entries: readonly Job[];
  readonly cursor: number;
}
import type { Job } from './engine/types.ts';
import { TakeoffSheet } from './ui/TakeoffSheet.tsx';
import type { QuarterTurns } from './engine/planRotation.ts';
import { JobEditor } from './ui/JobEditor.tsx';
import { DesignControls } from './ui/DesignControls.tsx';
import { SavedJobsPanel, useSavedJobs } from './ui/SavedJobs.tsx';
import { runTakeoff } from './engine/index.ts';
import { buildApexSubmission, draftEstimateStorageKey, submissionFileName } from './engine/apexSubmission.ts';
import { buildOrderWorkbook, orderWorkbookFileName } from './engine/orderWorkbook.ts';

/**
 * Where Apex OS lives. Configurable because Designer is built and run on a
 * builder's machine while Apex OS is deployed somewhere else — they share no
 * origin, and hard-coding one host means a second deployment cannot be reached
 * without a rebuild of this tool.
 */
const BRAND_LOGO_PATH = typeof window !== 'undefined' && window.location.pathname.startsWith('/app/')
  ? '/app/brand/apex-logo.png'
  : '/brand/apex-logo.png';
const APEX_OS_ORIGIN = import.meta.env.VITE_APEX_OS_ORIGIN
  ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/app/') ? window.location.origin : 'http://127.0.0.1:4100');

/**
 * A tight lot: same pool, 5 ft to the house slab. The 6 ft deep end violates
 * the 1:1 ratio in local 307.2.2.2. Kept here so the failing path is visible
 * without editing code — PRD open question 7 asks whether this is the common
 * case on a Lubbock lot rather than the exception.
 */

/**
 * Charcoal header carrying the real Apex lockup.
 *
 * The logo is a badge with its own sage panel — used verbatim, never recoloured
 * or knocked out, per the note that ships with the asset. It already contains
 * the word APEX, so nothing here repeats it as text.
 */
interface ApexJobChoice {
  readonly jobId: string;
  readonly customerName: string | null;
  readonly addressLine: string | null;
  readonly status: string;
}

interface ApexOpportunityChoice {
  readonly leadId: string;
  readonly jobId: string | null;
  readonly customerName: string | null;
  readonly addressLine: string | null;
  readonly status: string;
}

function AppHeader({ jobName, right }: { jobName: string; right?: React.ReactNode }) {
  return (
    <header className="app-header">
      <img src={BRAND_LOGO_PATH} alt="Apex" width={126} height={30} />
      <div className="app-header-title">
        <strong>Designer</strong>
        <span>{jobName}</span>
      </div>
      <nav className="apex-workspace-nav" aria-label="Apex workspace">
        <a href={`${APEX_OS_ORIGIN}/app/today`}>Today</a>
        <a href={`${APEX_OS_ORIGIN}/app/projects`}>Projects</a>
        <span className="is-current">Designer</span>
      </nav>
      <div className="app-header-right">{right}</div>
    </header>
  );
}

export function App() {
  const [index, setIndex] = useState(0);
  /**
   * Job history, not a job. Dragging something to the wrong place and not being
   * able to put it back is the fastest way to stop trusting a move tool, so undo
   * arrived with the drag rather than after it.
   */
  const [past, setPast] = useState<History>({ entries: [SCENARIOS[0]!.job], cursor: 0 });
  const [showSaved, setShowSaved] = useState(false);
  const { saved, save, remove } = useSavedJobs();
  const [edited, setEdited] = useState(false);
  /**
   * 'design' is the builder's screen: three sizes, two drawings, six buttons.
   * 'outputs' is the engine's answer: dig plan, material quantities, plumbing
   * design and the equipment pad, which is the full sheet it always produced.
   * The engine runs in both — design mode just declines to show the working.
   */
  const [mode, setMode] = useState<'design' | 'outputs'>('design');
  const [showAdvanced, setShowAdvanced] = useState(false);
  /**
   * How far the plan SHEET is turned.
   *
   * Deliberately component state and not part of the job. Rotation is how this
   * drawing is being looked at, not a fact about the pool — so it stays out of
   * the job file, out of undo (turning the sheet is not an edit to the design),
   * and out of anything the takeoff or the quantity payload can see.
   */
  const [quarterTurns, setQuarterTurns] = useState<QuarterTurns>(0);
  /** Why the last export refused, shown where the button is rather than in a dialog. */
  const [exportError, setExportError] = useState<string | null>(null);
  const [apexJobs, setApexJobs] = useState<readonly ApexJobChoice[]>([]);
  const [apexOpportunities, setApexOpportunities] = useState<readonly ApexOpportunityChoice[]>([]);
  const [selectedApexJobId, setSelectedApexJobId] = useState('');
  const [sendingToApex, setSendingToApex] = useState(false);
  const [apexHandoff, setApexHandoff] = useState<{ kind: 'job'; job: ApexJobChoice; revisionId: string } | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [savedCustomer, setSavedCustomer] = useState<{ leadId: string; customerName: string; addressLine: string } | null>(null);
  const [newProjectBusy, setNewProjectBusy] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    customerName: '', streetAddress: '', city: 'Lubbock', state: 'TX', postalCode: '',
    phone: '', email: '', referralSource: '', notes: '',
  });

  const job = past.entries[past.cursor]!;
  const scenario = SCENARIOS[index]!;
  const canUndo = past.cursor > 0;
  const canRedo = past.cursor < past.entries.length - 1;

  const reset = (next: Job) => {
    setPast({ entries: [next], cursor: 0 });
    setEdited(false);
  };

  const pickScenario = (i: number) => {
    setIndex(i);
    reset(SCENARIOS[i]!.job);
  };

  /**
   * Entries and cursor move together, in one pure updater.
   *
   * Several edits can land in a single task — hold an arrow key down and the
   * keydowns batch. Reading the previous state from the closure made every edit
   * in a batch write the same entry, so three nudges collapsed into one and a
   * single undo threw all of them away. Two separate states could also disagree
   * mid-batch, and a cursor pointing past its own entries is a crash.
   */
  const editJob = (next: Job) => {
    setPast((h) => ({ entries: [...h.entries.slice(0, h.cursor + 1), next], cursor: h.cursor + 1 }));
    setEdited(true);
  };

  const undo = () => setPast((h) => ({ ...h, cursor: Math.max(h.cursor - 1, 0) }));
  const redo = () => setPast((h) => ({ ...h, cursor: Math.min(h.cursor + 1, h.entries.length - 1) }));

  /**
   * Hand this design to Apex OS.
   *
   * A downloaded file rather than a request. Designer runs on a builder's
   * machine and Apex OS is somewhere else, so posting directly would need CORS
   * on that API and a second sign-in implementation living in this tool. The
   * file crosses that gap without either, and attaching it stays an office act
   * performed by a named person who is already signed in — which is what the
   * receiving side's authority rules already say it is.
   *
   * The takeoff is re-run here rather than reused from the sheet: the export
   * refuses a design with blocking code failures, and that refusal has to be
   * about the design on screen right now.
   */
  const exportForApex = () => {
    setExportError(null);
    try {
      /*
       * Say what is blocking, not just that something is.
       *
       * The engine's refusal is deliberately short — "blocking code or safety
       * failures" — because it has no idea which sheet the reader is looking at.
       * From here the failing areas are known, and so is the thing that sends
       * people hunting through their own drawing for a fault that is not there:
       * a fixture's placeholder appliances failing the gas checks.
       */
      const checked = runTakeoff(job);
      if (checked.hasCodeFailure) {
        const areas = checked.codeFailureAreas.join(', ');
        const placeholders = job.equipment?.gas?.connectedLoad
          .some((appliance) => appliance.placeholder === true) ?? false;
        setExportError(
          `Cannot export: ${areas} ${checked.codeFailureAreas.length === 1 ? 'has' : 'have'} a failing check.`
          + (placeholders
            ? ' Some of the gas load is placeholder — existing house appliances nobody has entered'
              + ' yet — so this may not be a fault in the pool you drew. Open Advanced → equipment'
              + ' and enter what the house actually has, or start from a Lubbock standard preset,'
              + ' which carries no gas load.'
            : ' See the compliance path on the failing check.'),
        );
        return;
      }

      const submission = buildApexSubmission(job, checked);
      const blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = submissionFileName(job);
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // The engine's own sentence is more useful than anything restated here:
      // it names the code or safety failure that makes the design unexportable.
      setExportError(error instanceof Error ? error.message : 'This design could not be exported.');
    }
  };

  const downloadTakeoff = async () => {
    setExportError(null);
    try {
      const destination = apexJobs.find((entry) => entry.jobId === selectedApexJobId);
      const opportunity = apexOpportunities.find((entry) => entry.leadId === selectedApexJobId);
      const metadata = {
        customerName: destination?.customerName ?? opportunity?.customerName ?? undefined,
        projectName: job.name,
        address: destination?.addressLine ?? opportunity?.addressLine ?? undefined,
        opportunityId: opportunity?.leadId ?? destination?.jobId ?? undefined,
        revision: 1,
      };
      const bytes = await buildOrderWorkbook(job, metadata);
      const workbookBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([workbookBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = orderWorkbookFileName(metadata);
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The takeoff workbook could not be generated.');
    }
  };

  const createNewProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewProjectError(null);
    setNewProjectBusy(true);
    try {
      const response = await fetch(`${APEX_OS_ORIGIN}/api/projects/intake`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(newProject),
      });
      const body = await response.json() as { leadId?: string; error?: string };
      if (!response.ok || !body.leadId) throw new Error(body.error ?? `Customer intake failed (HTTP ${response.status}).`);
      setSavedCustomer({
        leadId: body.leadId,
        customerName: newProject.customerName,
        addressLine: `${newProject.streetAddress}, ${newProject.city}, ${newProject.state} ${newProject.postalCode}`,
      });
      setShowNewProject(false);
      setNewProject({
        customerName: '', streetAddress: '', city: 'Lubbock', state: 'TX', postalCode: '',
        phone: '', email: '', referralSource: '', notes: '',
      });
    } catch (error) {
      setNewProjectError(error instanceof Error ? error.message : 'The design project could not be created.');
    } finally {
      setNewProjectBusy(false);
    }
  };

  useEffect(() => {
    fetch(`${APEX_OS_ORIGIN}/api/opportunities`, { headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Apex opportunities could not be loaded.');
        return response.json() as Promise<readonly ApexOpportunityChoice[]>;
      })
      .then((opportunities) => {
        setApexOpportunities(opportunities);
        setApexJobs(opportunities.filter((entry): entry is ApexJobChoice & ApexOpportunityChoice => entry.jobId !== null).map((entry) => ({
          jobId: entry.jobId!, customerName: entry.customerName, addressLine: entry.addressLine, status: entry.status,
        })));
      })
      .catch(() => { setApexOpportunities([]); setApexJobs([]); });
  }, []);

  const sendToApex = async () => {
    setExportError(null);
    setApexHandoff(null);
    if (selectedApexJobId === '') {
      setExportError('Choose the Apex project that owns this design before sending it.');
      return;
    }
    const selectedOpportunity = apexOpportunities.find((entry) => entry.jobId === selectedApexJobId || entry.leadId === selectedApexJobId);
    const destination = apexJobs.find((entry) => entry.jobId === selectedApexJobId);
    if (!selectedOpportunity || (selectedOpportunity.jobId !== null && !destination)) {
      setExportError('The selected customer or project is no longer available. Reload the customer list and try again.');
      return;
    }
    setSendingToApex(true);
    try {
      const checked = runTakeoff(job);
      if (checked.hasCodeFailure) throw new Error(`Cannot send: ${checked.codeFailureAreas.join(', ')} has a failing check.`);
      const submission = buildApexSubmission(job, checked);
      if (selectedOpportunity.jobId === null) {
        const response = await fetch(`${APEX_OS_ORIGIN}/api/opportunities/${selectedOpportunity.leadId}/finish-estimate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ submission, directLines: [], measuredLines: [], feeRateBps: 0 }),
        });
        const body = await response.json() as { proposal?: { proposalVersionId?: string }; error?: string };
        if (!response.ok || !body.proposal?.proposalVersionId) throw new Error(body.error ?? `Estimate draft could not be created (HTTP ${response.status}).`);
        const handoff = JSON.stringify({ type: 'apex-estimate-handoff', leadId: selectedOpportunity.leadId, submission, fileName: submissionFileName(job) });
        window.name = handoff;
        sessionStorage.setItem(draftEstimateStorageKey(selectedOpportunity.leadId), JSON.stringify({ submission, fileName: submissionFileName(job) }));
        window.location.href = `${APEX_OS_ORIGIN}/app/opportunities/${selectedOpportunity.leadId}/estimate`;
        return;
      }
      const response = await fetch(`${APEX_OS_ORIGIN}/api/jobs/${destination!.jobId}/approved-takeoff`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ ...submission, supersedeExisting: false }),
      });
      const body = await response.json() as { revisionId?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Apex rejected the takeoff (HTTP ${response.status}).`);
      setApexHandoff({ kind: 'job', job: destination!, revisionId: body.revisionId ?? 'created' });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The takeoff could not be sent to Apex OS.');
    } finally {
      setSendingToApex(false);
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (mode === 'outputs') {
    return (
      <div className="app app-outputs">
        <main className="app-main">
          <AppHeader jobName={job.name} />
          <div className="switcher print-hide">
            <button className="btn ghost" onClick={() => setMode('design')}>← Back to design</button>
            <span>Outputs:</span>
            {[
              ['out-bom', 'Order list'],
              ['out-dig', 'Dig plan'],
              ['out-materials', 'Material quantities'],
              ['out-plumbing', 'Plumbing design'],
              ['out-equipment', 'Equipment pad'],
            ].map(([id, label]) => (
              <button className="btn ghost" key={id} onClick={() => document.getElementById(id!)?.scrollIntoView({ behavior: 'smooth' })}>
                {label}
              </button>
            ))}
          </div>
          <TakeoffSheet job={job} details={scenario.details} quarterTurns={quarterTurns} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      {showAdvanced && (
        <JobEditor
          job={job}
          onChange={editJob}
          onReset={() => reset(scenario.job)}
        />
      )}

      <main className="app-main">
        <AppHeader
          jobName={job.name}
          right={(
            <>
              <button className="btn ghost" onClick={undo} disabled={!canUndo}>Undo</button>
              <button className="btn ghost" onClick={redo} disabled={!canRedo}>Redo</button>
              <button
                className={showAdvanced ? 'btn' : 'btn ghost'}
                aria-pressed={showAdvanced}
                onClick={() => setShowAdvanced((open) => !open)}
              >
                Advanced
              </button>
              <button className="btn" onClick={() => { setNewProjectError(null); setShowNewProject(true); }}>
                New customer
              </button>
              {showAdvanced && <button className="btn ghost" onClick={exportForApex}>Download JSON fallback</button>}
              {/*
                * Across to the field console. Designer runs on this machine and
                * Apex OS is deployed elsewhere, so this is a plain link to a
                * configured origin rather than navigation within one app —
                * `VITE_APEX_OS_ORIGIN` at build time, falling back to the
                * deployed host. A new tab, because a drawing in progress should
                * not be replaced by another application.
                */}
              <a
                className="btn ghost"
                href={APEX_OS_ORIGIN}
                target="_blank"
                rel="noreferrer"
              >
                Field console ↗
              </a>
            </>
          )}
        />
        {exportError !== null && (
          <p className="export-error" role="alert">{exportError}</p>
        )}
        {savedCustomer !== null && (
          <div className="customer-saved" role="status">
            <strong>Customer saved.</strong>
            <span>{savedCustomer.customerName} · {savedCustomer.addressLine}</span>
            <small>Now design the pool below. Run the takeoff when the design is ready; estimating stays a separate next step.</small>
          </div>
        )}
        {showNewProject && (
          <section className="panel intake-panel print-hide" aria-label="New customer">
            <div className="intake-intro"><div><p className="eyebrow">Create a customer</p><h2>New customer</h2><p className="note">Capture the person and project address first. Apex will open the estimate workspace next, where the proposal becomes the project after acceptance.</p></div><button className="btn ghost" type="button" onClick={() => setShowNewProject(false)}>Close</button></div>
            {newProjectError !== null && <p className="export-error" role="alert">{newProjectError}</p>}
            <form className="intake-form" onSubmit={createNewProject}>
              {([
                ['customerName', 'Customer name', true], ['streetAddress', 'Street address', true], ['city', 'City', true],
                ['state', 'State', true], ['postalCode', 'Postal code', true], ['phone', 'Phone', false],
                ['email', 'Email', false], ['referralSource', 'Referral source', false], ['notes', 'Project notes', false],
              ] as const).map(([key, label, required]) => (
                <label key={key}><span>{label}</span>
                  {key === 'notes' ? <textarea value={newProject[key]} required={required} onChange={(event) => setNewProject((current) => ({ ...current, [key]: event.target.value }))} />
                    : <input value={newProject[key]} required={required} type={key === 'email' ? 'email' : 'text'} onChange={(event) => setNewProject((current) => ({ ...current, [key]: event.target.value }))} />}
                </label>
              ))}
              <div className="inline-action"><button className="btn" type="submit" disabled={newProjectBusy}>{newProjectBusy ? 'Saving customer…' : 'Save customer'}</button></div>
            </form>
          </section>
        )}
        <div className="apex-handoff print-hide">
          <label>
            <span>{apexOpportunities.find((entry) => (entry.jobId ?? entry.leadId) === selectedApexJobId)?.jobId === null ? 'Create estimate from this takeoff' : 'Send this design to Apex project'}</span>
            <select value={selectedApexJobId} onChange={(event) => setSelectedApexJobId(event.target.value)}>
              <option value="">Choose a customer/job first</option>
              {apexOpportunities.map((entry) => {
                const value = entry.jobId ?? entry.leadId;
                const suffix = entry.jobId === null ? ' (saved customer; design pending)' : '';
                return <option key={entry.leadId} value={value}>{entry.customerName ?? entry.leadId} — {entry.addressLine ?? 'Address not recorded'}{suffix}</option>;
              })}
            </select>
          </label>
          {apexHandoff !== null && (
            <div className="apex-handoff-success" role="status">
              <strong>Takeoff sent to {apexHandoff.job.customerName ?? 'Apex project'}.</strong>
              <span>{apexHandoff.job.addressLine ?? apexHandoff.job.jobId} · revision recorded</span>
              <a className="btn" href={`${APEX_OS_ORIGIN}/app/projects/${apexHandoff.job.jobId}`} target="_blank" rel="noreferrer">Open this project in Apex OS ↗</a>
            </div>
          )}
        </div>
        <div className="switcher print-hide">
          <span>Start from:</span>
          {SCENARIOS.map((sc, i) => (sc.group === 'standard' ? (
            <button
              key={sc.tab}
              className={i === index && !edited ? 'btn' : 'btn ghost'}
              aria-pressed={i === index && !edited}
              onClick={() => pickScenario(i)}
            >
              {sc.tab}
            </button>
          ) : null))}
          <button
            className={showSaved ? 'btn switcher-more' : 'btn ghost switcher-more'}
            aria-expanded={showSaved}
            onClick={() => setShowSaved((open) => !open)}
          >
            Recovery cache {saved.length > 0 ? `(${saved.length})` : ''} {showSaved ? '−' : '+'}
          </button>
          {edited && <span className="switcher-edited">edited</span>}
        </div>
        {showSaved && (
          <SavedJobsPanel
            job={job}
            saved={saved}
            onSave={save}
            onRemove={remove}
            onLoad={(loaded) => { reset(loaded); setEdited(true); }}
          >
            {showAdvanced ? SCENARIOS.map((sc, i) => (sc.group === 'reference' ? (
              <button
                key={sc.tab}
                className="btn ghost"
                aria-pressed={i === index && !edited}
                onClick={() => pickScenario(i)}
              >
                {sc.tab}
              </button>
            ) : null)) : null}
          </SavedJobsPanel>
        )}
        <DesignControls job={job} onChange={editJob} />
        <TakeoffSheet
          job={job}
          details={scenario.details}
          onChange={editJob}
          view="design"
          quarterTurns={quarterTurns}
          onRotate={setQuarterTurns}
        />
        <div className="run-takeoff print-hide">
          <button className="btn run-takeoff-button" onClick={() => void downloadTakeoff()}>
            Takeoff (.xlsx)
          </button>
          <button className="btn run-takeoff-button" onClick={() => void sendToApex()} disabled={sendingToApex}>
            {sendingToApex ? 'Creating estimate…' : apexOpportunities.find((entry) => (entry.jobId ?? entry.leadId) === selectedApexJobId)?.jobId === null ? 'Create estimate from takeoff' : 'Send takeoff to Apex'}
          </button>
          {showAdvanced && (
            <button className="btn ghost" onClick={() => setMode('outputs')}>Engineering details</button>
          )}
        </div>
      </main>
    </div>
  );
}
