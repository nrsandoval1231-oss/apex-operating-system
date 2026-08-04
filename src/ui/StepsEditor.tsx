/**
 * Steps and seats in the editor.
 *
 * These were the largest hole in the form: the engine validates stairs against
 * the Lubbock amendments in detail — tread run, tread width, riser uniformity,
 * bench surface, leading edge — and none of it could be changed without editing
 * source. A code check you cannot respond to is a check that reads as an
 * obstacle rather than as a tool.
 *
 * Risers are edited as a comma-separated list, bottom first, because that is how
 * the code text reads them and how the job stores them. There is one more riser
 * than tread; the form says so rather than silently padding the list, since a
 * wrong riser count is a real geometry error and hiding it would produce a
 * stair that does not reach the deck.
 */

import type { Job, Seat, SeatKind, StepSet } from '../engine/types.ts';

const SEAT_KINDS: readonly SeatKind[] = ['bench', 'swimout', 'tanningLedge'];

function parseRisers(text: string): number[] {
  return text
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

export function StepsEditor({ job, onChange }: { job: Job; onChange: (job: Job) => void }) {
  const steps = job.pool.steps;
  const seats = job.pool.seats;

  const setSteps = (next: readonly StepSet[]) =>
    onChange({ ...job, pool: { ...job.pool, steps: next } });
  const setSeats = (next: readonly Seat[]) =>
    onChange({ ...job, pool: { ...job.pool, seats: next } });

  const patchStep = (i: number, patch: Partial<StepSet>) =>
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const patchSeat = (i: number, patch: Partial<Seat>) =>
    setSeats(seats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addStep = () =>
    setSteps([
      ...steps,
      {
        id: `S${steps.length + 1}`,
        treadCount: 4,
        treadRunIn: 12,
        treadWidthIn: 72,
        riserHeightsIn: [8, 10, 10, 10, 10],
        floorDepthFt: job.pool.profile.shallowDepth,
        // Only one stair can be the required means of entry and exit, and the
        // job already has one if any exist.
        isRequiredEntryExit: steps.length === 0,
      },
    ]);

  const addSeat = () =>
    setSeats([
      ...seats,
      {
        id: `B${seats.length + 1}`,
        kind: 'bench',
        depthBelowWaterlineIn: 18,
        surfaceDepthIn: 16,
        surfaceWidthIn: 96,
        leadingEdgeLengthFt: 8,
        floorDepthFt: job.pool.profile.shallowDepth + 1,
        isRequiredEntryExit: false,
      },
    ]);

  return (
    <>
      <fieldset className="editor-group">
        <legend>Steps</legend>
        <p className="editor-note">
          Risers are bottom first and there is one more riser than tread — the bottom one may taper
          to zero under Lubbock 411.2.2, the rest share the 10&quot; maximum. The stack is floor to
          deck, so it runs deeper than the water by the freeboard.
        </p>
        {steps.map((step, i) => (
          <div className="steps-edit-row" key={i}>
            <input
              type="text"
              value={step.id}
              aria-label={`Step ${i + 1} id`}
              onChange={(e) => patchStep(i, { id: e.target.value })}
            />
            <label>
              <span>treads</span>
              <input
                type="number" min={1} step={1} value={step.treadCount}
                aria-label={`Step ${i + 1} tread count`}
                onChange={(e) => patchStep(i, { treadCount: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>run in</span>
              <input
                type="number" min={0} step={0.5} value={step.treadRunIn}
                aria-label={`Step ${i + 1} tread run`}
                onChange={(e) => patchStep(i, { treadRunIn: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>width in</span>
              <input
                type="number" min={0} step={1} value={step.treadWidthIn}
                aria-label={`Step ${i + 1} tread width`}
                onChange={(e) => patchStep(i, { treadWidthIn: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>floor ft</span>
              <input
                type="number" min={0} step={0.25} value={step.floorDepthFt}
                aria-label={`Step ${i + 1} floor depth`}
                onChange={(e) => patchStep(i, { floorDepthFt: Number(e.target.value) })}
              />
            </label>
            <label className="steps-edit-wide">
              <span>risers in, bottom first</span>
              <input
                type="text"
                value={step.riserHeightsIn.join(', ')}
                aria-label={`Step ${i + 1} risers`}
                onChange={(e) => patchStep(i, { riserHeightsIn: parseRisers(e.target.value) })}
              />
            </label>
            <label className="steps-edit-check">
              <input
                type="checkbox"
                checked={step.isRequiredEntryExit}
                aria-label={`Step ${i + 1} is the required entry and exit`}
                onChange={(e) => patchStep(i, { isRequiredEntryExit: e.target.checked })}
              />
              <span>required entry/exit</span>
            </label>
            <button type="button" onClick={() => setSteps(steps.filter((_, idx) => idx !== i))} aria-label={`Remove step ${i + 1}`}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="editor-add" onClick={addStep}>Add stair</button>
      </fieldset>

      <fieldset className="editor-group">
        <legend>Benches and ledges</legend>
        <p className="editor-note">
          A bench may not serve as the required means of entry and exit (Lubbock 411.5.2). Marking
          one as such is checked, not prevented — the sheet will say it fails rather than quietly
          refusing the input.
        </p>
        {seats.map((seat, i) => (
          <div className="steps-edit-row" key={i}>
            <input
              type="text"
              value={seat.id}
              aria-label={`Seat ${i + 1} id`}
              onChange={(e) => patchSeat(i, { id: e.target.value })}
            />
            <label>
              <span>kind</span>
              <select
                value={seat.kind}
                aria-label={`Seat ${i + 1} kind`}
                onChange={(e) => patchSeat(i, { kind: e.target.value as SeatKind })}
              >
                {SEAT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
            </label>
            <label>
              <span>below WL in</span>
              <input
                type="number" min={0} step={1} value={seat.depthBelowWaterlineIn}
                aria-label={`Seat ${i + 1} depth below waterline`}
                onChange={(e) => patchSeat(i, { depthBelowWaterlineIn: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>depth in</span>
              <input
                type="number" min={0} step={1} value={seat.surfaceDepthIn}
                aria-label={`Seat ${i + 1} surface depth`}
                onChange={(e) => patchSeat(i, { surfaceDepthIn: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>width in</span>
              <input
                type="number" min={0} step={1} value={seat.surfaceWidthIn}
                aria-label={`Seat ${i + 1} surface width`}
                onChange={(e) => patchSeat(i, { surfaceWidthIn: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>floor ft</span>
              <input
                type="number" min={0} step={0.25} value={seat.floorDepthFt}
                aria-label={`Seat ${i + 1} floor depth`}
                onChange={(e) => patchSeat(i, { floorDepthFt: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>lead edge ft</span>
              <input
                type="number" min={0} step={0.5} value={seat.leadingEdgeLengthFt}
                aria-label={`Seat ${i + 1} leading edge`}
                onChange={(e) => patchSeat(i, { leadingEdgeLengthFt: Number(e.target.value) })}
              />
            </label>
            <button type="button" onClick={() => setSeats(seats.filter((_, idx) => idx !== i))} aria-label={`Remove seat ${i + 1}`}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="editor-add" onClick={addSeat}>Add bench or ledge</button>
      </fieldset>
    </>
  );
}
