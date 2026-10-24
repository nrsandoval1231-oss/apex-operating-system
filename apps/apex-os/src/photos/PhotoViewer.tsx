import { useEffect, useRef } from 'react';
import type { JobPhoto } from '@apex/contracts';
import ProtectedImage from './ProtectedPhoto';

export default function Viewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: JobPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startX = useRef<number | null>(null);
  const photo = photos[index]!;
  const move = (delta: number) =>
    onIndex((index + delta + photos.length) % photos.length);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="photo-viewer"
      aria-label="Photo viewer"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          move(1);
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <div className="photo-viewer-toolbar">
        <span>
          {index + 1} of {photos.length}
        </span>
        <button className="btn ghost" onClick={onClose} autoFocus>
          Close viewer
        </button>
      </div>
      <div
        className="photo-viewer-stage"
        onTouchStart={(e) => {
          startX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const end = e.changedTouches[0]?.clientX;
          if (
            startX.current !== null &&
            end !== undefined &&
            Math.abs(end - startX.current) > 50
          )
            move(end < startX.current ? 1 : -1);
          startX.current = null;
        }}
      >
        <ProtectedImage photo={photo} full />
      </div>
      <p>
        {photo.internalCaption ??
          (photo.purpose === 'jobsite-photo'
            ? 'Optional jobsite documentation'
            : photo.gateTitle)}
      </p>
      <p>
        {photo.uploaderName ?? 'Staff'} · Uploaded{' '}
        {new Date(photo.uploadedAt ?? photo.capturedAt).toLocaleString()}
      </p>
      <div className="photo-actions">
        <button
          className="btn ghost"
          disabled={photos.length < 2}
          onClick={() => move(-1)}
        >
          Previous photo
        </button>
        <button
          className="btn ghost"
          disabled={photos.length < 2}
          onClick={() => move(1)}
        >
          Next photo
        </button>
      </div>
    </dialog>
  );
}
