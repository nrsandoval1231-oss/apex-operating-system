/**
 * The move tool.
 *
 * Wraps the plan SVG and turns a drag on a step, seat, or spa into a change to
 * that object's placement. The SVG itself stays a pure string produced by the
 * engine — this component adds pointer handling around it rather than a second
 * rendering path, so what you drag is what the takeoff draws.
 *
 * One degree of freedom by design. An object slides along the wall it is on, and
 * crosses to another wall only when the pointer is clearly nearer that one.
 * Anything mounted to a pool wall physically has exactly this freedom, and it
 * means every position a drag can produce is a position that can be built.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { renderPlanView, SPA_MOVE_ID } from '../engine/planView.ts';
import {
  alongFromPoint,
  clampAlong,
  placementRect,
  resolveDrag,
  snapAlong,
  wallLengthFt,
} from '../engine/placement.ts';
import { inverseContentPoint, inverseDirection, normalizeTurns, rotationLabel, type QuarterTurns } from '../engine/planRotation.ts';
import { inToFt } from '../engine/units.ts';
import { resizePool } from '../engine/poolResize.ts';
import type { Job, Placement, PoolWall } from '../engine/types.ts';

/** What is being dragged, and what the pointer grabbed it by. */
interface Drag {
  readonly kind: 'step' | 'seat' | 'spa' | 'accessory';
  readonly id: string;
  /** Distance from the object's near edge to the grab point, along the wall. ft */
  readonly grabOffsetFt: number;
  readonly spanFt: number;
}

/** A wall or seat-grip drag, which resizes instead of moving. */
interface ResizeDrag {
  readonly kind: 'pool' | 'seat' | 'step' | 'seat-depth' | 'step-depth';
  readonly id: string | null;
  readonly wall: PoolWall;
}

export function MovablePlan({
  job,
  onChange,
  printWidthIn,
  quarterTurns = 0,
  onRotate,
  children,
}: {
  job: Job;
  onChange: (job: Job) => void;
  printWidthIn: number;
  /** Quarter turns clockwise applied to the sheet. The job is unaffected. */
  quarterTurns?: QuarterTurns;
  onRotate?: (turns: QuarterTurns) => void;
  children?: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const dragRef = useRef<Drag | null>(null);
  const resizeRef = useRef<ResizeDrag | null>(null);
  /**
   * In-flight drag position, held twice on purpose.
   *
   * The state drives the drawing. The ref is what gets committed, because
   * pointermove and pointerup can land in the same task — React batches, the
   * component does not re-render between them, and the pointerup handler then
   * closes over a `preview` that is still null. Reading state to decide what to
   * commit silently dropped the whole drag.
   */
  const [preview, setPreview] = useState<Job | null>(null);
  const previewRef = useRef<Job | null>(null);
  const setDragPreview = useCallback((next: Job | null) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  /**
   * The most recent job this component produced, for the same batching reason.
   *
   * Hold an arrow key down and the keydowns land in one task. Each nudge read
   * the `job` prop, which React had not re-rendered yet, so every keypress
   * computed from the position before the first one and only the last survived —
   * three nudges moved the bench 1 ft instead of 2.
   */
  const latestRef = useRef(job);
  useEffect(() => {
    // A job arriving from above — undo, the editor, a scenario switch — is the
    // new truth and supersedes anything this component last emitted.
    latestRef.current = job;
  }, [job]);

  // The drawing follows the pointer, but only the committed job reaches the
  // takeoff and the history.
  const shown = preview ?? job;
  const plan = renderPlanView(shown, 1040, { selectedId, interactive: true, quarterTurns });

  /**
   * Client pixels to plan feet.
   *
   * getScreenCTM rather than arithmetic on getBoundingClientRect: the CTM is the
   * browser's own client-to-user-space mapping, so it already accounts for the
   * responsive width, page zoom, and any transform on an ancestor.
   *
   * The hand-rolled version divided by the element's displayed width, which is
   * zero whenever the drawing is not being laid out — a hidden tab, a print
   * pass, a pane that is not compositing. That produced a non-finite scale, and
   * every drag collapsed to the corner because the clamp turned NaN into zero.
   */
  const toPlanFeet = useCallback(
    (clientX: number, clientY: number) => {
      const svg = hostRef.current?.querySelector('svg');
      if (!svg) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      /**
       * The one place rotation touches the move tool.
       *
       * getScreenCTM stops at the <svg>, so a rotated sheet hands back a point
       * in the turned frame while every rule in placement.ts is written against
       * the unrotated layout. Undoing the turn here — and only here — is what
       * keeps "which wall is this being dropped on" a question about the pool
       * rather than a question about the page.
       */
      const laid = inverseContentPoint(
        plan.quarterTurns,
        { x: point.x, y: point.y },
        { widthPx: plan.layoutWidthPx, heightPx: plan.layoutHeightPx },
      );
      return {
        xFt: (laid.x - plan.originXPx) / plan.pxPerFt,
        yFt: (laid.y - plan.originYPx) / plan.pxPerFt,
      };
    },
    [
      plan.originXPx,
      plan.originYPx,
      plan.pxPerFt,
      plan.quarterTurns,
      plan.layoutWidthPx,
      plan.layoutHeightPx,
    ],
  );

  const spanOf = useCallback(
    (kind: Drag['kind'], id: string): number => {
      if (kind === 'accessory') return 1;
      if (kind === 'spa') return job.spa?.widthFt ?? 0;
      if (kind === 'step') {
        const step = job.pool.steps.find((s) => s.id === id);
        return step ? inToFt(step.treadWidthIn) : 0;
      }
      const seat = job.pool.seats.find((s) => s.id === id);
      return seat ? inToFt(seat.surfaceWidthIn) : 0;
    },
    [job],
  );

  const placementOf = useCallback(
    (kind: Drag['kind'], id: string): Placement => placementOfIn(job, kind, id),
    [job],
  );

  /**
   * Returns the next job rather than committing it, so a drag can preview
   * without writing to history. A pointermove fires on every pixel; committing
   * each one would put several hundred entries behind one drag and leave undo
   * stepping back through a mouse gesture.
   */
  const withPlacement = useCallback(
    (source: Job, kind: Drag['kind'], id: string, placement: Placement): Job => {
      if (kind === 'accessory') {
        return {
          ...source,
          pool: {
            ...source.pool,
            accessories: (source.pool.accessories ?? []).map((a) => (a.id === id ? { ...a, placement } : a)),
          },
        };
      }
      if (kind === 'spa') {
        return source.spa ? { ...source, spa: { ...source.spa, placement } } : source;
      }
      if (kind === 'step') {
        return {
          ...source,
          pool: {
            ...source.pool,
            steps: source.pool.steps.map((s) => (s.id === id ? { ...s, placement } : s)),
          },
        };
      }
      return {
        ...source,
        pool: {
          ...source.pool,
          seats: source.pool.seats.map((s) => (s.id === id ? { ...s, placement } : s)),
        },
      };
    },
    [],
  );

  /**
   * Remove the selected object.
   *
   * Deleting the thing you are looking at is the natural gesture; the counters
   * in the toolbar can only drop the last one, which is the wrong one whenever
   * a job has two benches and you want the first.
   */
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const base = latestRef.current;
    let next = base;
    if (selectedId === SPA_MOVE_ID) {
      next = { ...base, spa: undefined };
    } else if (base.pool.steps.some((s) => s.id === selectedId)) {
      next = { ...base, pool: { ...base.pool, steps: base.pool.steps.filter((s) => s.id !== selectedId) } };
    } else if (base.pool.seats.some((s) => s.id === selectedId)) {
      next = { ...base, pool: { ...base.pool, seats: base.pool.seats.filter((s) => s.id !== selectedId) } };
    } else if ((base.pool.accessories ?? []).some((a) => a.id === selectedId)) {
      next = {
        ...base,
        pool: { ...base.pool, accessories: (base.pool.accessories ?? []).filter((a) => a.id !== selectedId) },
      };
    } else {
      return;
    }
    latestRef.current = next;
    setSelectedId(undefined);
    onChange(next);
  }, [selectedId, onChange]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;

    // Resize grips sit above the move rects and win the press.
    const grip = target?.closest?.('[data-resize-kind]') as SVGElement | null;
    if (grip) {
      resizeRef.current = {
        kind: grip.getAttribute('data-resize-kind') as ResizeDrag['kind'],
        id: grip.getAttribute('data-resize-id'),
        wall: (grip.getAttribute('data-resize-wall') ?? 'deep') as PoolWall,
      };
      try {
        (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      } catch { /* capture is optional */ }
      event.preventDefault();
      return;
    }

    const handle = target?.closest?.('[data-move-id]') as SVGElement | null;
    if (!handle) {
      setSelectedId(undefined);
      return;
    }
    const kind = handle.getAttribute('data-move-kind') as Drag['kind'] | null;
    const id = handle.getAttribute('data-move-id');
    if (!kind || !id) return;

    // Select first. Pressing a thing is what selects it, and that should not
    // depend on the coordinate mapping succeeding — if the drawing is not laid
    // out the drag cannot start, but the selection and its keyboard nudges are
    // still perfectly usable.
    setSelectedId(id);

    const point = toPlanFeet(event.clientX, event.clientY);
    if (point) {
      const placement = placementOf(kind, id);
      const along = alongFromPoint(placement.wall, point.xFt, point.yFt);
      dragRef.current = {
        kind,
        id,
        // Grab offset, so the object does not jump its own half-width to the
        // cursor the instant the pointer moves.
        grabOffsetFt: along - placement.alongFt,
        spanFt: spanOf(kind, id),
      };
    }
    // Capture keeps the drag alive when the pointer leaves the object, but it is
    // an optimisation, not the mechanism. Losing it must not lose the drag.
    try {
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    } catch {
      /* no capture: pointermove on the host still drives the drag */
    }
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (resize) {
      const point = toPlanFeet(event.clientX, event.clientY);
      if (!point) return;
      const base = previewRef.current ?? job;
      if (resize.kind === 'pool') {
        // The pointer implies a new length or width; the policy — snapping,
        // limits, how the depth profile absorbs a shorter pool — is resizePool.
        const target = resize.wall === 'deep' ? point.xFt
          : resize.wall === 'shallow' ? base.pool.lengthFt - point.xFt
            : resize.wall === 'bottom' ? point.yFt
              : base.pool.widthFt - point.yFt;
        setDragPreview(resizePool(base, resize.wall, target));
      } else if (resize.id) {
        // Object grip: the new width runs from the object's near edge to the
        // pointer, snapped to 6". The floor is the Lubbock minimum stair width
        // (20") and a workable bench (24") rather than zero.
        // Depth grips reach into the water: how far the object projects from its
        // wall, measured perpendicular to the along axis.
        if (resize.kind === 'seat-depth' || resize.kind === 'step-depth') {
          const place = placementOfIn(base, resize.kind === 'step-depth' ? 'step' : 'seat', resize.id);
          const endsOn = place.wall === 'shallow' || place.wall === 'deep';
          const into = endsOn
            ? (place.wall === 'shallow' ? point.xFt : base.pool.lengthFt - point.xFt)
            : (place.wall === 'top' ? point.yFt : base.pool.widthFt - point.yFt);
          const inches = Math.max(6, Math.round((into * 12) / 6) * 6);
          if (resize.kind === 'step-depth') {
            // Tread RUN, never tread count: the count sets the rise, and the
            // rise is code-checked. Floored at the Lubbock 12" minimum.
            setDragPreview({
              ...base,
              pool: {
                ...base.pool,
                steps: base.pool.steps.map((st) => (st.id === resize.id
                  ? { ...st, treadRunIn: Math.max(12, Math.round(inches / st.treadCount / 6) * 6) }
                  : st)),
              },
            });
          } else {
            setDragPreview({
              ...base,
              pool: {
                ...base.pool,
                seats: base.pool.seats.map((st) => (st.id === resize.id ? { ...st, surfaceDepthIn: inches } : st)),
              },
            });
          }
          return;
        }
        const kind = resize.kind;
        const place = placementOfIn(base, kind, resize.id);
        const along = alongFromPoint(place.wall, point.xFt, point.yFt);
        const raw = Math.round(((along - place.alongFt) * 12) / 6) * 6;
        if (kind === 'step') {
          const widthIn = Math.max(20, raw);
          setDragPreview({
            ...base,
            pool: {
              ...base.pool,
              steps: base.pool.steps.map((s) => (s.id === resize.id ? { ...s, treadWidthIn: widthIn } : s)),
            },
          });
        } else {
          const widthIn = Math.max(24, raw);
          setDragPreview({
            ...base,
            pool: {
              ...base.pool,
              seats: base.pool.seats.map((s) => (s.id === resize.id ? { ...s, surfaceWidthIn: widthIn } : s)),
            },
          });
        }
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const point = toPlanFeet(event.clientX, event.clientY);
    if (!point) return;

    const L = job.pool.lengthFt;
    const W = job.pool.widthFt;
    const base = previewRef.current ?? job;

    setDragPreview(withPlacement(base, drag.kind, drag.id, resolveDrag({
      current: placementOfIn(base, drag.kind, drag.id),
      pointXFt: point.xFt,
      pointYFt: point.yFt,
      grabOffsetFt: drag.grabOffsetFt,
      spanFt: drag.spanFt,
      poolLengthFt: L,
      poolWidthFt: W,
    })));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current && !resizeRef.current) return;
    dragRef.current = null;
    resizeRef.current = null;
    // Commit FIRST. Releasing a capture that was never taken throws
    // InvalidPointerId, and when that ran ahead of the commit it threw away the
    // edit the drag had just made — the object snapped back and undo stayed
    // empty.
    const committed = previewRef.current;
    setDragPreview(null);
    if (committed) onChange(committed);
    releaseCapture(event.currentTarget as Element, event.pointerId);
  };

  // Keyboard nudge. A drag is fine for roughing a layout in and useless for
  // "six inches left", which is the edit someone actually makes second.
  useEffect(() => {
    if (!selectedId) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 1 : 0.5;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Not while typing in the advanced form.
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
        event.preventDefault();
        deleteSelected();
        return;
      }
      // The key is a direction on the SHEET; `alongFt` is measured in the
      // layout. On a turned sheet those disagree, and at 180° they are exactly
      // opposed — so the arrow is mapped back through the same inverse a drag
      // uses rather than trusted as-is.
      const screen = event.key === 'ArrowLeft' ? { dx: -1, dy: 0 }
        : event.key === 'ArrowRight' ? { dx: 1, dy: 0 }
          : event.key === 'ArrowUp' ? { dx: 0, dy: -1 }
            : event.key === 'ArrowDown' ? { dx: 0, dy: 1 }
              : null;
      if (!screen) return;
      const inLayout = inverseDirection(plan.quarterTurns, screen.dx, screen.dy);
      // Exactly one axis is non-zero, so the sum is that axis's sign. Positive
      // x or y is further along a wall, matching `alongFt`.
      const delta = Math.sign(inLayout.x + inLayout.y) * step;
      if (delta === 0) return;
      const kind: Drag['kind'] = selectedId === SPA_MOVE_ID ? 'spa'
        : job.pool.steps.some((s) => s.id === selectedId) ? 'step' : 'seat';
      // Chain off the last job this component produced, not the prop, so a held
      // arrow key accumulates instead of every repeat starting from the same
      // place.
      const base = latestRef.current;
      const placement = placementOfIn(base, kind, selectedId);
      const spanFt = spanOf(kind, selectedId);
      event.preventDefault();
      // A nudge is one discrete decision, so it commits immediately and is its
      // own undo step.
      const next = withPlacement(base, kind, selectedId, {
        ...placement,
        alongFt: snapAlong(clampAlong(placement.alongFt + delta, spanFt, placement.wall, base.pool.lengthFt, base.pool.widthFt)),
      });
      latestRef.current = next;
      onChange(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, job, spanOf, withPlacement, onChange, deleteSelected, plan.quarterTurns]);

  const readout = selectedId ? describe(shown, selectedId) : null;

  return (
    <div
      className="plan-frame plan-sheet plan-movable"
      style={{ ['--plan-print-width' as string]: `${printWidthIn.toFixed(2)}in` }}
    >
      <div
        ref={hostRef}
        className="plan-move-host"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        dangerouslySetInnerHTML={{ __html: plan.svg }}
      />
      <div className="plan-move-bar">
        {readout
          ? <span><strong>{readout.label}</strong> · {readout.wall} wall · {readout.along} from the corner · arrow keys nudge 6", shift 1'</span>
          : <span>Drag a step, bench or spa to place it. Everything else on the plan is fixed by the job.</span>}
        {onRotate && (
          <button
            className="btn ghost plan-rotate"
            onClick={() => onRotate(normalizeTurns(quarterTurns + 1))}
            // The wall a readout names is the pool's wall, not the sheet's edge,
            // and stays true however the sheet is turned. Saying so here is
            // cheaper than someone discovering it by mistrusting the drawing.
            title="Turn the sheet a quarter turn clockwise. The pool, its walls and its quantities are unchanged."
          >
            Rotate · {rotationLabel(quarterTurns)}
          </button>
        )}
        {readout && (
          <button className="btn ghost plan-delete" onClick={deleteSelected}>
            Delete {readout.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function releaseCapture(element: Element, pointerId: number): void {
  try {
    element.releasePointerCapture?.(pointerId);
  } catch {
    /* never captured, or already released */
  }
}

/**
 * The placement an object currently has, or the fallback the renderer uses for
 * an unplaced one. Takes the job explicitly so a drag in progress can read from
 * its own preview rather than from the last committed state — otherwise every
 * pointermove would compute its move from where the object was before the drag
 * started, and a wall switch would be undone on the next event.
 */
function placementOfIn(source: Job, kind: Drag['kind'], id: string): Placement {
  const L = source.pool.lengthFt;
  const W = source.pool.widthFt;
  if (kind === 'accessory') {
    const acc = (source.pool.accessories ?? []).find((a) => a.id === id);
    return acc?.placement ?? { wall: 'bottom', alongFt: L / 2 };
  }
  if (kind === 'spa') {
    return source.spa?.placement ?? { wall: 'deep', alongFt: (W - (source.spa?.widthFt ?? 0)) / 2 };
  }
  if (kind === 'step') {
    const step = source.pool.steps.find((s) => s.id === id);
    return step?.placement ?? { wall: 'shallow', alongFt: (W - inToFt(step?.treadWidthIn ?? 0)) / 2 };
  }
  const seat = source.pool.seats.find((s) => s.id === id);
  return seat?.placement ?? { wall: 'bottom', alongFt: L * 0.62 };
}

function describe(job: Job, id: string): { label: string; wall: string; along: string } | null {
  const L = job.pool.lengthFt;
  const W = job.pool.widthFt;
  const fmt = (ft: number) => {
    const f = Math.floor(ft + 1e-9);
    const i = Math.round((ft - f) * 12);
    return i === 12 ? `${f + 1}'-0"` : `${f}'-${i}"`;
  };
  if (id === SPA_MOVE_ID && job.spa) {
    const place = job.spa.placement ?? { wall: 'deep' as const, alongFt: (W - job.spa.widthFt) / 2 };
    return { label: 'Spa', wall: place.wall, along: fmt(place.alongFt) };
  }
  const step = job.pool.steps.find((s) => s.id === id);
  if (step) {
    const place = step.placement ?? { wall: 'shallow' as const, alongFt: (W - inToFt(step.treadWidthIn)) / 2 };
    return { label: `Steps ${step.id}`, wall: place.wall, along: fmt(place.alongFt) };
  }
  const seat = job.pool.seats.find((s) => s.id === id);
  if (seat) {
    const place = seat.placement ?? { wall: 'bottom' as const, alongFt: L * 0.62 };
    return { label: `${seat.kind} ${seat.id}`, wall: place.wall, along: fmt(place.alongFt) };
  }
  const acc = (job.pool.accessories ?? []).find((a) => a.id === id);
  if (acc) {
    const place = acc.placement ?? { wall: 'bottom' as const, alongFt: L / 2 };
    return { label: `${acc.kind === 'deck-jet' ? 'deck jet' : 'bubbler'} ${acc.id}`, wall: place.wall, along: fmt(place.alongFt) };
  }
  return null;
}

// Re-exported so the sheet can size its print column without importing the
// engine twice.
export { placementRect, wallLengthFt };
