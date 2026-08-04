/**
 * The design controls: everything a builder decides, nothing an engineer does.
 *
 * Spa in the corner, spa off the side with a spillover, or none. Steps or no
 * steps. A tanning ledge, always 10" below the waterline because that is the
 * Apex standard — its size is set by dragging its grip on the plan, not typed.
 *
 * Every option is a whole-job transformation using the same standard templates
 * the presets use, so a spa added here is identical to a spa that came with the
 * preset. One click is one undo step.
 */

import type { Job, Seat, Spa, StepSet } from '../engine/types.ts';

type SpaMode = 'corner' | 'side' | 'none';

const STANDARD_SPA: Omit<Spa, 'insetIntoPool' | 'placement'> = {
  lengthFt: 6,
  widthFt: 6,
  depthFt: 3.5,
  damWallHeightFt: 1.5,
  damWallThicknessIn: 6,
  attachedToPool: true,
};

const standardSteps = (shallowDepthFt: number): StepSet => ({
  id: 'S1',
  treadCount: 4,
  treadRunIn: 12,
  treadWidthIn: 72,
  riserHeightsIn: [8, 10, 10, 10, 10],
  floorDepthFt: shallowDepthFt,
  isRequiredEntryExit: true,
  placement: { wall: 'shallow', alongFt: 0 },
});

/** Apex standard tanning ledge: always 10" of water over the surface. */
const standardLedge = (shallowDepthFt: number): Seat => ({
  id: 'TL1',
  kind: 'tanningLedge',
  depthBelowWaterlineIn: 10,
  surfaceDepthIn: 60,
  surfaceWidthIn: 96,
  leadingEdgeLengthFt: 8,
  floorDepthFt: shallowDepthFt,
  isRequiredEntryExit: false,
  placement: { wall: 'bottom', alongFt: 0 },
});

export function DesignControls({ job, onChange }: { job: Job; onChange: (job: Job) => void }) {
  const spaMode: SpaMode = !job.spa ? 'none' : job.spa.insetIntoPool ? 'corner' : 'side';
  const hasSteps = job.pool.steps.length > 0;
  const ledge = job.pool.seats.find((seat) => seat.kind === 'tanningLedge');

  const setSpa = (mode: SpaMode) => {
    if (mode === spaMode) return;
    if (mode === 'none') {
      onChange({ ...job, spa: undefined });
      return;
    }
    // Keep an existing spa's dimensions when only its placement changes.
    const base = job.spa ?? STANDARD_SPA;
    onChange({
      ...job,
      spa: mode === 'corner'
        ? { ...base, attachedToPool: true, insetIntoPool: true, placement: undefined }
        : {
          ...base,
          attachedToPool: true,
          insetIntoPool: false,
          placement: { wall: 'deep', alongFt: (job.pool.widthFt - base.widthFt) / 2 },
        },
    });
  };

  const setSteps = (on: boolean) => {
    if (on === hasSteps) return;
    onChange({
      ...job,
      pool: { ...job.pool, steps: on ? [standardSteps(job.pool.profile.shallowDepth)] : [] },
    });
  };

  const setLedge = (on: boolean) => {
    if (on === Boolean(ledge)) return;
    onChange({
      ...job,
      pool: {
        ...job.pool,
        seats: on
          ? [...job.pool.seats, standardLedge(job.pool.profile.shallowDepth)]
          : job.pool.seats.filter((seat) => seat.kind !== 'tanningLedge'),
      },
    });
  };

  return (
    <div className="design-controls print-hide">
      <span className="dc-group">
        <span className="dc-label">Spa</span>
        <button aria-pressed={spaMode === 'corner'} onClick={() => setSpa('corner')}>Corner, built in</button>
        <button aria-pressed={spaMode === 'side'} onClick={() => setSpa('side')}>Off the side, spillover</button>
        <button aria-pressed={spaMode === 'none'} onClick={() => setSpa('none')}>None</button>
      </span>
      <span className="dc-group">
        <span className="dc-label">Steps</span>
        <button aria-pressed={hasSteps} onClick={() => setSteps(true)}>Standard</button>
        <button aria-pressed={!hasSteps} onClick={() => setSteps(false)}>None</button>
      </span>
      <span className="dc-group">
        <span className="dc-label">Tanning ledge · 10&quot; deep</span>
        <button aria-pressed={Boolean(ledge)} onClick={() => setLedge(true)}>Add</button>
        <button aria-pressed={!ledge} onClick={() => setLedge(false)}>None</button>
      </span>
      <span className="dc-hint">drag anything on the plan to move it · drag walls and grips to resize</span>
    </div>
  );
}
