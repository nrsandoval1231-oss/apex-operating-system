import { useState } from 'react';
import { STANDARD_MODEL } from './engine/standardModel.ts';
import { APEX_STANDARD_DETAIL, type StandardDetail } from './engine/standardDetail.ts';
import { WHITAKER } from './engine/jobs/whitaker.ts';
import type { Job } from './engine/types.ts';
import { TakeoffSheet } from './ui/TakeoffSheet.tsx';
import { JobEditor } from './ui/JobEditor.tsx';

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

interface Scenario {
  readonly tab: string;
  readonly job: Job;
  readonly details: readonly StandardDetail[];
}

/**
 * The Apex standard detail is stored now, so the real scenarios produce
 * structural quantities. The empty-detail and out-of-envelope tabs keep the two
 * refusal paths visible.
 */
const SCENARIOS: readonly Scenario[] = [
  { tab: 'Standard model', job: STANDARD_MODEL, details: [APEX_STANDARD_DETAIL] },
  { tab: 'Whitaker (built)', job: WHITAKER, details: [APEX_STANDARD_DETAIL] },
  { tab: 'Tight lot · 5 ft', job: TIGHT_LOT, details: [APEX_STANDARD_DETAIL] },
  { tab: 'No detail stored', job: STANDARD_MODEL, details: [] },
  { tab: 'Outside envelope', job: DEEP, details: [APEX_STANDARD_DETAIL] },
];

export function App() {
  const [index, setIndex] = useState(0);
  const [job, setJob] = useState<Job>(SCENARIOS[0]!.job);
  const [edited, setEdited] = useState(false);

  const scenario = SCENARIOS[index]!;

  const pickScenario = (i: number) => {
    setIndex(i);
    setJob(SCENARIOS[i]!.job);
    setEdited(false);
  };

  const editJob = (next: Job) => {
    setJob(next);
    setEdited(true);
  };

  return (
    <div className="app">
      <JobEditor
        job={job}
        onChange={editJob}
        onReset={() => {
          setJob(scenario.job);
          setEdited(false);
        }}
      />

      <main className="app-main">
        <div className="switcher print-hide">
          <span>Job:</span>
          {SCENARIOS.map((sc, i) => (
            <button key={sc.tab} aria-pressed={i === index && !edited} onClick={() => pickScenario(i)}>
              {sc.tab}
            </button>
          ))}
          {edited && <span className="switcher-edited">edited</span>}
        </div>
        <TakeoffSheet job={job} details={scenario.details} />
      </main>
    </div>
  );
}
