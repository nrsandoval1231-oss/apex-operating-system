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
import {
  clampWithin, GRID_FT, MAGNET_RANGE_FT, snapToGrid, snapWithMagnets,
  type Magnet, type Neighbour, type PlanPoint,
} from '../engine/grid.ts';
import { inToFt } from '../engine/units.ts';
import { resizePool } from '../engine/poolResize.ts';
import type { Job, Placement, PoolWall } from '../engine/types.ts';

/**
 * Everything on the plan now moves in two dimensions.
 *
 * Steps started out wall-bound, and for a stair built into a pool wall that is
 * the truth. But a stair is also how you get out of a tanning ledge, and one
 * coming off a ledge is against no pool wall at all — so it needs the same two
 * degrees of freedom, plus the ability to land flush on the ledge's edge.
 * `abutMagnets` is what makes "flush" exact rather than nearly.
 */
const MOVES_FREELY: ReadonlySet<Drag['kind']> = new Set(['spa', 'accessory', 'step', 'seat']);

/** What is being dragged, and what the pointer grabbed it by. */
interface Drag {
  readonly kind: 'step' | 'seat' | 'spa' | 'accessory';
  readonly id: string;
  /** Distance from the object's near edge to the grab point, along the wall. ft */
  readonly grabOffsetFt: number;
  readonly spanFt: number;
  /**
   * For a free drag: pointer offset from the object's top-left, in plan feet.
   * Without it the object jumps its own half-size to the cursor on the first
   * pixel of movement, same reason `grabOffsetFt` exists for a wall drag.
   */
  readonly grabFree?: PlanPoint;
  /** The object's own size, so magnets can align its edges and not its origin. */
  readonly sizeFt?: { readonly widthFt: number; readonly heightFt: number };
}

/** A wall or object grip drag, which resizes instead of moving. */
interface ResizeDrag {
  readonly kind: 'pool' | 'object';
  readonly id: string | null;
  readonly wall: PoolWall;
  /** For an object grip: which kind of object is being resized. */
  readonly target?: 'spa' | 'seat' | 'step';
}

/**
 * Smallest buildable size for each thing you can drag a corner on, in feet.
 *
 * These are not tidiness. 20" is the Lubbock minimum stair width and 12" the
 * minimum tread run; 24" and 10" are the bench minimums the code checks read.
 * A drag that can produce a stair narrower than the code allows is a drag that
 * produces a drawing somebody has to be told is wrong later.
 */
const MIN_SIZE_FT: Record<'spa' | 'seat' | 'step', { readonly x: number; readonly y: number }> = {
  // x is the run into the pool, y the width along the wall.
  spa: { x: 4, y: 4 },
  seat: { x: 24 / 12, y: 10 / 12 },
  step: { x: 12 / 12, y: 20 / 12 },
};

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
  /** The magnet the last free drag landed on, for the readout. */
  const magnetRef = useRef<Magnet | null>(null);
  const [magnetLabel, setMagnetLabel] = useState<string | null>(null);
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

  /**
   * Where a freely-moving object currently sits, and how big it is.
   *
   * Falls back to the rectangle the renderer would draw from its legacy wall
   * placement, so the first drag of an older object starts from where it is on
   * screen rather than jumping to the origin.
   */
  const freeRectOf = useCallback(
    (source: Job, kind: Drag['kind'], id: string) => {
      if (kind === 'spa') {
        const spa = source.spa;
        if (!spa) return null;
        const widthFt = spa.lengthFt;
        const heightFt = spa.widthFt;
        if (spa.position) return { ...spa.position, widthFt, heightFt };
        // An inset spa's legacy home is the shallow-end corner, where it used to
        // be welded. An attached one comes off its wall placement.
        if (spa.insetIntoPool) return { xFt: 0, yFt: 0, widthFt, heightFt };
        const place = spa.placement ?? { wall: 'deep' as const, alongFt: (source.pool.widthFt - spa.widthFt) / 2 };
        const r = placementRect(place, spa.widthFt, spa.lengthFt, source.pool.lengthFt, source.pool.widthFt, true);
        return { xFt: r.x, yFt: r.y, widthFt: r.widthFt, heightFt: r.heightFt };
      }
      if (kind === 'step') {
        const st = source.pool.steps.find((x) => x.id === id);
        if (!st) return null;
        const widthFt = inToFt(st.treadRunIn) * st.treadCount;
        const heightFt = inToFt(st.treadWidthIn);
        if (st.position) return { ...st.position, widthFt, heightFt };
        const place = st.placement ?? { wall: 'shallow' as const, alongFt: (source.pool.widthFt - heightFt) / 2 };
        const r = placementRect(place, heightFt, widthFt, source.pool.lengthFt, source.pool.widthFt);
        return { xFt: r.x, yFt: r.y, widthFt: r.widthFt, heightFt: r.heightFt };
      }
      if (kind === 'seat') {
        const st = source.pool.seats.find((x) => x.id === id);
        if (!st) return null;
        // Same orientation the renderer uses: width along x, depth into y — and
        // the same span/project argument order. Passing them the other way round
        // put the anchor somewhere the object was not drawn.
        const widthFt = inToFt(st.surfaceWidthIn);
        const heightFt = inToFt(st.surfaceDepthIn);
        if (st.position) return { ...st.position, widthFt, heightFt };
        const place = st.placement ?? { wall: 'bottom' as const, alongFt: source.pool.lengthFt * 0.62 };
        const r = placementRect(place, widthFt, heightFt, source.pool.lengthFt, source.pool.widthFt);
        return { xFt: r.x, yFt: r.y, widthFt: r.widthFt, heightFt: r.heightFt };
      }
      const acc = (source.pool.accessories ?? []).find((a) => a.id === id);
      if (!acc) return null;
      if (acc.position) return { ...acc.position, widthFt: 1, heightFt: 1 };
      const place = acc.placement ?? { wall: 'bottom' as const, alongFt: source.pool.lengthFt / 2 };
      const r = placementRect(place, 1, 1.2, source.pool.lengthFt, source.pool.widthFt, acc.kind === 'deck-jet');
      return { xFt: r.x, yFt: r.y, widthFt: 1, heightFt: 1 };
    },
    [],
  );

  /**
   * Everything else already on the plan, so a drag can land flush against it.
   *
   * The dragged object is excluded — an object cannot abut itself — and so is
   * anything with no footprint worth snapping to. This is what lets a stair come
   * off the edge of a tanning ledge exactly rather than nearly.
   */
  const neighboursFor = useCallback(
    (source: Job, kind: Drag['kind'], id: string): Neighbour[] => {
      const out: Neighbour[] = [];
      const add = (nid: string, label: string, r: { xFt: number; yFt: number; widthFt: number; heightFt: number } | null) => {
        if (r && !(nid === id)) out.push({ id: nid, label, ...r });
      };
      for (const st of source.pool.seats) add(st.id, `${st.kind} ${st.id}`, freeRectOf(source, 'seat', st.id));
      for (const st of source.pool.steps) add(st.id, `steps ${st.id}`, freeRectOf(source, 'step', st.id));
      if (source.spa) add(SPA_MOVE_ID, 'the spa', freeRectOf(source, 'spa', SPA_MOVE_ID));
      // A bubbler is a point, not an edge; nothing meaningful abuts it.
      void kind;
      return out;
    },
    [freeRectOf],
  );

  /** Writes a free position, leaving the legacy wall placement untouched. */
  const withPosition = useCallback(
    (source: Job, kind: Drag['kind'], id: string, position: PlanPoint): Job => {
      if (kind === 'spa') {
        return source.spa ? { ...source, spa: { ...source.spa, position } } : source;
      }
      if (kind === 'step') {
        return {
          ...source,
          pool: { ...source.pool, steps: source.pool.steps.map((x) => (x.id === id ? { ...x, position } : x)) },
        };
      }
      if (kind === 'seat') {
        return {
          ...source,
          pool: { ...source.pool, seats: source.pool.seats.map((x) => (x.id === id ? { ...x, position } : x)) },
        };
      }
      return {
        ...source,
        pool: {
          ...source.pool,
          accessories: (source.pool.accessories ?? []).map((a) => (a.id === id ? { ...a, position } : a)),
        },
      };
    },
    [],
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
        ...(grip.getAttribute('data-resize-target')
          ? { target: grip.getAttribute('data-resize-target') as 'spa' | 'seat' | 'step' }
          : {}),
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
      if (MOVES_FREELY.has(kind)) {
        const rect = freeRectOf(job, kind, id);
        dragRef.current = {
          kind,
          id,
          grabOffsetFt: 0,
          spanFt: spanOf(kind, id),
          // Same purpose as grabOffsetFt on a wall drag: hold the object where
          // it was grabbed instead of snapping its corner to the cursor.
          grabFree: rect
            ? { xFt: point.xFt - rect.xFt, yFt: point.yFt - rect.yFt }
            : { xFt: 0, yFt: 0 },
          sizeFt: rect ? { widthFt: rect.widthFt, heightFt: rect.heightFt } : { widthFt: 1, heightFt: 1 },
        };
      } else {
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
      } else if (resize.kind === 'object' && resize.id && resize.target) {
        /**
         * One corner grip resizes any object, in both axes at once.
         *
         * It replaces four separate grips — width and depth, for steps and for
         * seats — each of which changed one dimension along an axis that
         * depended on which wall the object was against. With everything free,
         * the rect IS the object: drag its far corner and both dimensions
         * follow. Sizes snap to the same 6" lattice positions do, so a bench
         * and the ledge beside it can be made to match exactly.
         */
        const rect = freeRectOf(base, resize.target, resize.id);
        if (!rect) return;
        /*
         * Resizing adopts a free position first, so the corner you are NOT
         * dragging stays put. A wall-placed object recomputes its origin from
         * its own size — a bottom-wall seat sits at y = poolWidth - depth — so
         * growing it would have walked the whole object up the drawing.
         */
        const anchored = withPosition(base, resize.target, resize.id, { xFt: rect.xFt, yFt: rect.yFt });
        const min = MIN_SIZE_FT[resize.target];
        const sizeX = Math.max(min.x, snapToGrid(point.xFt - rect.xFt));
        const sizeY = Math.max(min.y, snapToGrid(point.yFt - rect.yFt));
        const inches = (ft: number) => Math.round(ft * 12);

        if (resize.target === 'spa') {
          setDragPreview(anchored.spa
            ? { ...anchored, spa: { ...anchored.spa, lengthFt: sizeX, widthFt: sizeY } }
            : anchored);
          return;
        }
        if (resize.target === 'seat') {
          setDragPreview({
            ...anchored,
            pool: {
              ...anchored.pool,
              seats: anchored.pool.seats.map((st) => (st.id === resize.id
                ? { ...st, surfaceWidthIn: inches(sizeX), surfaceDepthIn: inches(sizeY), leadingEdgeLengthFt: sizeX }
                : st)),
            },
          });
          return;
        }
        setDragPreview({
          ...anchored,
          pool: {
            ...anchored.pool,
            steps: anchored.pool.steps.map((st) => (st.id === resize.id
              // Tread RUN, never tread COUNT: the count sets the rise, and the
              // rise is code-checked. Dragging must not change a dimension the
              // code has an opinion about without anyone typing a number.
              ? { ...st, treadRunIn: Math.max(12, inches(sizeX) / st.treadCount), treadWidthIn: inches(sizeY) }
              : st)),
          },
        });
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

    if (MOVES_FREELY.has(drag.kind)) {
      const grab = drag.grabFree ?? { xFt: 0, yFt: 0 };
      const size = drag.sizeFt ?? { widthFt: 1, heightFt: 1 };
      // The rules — grid, magnets, which position wins — all live in grid.ts.
      // This handler only turns a pointer into a candidate top-left corner.
      /**
       * An inset spa stays in the water: `insetIntoPool` is what tells the
       * excavation engine it needs no cut outside the pool envelope.
       *
       * The bound is applied BEFORE the magnets, not after. Clamping the snapped
       * result instead meant a spa dragged at a corner was always displaced from
       * whatever magnet it found, so the corner magnets could never report — and
       * "inside the deep/house corner" is exactly the feedback that makes a
       * corner spa land where someone meant it to.
       */
      const bounded = drag.kind === 'spa' && base.spa?.insetIntoPool;
      const candidate = { xFt: point.xFt - grab.xFt, yFt: point.yFt - grab.yFt };
      const snapped = snapWithMagnets(
        bounded ? clampWithin(candidate, size.widthFt, size.heightFt, L, W) : candidate,
        size.widthFt,
        size.heightFt,
        L,
        W,
        MAGNET_RANGE_FT,
        neighboursFor(base, drag.kind, drag.id),
      );
      const held = bounded
        ? clampWithin(snapped.at, size.widthFt, size.heightFt, L, W)
        : snapped.at;
      // Value comparison, not identity: clampWithin always returns a new object,
      // so an identity check reported "displaced" on every clamped drag.
      const landedOnMagnet = held.xFt === snapped.at.xFt && held.yFt === snapped.at.yFt;
      magnetRef.current = landedOnMagnet ? snapped.magnet : null;
      setDragPreview(withPosition(base, drag.kind, drag.id, held));
      return;
    }

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
    setMagnetLabel(magnetRef.current?.label ?? null);
    magnetRef.current = null;
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
      const kind: Drag['kind'] = selectedId === SPA_MOVE_ID ? 'spa'
        : job.pool.steps.some((s) => s.id === selectedId) ? 'step'
          : (job.pool.accessories ?? []).some((a) => a.id === selectedId) ? 'accessory'
            : 'seat';

      // A free object nudges in two axes on the grid; a wall-bound one still
      // slides along its wall. Same key, different degrees of freedom, because
      // that is the actual difference between the two kinds of object.
      if (MOVES_FREELY.has(kind)) {
        const base = latestRef.current;
        const rect = freeRectOf(base, kind, selectedId);
        if (!rect) return;
        event.preventDefault();
        const moved = {
          xFt: snapToGrid(rect.xFt + inLayout.x * Math.max(step, GRID_FT)),
          yFt: snapToGrid(rect.yFt + inLayout.y * Math.max(step, GRID_FT)),
        };
        const next = withPosition(base, kind, selectedId,
          kind === 'spa' && base.spa?.insetIntoPool
            ? clampWithin(moved, rect.widthFt, rect.heightFt, base.pool.lengthFt, base.pool.widthFt)
            : moved);
        latestRef.current = next;
        setMagnetLabel(null);
        onChange(next);
        return;
      }

      // Exactly one axis is non-zero, so the sum is that axis's sign. Positive
      // x or y is further along a wall, matching `alongFt`.
      const delta = Math.sign(inLayout.x + inLayout.y) * step;
      if (delta === 0) return;
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
  }, [selectedId, job, spanOf, withPlacement, withPosition, freeRectOf, onChange, deleteSelected, plan.quarterTurns]);

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
          ? (
            <span>
              <strong>{readout.label}</strong> · {readout.where}
              {magnetLabel && <> · <strong>snapped {magnetLabel}</strong></>}
              {' '}· arrow keys nudge 6"{readout.free ? '' : ", shift 1'"}
            </span>
          )
          : <span>Drag anything on the plan to place it. The spa and the fittings move freely on a 6" grid; steps and benches slide along their wall.</span>}
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

function describe(job: Job, id: string): { label: string; where: string; free: boolean } | null {
  const L = job.pool.lengthFt;
  const W = job.pool.widthFt;
  const fmt = (ft: number) => {
    const negative = ft < 0;
    const abs = Math.abs(ft);
    const f = Math.floor(abs + 1e-9);
    const i = Math.round((abs - f) * 12);
    const text = i === 12 ? `${f + 1}'-0"` : `${f}'-${i}"`;
    return negative ? `-${text}` : text;
  };
  /**
   * A freely placed object reads as a coordinate, not as a wall and a distance.
   * Saying "deep wall" about a spa sitting in the middle of the pool would be a
   * readout that contradicts the drawing.
   */
  const at = (p: { xFt: number; yFt: number }) =>
    `${fmt(p.xFt)} from the shallow end, ${fmt(p.yFt)} from the house side`;

  if (id === SPA_MOVE_ID && job.spa) {
    if (job.spa.position) return { label: 'Spa', where: at(job.spa.position), free: true };
    const place = job.spa.placement ?? { wall: 'deep' as const, alongFt: (W - job.spa.widthFt) / 2 };
    return { label: 'Spa', where: `${place.wall} wall · ${fmt(place.alongFt)} from the corner`, free: false };
  }
  const step = job.pool.steps.find((s) => s.id === id);
  if (step) {
    if (step.position) return { label: `Steps ${step.id}`, where: at(step.position), free: true };
    const place = step.placement ?? { wall: 'shallow' as const, alongFt: (W - inToFt(step.treadWidthIn)) / 2 };
    return { label: `Steps ${step.id}`, where: `${place.wall} wall · ${fmt(place.alongFt)} from the corner`, free: false };
  }
  const seat = job.pool.seats.find((s) => s.id === id);
  if (seat) {
    if (seat.position) return { label: `${seat.kind} ${seat.id}`, where: at(seat.position), free: true };
    const place = seat.placement ?? { wall: 'bottom' as const, alongFt: L * 0.62 };
    return { label: `${seat.kind} ${seat.id}`, where: `${place.wall} wall · ${fmt(place.alongFt)} from the corner`, free: false };
  }
  const acc = (job.pool.accessories ?? []).find((a) => a.id === id);
  if (acc) {
    const label = `${acc.kind === 'deck-jet' ? 'deck jet' : 'bubbler'} ${acc.id}`;
    if (acc.position) return { label, where: at(acc.position), free: true };
    const place = acc.placement ?? { wall: 'bottom' as const, alongFt: L / 2 };
    return { label, where: `${place.wall} wall · ${fmt(place.alongFt)} from the corner`, free: false };
  }
  return null;
}

// Re-exported so the sheet can size its print column without importing the
// engine twice.
export { placementRect, wallLengthFt };
