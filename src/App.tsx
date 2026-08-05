import { useEffect, useState } from 'react';
import { STANDARD_MODEL } from './engine/standardModel.ts';
import { APEX_STANDARD_DETAIL, type StandardDetail } from './engine/standardDetail.ts';
import { WHITAKER } from './engine/jobs/whitaker.ts';
import { LUBBOCK_STANDARDS } from './engine/jobs/lubbockStandards.ts';
import type { Job } from './engine/types.ts';
import { TakeoffSheet } from './ui/TakeoffSheet.tsx';
import type { QuarterTurns } from './engine/planRotation.ts';
import { JobEditor } from './ui/JobEditor.tsx';
import { DesignControls } from './ui/DesignControls.tsx';
import { SavedJobsPanel, useSavedJobs } from './ui/SavedJobs.tsx';

/**
 * A tight lot: same pool, 5 ft to the house slab. The 6 ft deep end violates
 * the 1:1 ratio in local 307.2.2.2. Kept here so the failing path is visible
 * without editing code — PRD open question 7 asks whether this is the common
 * case on a Lubbock lot rather than the exception.
 */
const TIGHT_LOT: Job = {
  ...STANDARD_MODEL,
  name: 'Standard model on a tight lot — 5 ft to foundation',
  site: { distanceToFoundationFt: 5, foundationDescription: 'house slab foundation' },
};

/** Deeper than the detail's 8 ft envelope, so structure refuses. */
const DEEP: Job = {
  ...STANDARD_MODEL,
  name: 'Deep job — 9 ft, outside the detail envelope',
  pool: {
    ...STANDARD_MODEL.pool,
    profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 9 },
  },
  site: { distanceToFoundationFt: 12, foundationDescription: 'house slab foundation' },
};

/** Undo history: the jobs so far, and which one is showing. */
interface History {
  readonly entries: readonly Job[];
  readonly cursor: number;
}

interface Scenario {
  readonly tab: string;
  readonly job: Job;
  readonly details: readonly StandardDetail[];
  /** Standards start a job; references exist to prove the engine still refuses. */
  readonly group: 'standard' | 'reference';
}

/**
 * What the buttons offer, in two groups.
 *
 * The three Lubbock standards come first because they are what someone starting
 * a job actually wants — Travis puts them at roughly 90% of the work. The rest
 * are engine fixtures and deliberate failure cases; they are kept because they
 * are the only visible proof that the refusal paths still refuse, but they are
 * not a starting point for a real pool and no longer read as one.
 */
const SCENARIOS: readonly Scenario[] = [
  ...LUBBOCK_STANDARDS.map((standard) => ({
    tab: standard.label,
    job: standard.job,
    details: [APEX_STANDARD_DETAIL],
    group: 'standard' as const,
  })),
  { tab: 'Whitaker (built)', job: WHITAKER, details: [APEX_STANDARD_DETAIL], group: 'reference' },
  { tab: 'PRD standard model', job: STANDARD_MODEL, details: [APEX_STANDARD_DETAIL], group: 'reference' },
  { tab: 'Tight lot · 5 ft', job: TIGHT_LOT, details: [APEX_STANDARD_DETAIL], group: 'reference' },
  { tab: 'No detail stored', job: STANDARD_MODEL, details: [], group: 'reference' },
  { tab: 'Outside envelope', job: DEEP, details: [APEX_STANDARD_DETAIL], group: 'reference' },
];

/**
 * Charcoal header carrying the real Apex lockup.
 *
 * The logo is a badge with its own sage panel — used verbatim, never recoloured
 * or knocked out, per the note that ships with the asset. It already contains
 * the word APEX, so nothing here repeats it as text.
 */
function AppHeader({ jobName, right }: { jobName: string; right?: React.ReactNode }) {
  return (
    <header className="app-header">
      <img src="/brand/apex-logo.png" alt="Apex" width={126} height={30} />
      <div className="app-header-title">
        <strong>Designer</strong>
        <span>{jobName}</span>
      </div>
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
            </>
          )}
        />
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
            Saved designs {saved.length > 0 ? `(${saved.length})` : ''} {showSaved ? '−' : '+'}
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
            {SCENARIOS.map((sc, i) => (sc.group === 'reference' ? (
              <button
                key={sc.tab}
                className="btn ghost"
                aria-pressed={i === index && !edited}
                onClick={() => pickScenario(i)}
              >
                {sc.tab}
              </button>
            ) : null))}
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
          <button className="btn run-takeoff-button" onClick={() => setMode('outputs')}>
            Run full takeoff → dig plan · material quantities · plumbing · equipment pad
          </button>
        </div>
      </main>
    </div>
  );
}
