/**
 * The draggable section.
 *
 * Grab a floor and pull it deeper or shallower; grab a station line and slide
 * the breakover or the start of the deep flat. The rules — 3" depth snap, 6"
 * station snap, floors that cannot cross, stations that keep their order — live
 * in poolResize.ts as pure functions with their own tests. This component only
 * turns a pointer into section feet and hands the result back.
 *
 * Same drag discipline as MovablePlan, learned the hard way there: the preview
 * lives in a ref because pointermove and pointerup can land in one React batch,
 * the commit happens before the capture release because releasing an untaken
 * capture throws, and a whole drag is one undo entry.
 */

import { useCallback, useRef, useState } from 'react';
import { renderSectionView, sectionPrintScale } from '../engine/sectionView.ts';
import { resolveSectionDrag, type SectionHandle } from '../engine/poolResize.ts';
import { inverseContentPoint, type QuarterTurns } from '../engine/planRotation.ts';
import type { Job } from '../engine/types.ts';

export function SectionEditor({
  job,
  onChange,
  quarterTurns = 0,
  children,
}: {
  job: Job;
  onChange: (job: Job) => void;
  /**
   * Driven by the same control as the plan, so the two drawings cannot disagree
   * about which end is the deep end.
   */
  quarterTurns?: QuarterTurns;
  children?: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<SectionHandle | null>(null);
  const [preview, setPreview] = useState<Job | null>(null);
  const previewRef = useRef<Job | null>(null);
  const setDragPreview = useCallback((next: Job | null) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const shown = preview ?? job;
  const section = renderSectionView(shown, 1040, { interactive: true, quarterTurns });
  const scale = sectionPrintScale(section);

  const toSectionFeet = useCallback(
    (clientX: number, clientY: number) => {
      const svg = hostRef.current?.querySelector('svg');
      if (!svg) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      // The one place rotation touches the section's handles, same as the plan:
      // every rule below is written against the unrotated layout.
      const laid = inverseContentPoint(
        section.quarterTurns,
        { x: point.x, y: point.y },
        { widthPx: section.layoutWidthPx, heightPx: section.layoutHeightPx },
      );
      return {
        xFt: (laid.x - section.originXPx) / section.pxPerFt,
        depthFt: (laid.y - section.originYPx) / section.pxPerFt,
      };
    },
    [
      section.originXPx,
      section.originYPx,
      section.pxPerFt,
      section.quarterTurns,
      section.layoutWidthPx,
      section.layoutHeightPx,
    ],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const handle = (event.target as Element | null)?.closest?.('[data-sec-handle]');
    if (!handle) return;
    dragRef.current = handle.getAttribute('data-sec-handle') as SectionHandle;
    try {
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is an optimisation, not the mechanism */
    }
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const handle = dragRef.current;
    if (!handle) return;
    const point = toSectionFeet(event.clientX, event.clientY);
    if (!point) return;
    const base = previewRef.current ?? job;
    const profile = resolveSectionDrag(
      base.pool.profile,
      base.pool.lengthFt,
      handle,
      point.xFt,
      point.depthFt,
    );
    setDragPreview({ ...base, pool: { ...base.pool, profile } });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const committed = previewRef.current;
    setDragPreview(null);
    if (committed) onChange(committed);
    try {
      (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    } catch {
      /* never captured, or already released */
    }
  };

  return (
    <div
      className="plan-frame plan-sheet"
      style={{ ['--plan-print-width' as string]: `${scale.widthIn.toFixed(2)}in` }}
    >
      <div
        ref={hostRef}
        className="section-edit-host"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        dangerouslySetInnerHTML={{ __html: section.svg }}
      />
      <div className="plan-move-bar">
        <span>
          Drag a floor up or down to set its depth · drag the vertical lines to move the breakover
          and the deep end
        </span>
      </div>
      {children}
    </div>
  );
}
