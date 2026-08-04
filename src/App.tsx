import { useEffect, useState } from 'react';
import { STANDARD_MODEL } from './engine/standardModel.ts';
import { APEX_STANDARD_DETAIL, type StandardDetail } from './engine/standardDetail.ts';
import { WHITAKER } from './engine/jobs/whitaker.ts';
import { LUBBOCK_STANDARDS } from './engine/jobs/lubbockStandards.ts';
import type { Job } from './engine/types.ts';
import { TakeoffSheet } from './ui/TakeoffSheet.tsx';
import { JobEditor } from './ui/JobEditor.tsx';
import { DesignControls } from './ui/DesignControls.tsx';

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

export function App() {
  const [index, setIndex] = useState(0);
  /**
   * Job history, not a job. Dragging something to the wrong place and not being
   * able to put it back is the fastest way to stop trusting a move tool, so undo
   * arrived with the drag rather than after it.
   */
  const [past, setPast] = useState<History>({ entries: [SCENARIOS[0]!.job], cursor: 0 });
  const [showReference, setShowReference] = useState(false);
  const [edited, setEdited] = useState(false);
  /**
   * 'design' is the builder's screen: three sizes, two drawings, six buttons.
   * 'outputs' is the engine's answer: dig plan, material quantities, plumbing
   * design and the equipment pad, which is the full sheet it always produced.
   * The engine runs in both — design mode just declines to show the working.
   */
  const [mode, setMode] = useState<'design' | 'outputs'>('design');
  const [showAdvanced, setShowAdvanced] = useState(false);

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
          <div className="switcher print-hide">
            <button onClick={() => setMode('design')}>← Back to design</button>
            <span>Outputs:</span>
            {[
              ['out-dig', 'Dig plan'],
              ['out-materials', 'Material quantities'],
              ['out-plumbing', 'Plumbing design'],
              ['out-equipment', 'Equipment pad'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => document.getElementById(id!)?.scrollIntoView({ behavior: 'smooth' })}>
                {label}
              </button>
            ))}
          </div>
          <TakeoffSheet job={job} details={scenario.details} />
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
        <div className="switcher print-hide">
          <span>Start from:</span>
          {SCENARIOS.map((sc, i) => (sc.group === 'standard' ? (
            <button key={sc.tab} aria-pressed={i === index && !edited} onClick={() => pickScenario(i)}>
              {sc.tab}
            </button>
          ) : null))}
          <button
            className="switcher-more"
            aria-expanded={showReference}
            onClick={() => setShowReference((open) => !open)}
          >
            Reference jobs {showReference ? '−' : '+'}
          </button>
          {edited && <span className="switcher-edited">edited</span>}
          <span className="switcher-undo">
            <button onClick={undo} disabled={!canUndo}>Undo</button>
            <button onClick={redo} disabled={!canRedo}>Redo</button>
            <button
              aria-pressed={showAdvanced}
              onClick={() => setShowAdvanced((open) => !open)}
            >
              Advanced
            </button>
          </span>
        </div>
        {showReference && (
          <div className="switcher switcher-reference print-hide">
            <span>Engine fixtures and refusal cases, not starting points:</span>
            {SCENARIOS.map((sc, i) => (sc.group === 'reference' ? (
              <button key={sc.tab} aria-pressed={i === index && !edited} onClick={() => pickScenario(i)}>
                {sc.tab}
              </button>
            ) : null))}
          </div>
        )}
        <DesignControls job={job} onChange={editJob} />
        <TakeoffSheet job={job} details={scenario.details} onChange={editJob} view="design" />
        <div className="run-takeoff print-hide">
          <button className="run-takeoff-button" onClick={() => setMode('outputs')}>
            Run full takeoff → dig plan · material quantities · plumbing · equipment pad
          </button>
        </div>
      </main>
    </div>
  );
}
