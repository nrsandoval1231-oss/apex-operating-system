/**
 * The design controls: everything a builder decides, nothing an engineer does.
 *
 * Add and remove is the point. A job with two benches and no steps is as normal
 * as the standard arrangement, so every object type counts up and down from
 * zero rather than being a fixed part of the template.
 *
 * New objects are placed on a wall with room for them, not stacked on the
 * origin — an added bench that lands underneath the spa reads as a bug even
 * though it can be dragged off. Everything uses the same standard templates the
 * presets use, so a spa added here is identical to one that came with a preset.
 */

import { useEffect, useRef } from 'react';
import { placementRect, wallLengthFt } from '../engine/placement.ts';
import { inToFt } from '../engine/units.ts';
import type { Accessory, Job, Placement, PoolWall, Seat, Spa, StepSet } from '../engine/types.ts';

type SpaMode = 'corner' | 'side' | 'none';

const STANDARD_SPA: Omit<Spa, 'insetIntoPool' | 'placement'> = {
  lengthFt: 6,
  widthFt: 6,
  depthFt: 3.5,
  damWallHeightFt: 1.5,
  damWallThicknessIn: 6,
  attachedToPool: true,
};

/**
 * Somewhere on `wall` that nothing already occupies.
 *
 * Walks the wall in 6" steps and takes the first gap wide enough. Returns null
 * when the wall is full, so the caller can try the next one instead of stacking
 * a second object on top of the first.
 */
function freeSpotOn(job: Job, wall: PoolWall, spanFt: number, projectFt: number): Placement | null {
  const L = job.pool.lengthFt;
  const W = job.pool.widthFt;
  const limit = wallLengthFt(wall, L, W) - spanFt;
  if (limit < 0) return null;

  // Everything already in the water, as rectangles.
  const taken = [
    ...job.pool.steps.map((s) => {
      const place = s.placement ?? { wall: 'shallow' as const, alongFt: 0 };
      return placementRect(place, inToFt(s.treadWidthIn), inToFt(s.treadRunIn) * s.treadCount, L, W);
    }),
    ...job.pool.seats.map((s) => {
      const place = s.placement ?? { wall: 'bottom' as const, alongFt: 0 };
      return placementRect(place, inToFt(s.surfaceWidthIn), inToFt(s.surfaceDepthIn), L, W);
    }),
    // An inset spa occupies the shallow-end corner of the plan itself.
    ...(job.spa?.insetIntoPool ? [{ x: 0, y: 0, widthFt: job.spa.lengthFt, heightFt: job.spa.widthFt }] : []),
  ];

  for (let along = 0; along <= limit + 1e-9; along += 0.5) {
    const rect = placementRect({ wall, alongFt: along }, spanFt, projectFt, L, W);
    const clash = taken.some((other) => (
      rect.x < other.x + other.widthFt
      && other.x < rect.x + rect.widthFt
      && rect.y < other.y + other.heightFt
      && other.y < rect.y + rect.heightFt
    ));
    if (!clash) return { wall, alongFt: along };
  }
  return null;
}

/** First wall with room, in the order these things are normally built. */
function placeSomewhere(job: Job, spanFt: number, projectFt: number, preferred: readonly PoolWall[]): Placement {
  for (const wall of preferred) {
    const spot = freeSpotOn(job, wall, spanFt, projectFt);
    if (spot) return spot;
  }
  // Nothing fits anywhere. Place it at the corner of the preferred wall and let
  // the drawing show the overlap — hiding it would be worse.
  return { wall: preferred[0] ?? 'bottom', alongFt: 0 };
}

const nextId = (existing: readonly { id: string }[], prefix: string) => {
  let n = existing.length + 1;
  const used = new Set(existing.map((e) => e.id));
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
};

export function DesignControls({ job, onChange }: { job: Job; onChange: (job: Job) => void }) {
  /**
   * The last job this toolbar emitted.
   *
   * Two clicks can land in one React task — the buttons sit next to each other
   * and a fast hand beats a re-render. Reading the `job` prop for the second one
   * computed it from the state before the first, so adding a bubbler and then a
   * deck jet produced only the deck jet. Same fix as the keyboard nudges: chain
   * off what was actually emitted, and resync when a job arrives from anywhere
   * else — undo, a preset, a saved design.
   */
  const latest = useRef(job);
  useEffect(() => { latest.current = job; }, [job]);
  const commit = (next: Job) => { latest.current = next; onChange(next); };

  const spaMode: SpaMode = !job.spa ? 'none' : job.spa.insetIntoPool ? 'corner' : 'side';
  const steps = job.pool.steps;
  const benches = job.pool.seats.filter((s) => s.kind !== 'tanningLedge');
  const ledges = job.pool.seats.filter((s) => s.kind === 'tanningLedge');

  const setSpa = (mode: SpaMode) => {
    if (mode === spaMode) return;
    if (mode === 'none') {
      commit({ ...latest.current, spa: undefined });
      return;
    }
    const source = latest.current;
    const base = source.spa ?? STANDARD_SPA;
    commit({
      ...source,
      spa: mode === 'corner'
        ? { ...base, attachedToPool: true, insetIntoPool: true, placement: undefined }
        : {
          ...base,
          attachedToPool: true,
          insetIntoPool: false,
          placement: { wall: 'deep', alongFt: (source.pool.widthFt - base.widthFt) / 2 },
        },
    });
  };

  const addStep = () => {
    const source = latest.current;
    const treadWidthIn = 72;
    const step: StepSet = {
      id: nextId(source.pool.steps, 'S'),
      treadCount: 4,
      treadRunIn: 12,
      treadWidthIn,
      riserHeightsIn: [8, 10, 10, 10, 10],
      floorDepthFt: source.pool.profile.shallowDepth,
      // Only the first stair is the required means of entry and exit.
      isRequiredEntryExit: source.pool.steps.length === 0,
      placement: placeSomewhere(source, inToFt(treadWidthIn), 4, ['shallow', 'top', 'bottom', 'deep']),
    };
    commit({ ...source, pool: { ...source.pool, steps: [...source.pool.steps, step] } });
  };

  const addSeat = (kind: 'bench' | 'tanningLedge') => {
    const source = latest.current;
    const surfaceWidthIn = kind === 'tanningLedge' ? 96 : 72;
    const surfaceDepthIn = kind === 'tanningLedge' ? 60 : 16;
    const seat: Seat = {
      id: nextId(source.pool.seats, kind === 'tanningLedge' ? 'TL' : 'B'),
      kind,
      // A tanning ledge is always 10" of water over the surface — the Apex
      // standard, not a preference.
      depthBelowWaterlineIn: kind === 'tanningLedge' ? 10 : 18,
      surfaceDepthIn,
      surfaceWidthIn,
      leadingEdgeLengthFt: inToFt(surfaceWidthIn),
      floorDepthFt: source.pool.profile.shallowDepth + (kind === 'tanningLedge' ? 0 : 1),
      isRequiredEntryExit: false,
      placement: placeSomewhere(source, inToFt(surfaceWidthIn), inToFt(surfaceDepthIn), ['bottom', 'top', 'deep', 'shallow']),
    };
    commit({ ...source, pool: { ...source.pool, seats: [...source.pool.seats, seat] } });
  };

  const accessories = job.pool.accessories ?? [];
  const bubblers = accessories.filter((a) => a.kind === 'bubbler');
  const deckJets = accessories.filter((a) => a.kind === 'deck-jet');
  const spaJets = job.spa ? job.spa.jetCount ?? 6 : 0;

  const addAccessory = (kind: Accessory['kind']) => {
    const source = latest.current;
    const existing = source.pool.accessories ?? [];
    const acc: Accessory = {
      id: nextId(existing, kind === 'bubbler' ? 'BB' : 'DJ'),
      kind,
      // A bubbler belongs in a shallow surface, so it starts on the wall a ledge
      // would be on; a deck jet stands outside on the deck.
      placement: placeSomewhere(source, 1, 1.2, kind === 'bubbler' ? ['bottom', 'shallow', 'top'] : ['top', 'bottom', 'deep']),
    };
    commit({ ...source, pool: { ...source.pool, accessories: [...existing, acc] } });
  };

  const removeAccessory = (kind: Accessory['kind']) => {
    const source = latest.current;
    const existing = source.pool.accessories ?? [];
    const list = existing.filter((a) => a.kind === kind);
    const drop = list[list.length - 1];
    if (!drop) return;
    commit({ ...source, pool: { ...source.pool, accessories: existing.filter((a) => a !== drop) } });
  };

  const setSpaJets = (delta: number) => {
    const source = latest.current;
    if (!source.spa) return;
    commit({ ...source, spa: { ...source.spa, jetCount: Math.max(0, (source.spa.jetCount ?? 6) + delta) } });
  };

  const removeLast = (which: 'step' | 'bench' | 'ledge') => {
    const source = latest.current;
    if (which === 'step') {
      commit({ ...source, pool: { ...source.pool, steps: source.pool.steps.slice(0, -1) } });
      return;
    }
    const kindMatches = source.pool.seats.filter((s) => (
      which === 'ledge' ? s.kind === 'tanningLedge' : s.kind !== 'tanningLedge'
    ));
    const drop = kindMatches[kindMatches.length - 1];
    if (!drop) return;
    commit({ ...source, pool: { ...source.pool, seats: source.pool.seats.filter((s) => s !== drop) } });
  };

  const counter = (
    label: string,
    count: number,
    add: () => void,
    remove: () => void,
  ) => (
    <span className="dc-group">
      <span className="dc-label">{label}</span>
      <button className="btn ghost dc-step" onClick={remove} disabled={count === 0} aria-label={`Remove ${label}`}>−</button>
      <span className="dc-count" aria-live="polite">{count}</span>
      <button className="btn ghost dc-step" onClick={add} aria-label={`Add ${label}`}>+</button>
    </span>
  );

  return (
    <div className="design-controls print-hide">
      <span className="dc-group">
        <span className="dc-label">Spa</span>
        <button className={spaMode === 'corner' ? 'btn' : 'btn ghost'} aria-pressed={spaMode === 'corner'} onClick={() => setSpa('corner')}>Corner</button>
        <button className={spaMode === 'side' ? 'btn' : 'btn ghost'} aria-pressed={spaMode === 'side'} onClick={() => setSpa('side')}>Spillover</button>
        <button className={spaMode === 'none' ? 'btn' : 'btn ghost'} aria-pressed={spaMode === 'none'} onClick={() => setSpa('none')}>None</button>
      </span>
      {counter('Steps', steps.length, addStep, () => removeLast('step'))}
      {counter('Benches', benches.length, () => addSeat('bench'), () => removeLast('bench'))}
      {counter('Ledges 10"', ledges.length, () => addSeat('tanningLedge'), () => removeLast('ledge'))}
      {counter('Bubblers', bubblers.length, () => addAccessory('bubbler'), () => removeAccessory('bubbler'))}
      {counter('Deck jets', deckJets.length, () => addAccessory('deck-jet'), () => removeAccessory('deck-jet'))}
      {job.spa && counter('Spa jets', spaJets, () => setSpaJets(1), () => setSpaJets(-1))}
      <span className="dc-hint">click anything on the plan to select · Delete removes it</span>
    </div>
  );
}
