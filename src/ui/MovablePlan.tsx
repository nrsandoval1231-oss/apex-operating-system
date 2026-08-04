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
import { inToFt } from '../engine/units.ts';
import type { Job, Placement } from '../engine/types.ts';

/** What is being dragged, and what the pointer grabbed it by. */
interface Drag {
  readonly kind: 'step' | 'seat' | 'spa';
  readonly id: string;
  /** Distance from the object's near edge to the grab point, along the wall. ft */
  readonly grabOffsetFt: number;
  readonly spanFt: number;
}

export function MovablePlan({
  job,
  onChange,
  printWidthIn,
  children,
}: {
  job: Job;
  onChange: (job: Job) => void;
  printWidthIn: number;
  children?: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const dragRef = useRef<Drag | null>(null);
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

  // The drawing follows the pointer, but only the committed job reaches the
  // takeoff and the history.
  const shown = preview ?? job;
  const plan = renderPlanView(shown, 1040, { selectedId });

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
      return {
        xFt: (point.x - plan.originXPx) / plan.pxPerFt,
        yFt: (point.y - plan.originYPx) / plan.pxPerFt,
      };
    },
    [plan.originXPx, plan.originYPx, plan.pxPerFt],
  );

  const spanOf = useCallback(
    (kind: Drag['kind'], id: string): number => {
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

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;
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
    if (!dragRef.current) return;
    dragRef.current = null;
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
      const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -step
        : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? step
          : 0;
      if (delta === 0) return;
      const kind: Drag['kind'] = selectedId === SPA_MOVE_ID ? 'spa'
        : job.pool.steps.some((s) => s.id === selectedId) ? 'step' : 'seat';
      const placement = placementOf(kind, selectedId);
      const spanFt = spanOf(kind, selectedId);
      event.preventDefault();
      // A nudge is one discrete decision, so it commits immediately and is its
      // own undo step.
      onChange(withPlacement(job, kind, selectedId, {
        ...placement,
        alongFt: snapAlong(clampAlong(placement.alongFt + delta, spanFt, placement.wall, job.pool.lengthFt, job.pool.widthFt)),
      }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, job, placementOf, spanOf, withPlacement, onChange]);

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
  return null;
}

// Re-exported so the sheet can size its print column without importing the
// engine twice.
export { placementRect, wallLengthFt };
