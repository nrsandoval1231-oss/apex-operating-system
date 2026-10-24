import { lazy, Suspense, useState } from 'react';
import type { JobPhoto } from '@apex/contracts';
import ProtectedImage from './ProtectedPhoto';
import Sharing from './PhotoSharing';
const Viewer = lazy(() => import('./PhotoViewer'));

export default function PhotoGallery({
  photos,
  canPublish,
  readOnly,
}: {
  photos: readonly JobPhoto[];
  canPublish: boolean;
  readOnly: boolean;
}) {
  const [order, setOrder] = useState('newest');
  const [stage, setStage] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = photos
    .filter(
      (p) =>
        (!stage || p.stage === stage) && (!category || p.category === category),
    )
    .sort((a, b) => {
      const left =
        order === 'captured'
          ? (a.originalCapturedAt ?? a.uploadedAt ?? a.capturedAt)
          : (a.uploadedAt ?? a.capturedAt);
      const right =
        order === 'captured'
          ? (b.originalCapturedAt ?? b.uploadedAt ?? b.capturedAt)
          : (b.uploadedAt ?? b.capturedAt);
      return (
        (order === 'oldest'
          ? left.localeCompare(right)
          : right.localeCompare(left)) ||
        a.evidenceId.localeCompare(b.evidenceId)
      );
    });
  const index = filtered.findIndex((photo) => photo.evidenceId === selected);
  return (
    <>
      <div className="photo-gallery-controls">
        <label>
          Photo order
          <select
            aria-label="Photo order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="newest">Newest upload first</option>
            <option value="oldest">Oldest upload first</option>
            <option value="captured">Capture time, newest first</option>
          </select>
        </label>
        <label>
          Filter stage
          <select
            aria-label="Filter stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">All stages</option>
            {Array.from(
              new Set(
                photos
                  .map((p) => p.stage)
                  .filter((value): value is string => !!value),
              ),
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Filter category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            <option value="before">Before</option>
            <option value="during">During</option>
            <option value="after">After</option>
          </select>
        </label>
      </div>
      {order === 'captured' && (
        <p>
          Uses capture time only when its timezone is known; otherwise uses
          upload time.
        </p>
      )}
      <p>
        {photos.length} confirmed photo{photos.length === 1 ? '' : 's'} ·{' '}
        {filtered.length} shown
      </p>
      {photos.length === 0 && <p>No photos yet. Add them whenever useful.</p>}
      <div className="photo-grid">
        {filtered.map((photo, position) => (
          <article className="photo-card" key={photo.evidenceId}>
            <button
              className="photo-open"
              onClick={() => setSelected(photo.evidenceId)}
              aria-label={`Open photo ${position + 1}`}
            >
              <ProtectedImage photo={photo} />
            </button>
            <span className="tag">
              {photo.purpose === 'jobsite-photo'
                ? 'Optional jobsite photo'
                : `Gate evidence · ${photo.gateTitle}`}
            </span>
            <p>
              {photo.uploaderName ?? 'Staff'} · Uploaded{' '}
              <time dateTime={photo.uploadedAt ?? photo.capturedAt}>
                {new Date(
                  photo.uploadedAt ?? photo.capturedAt,
                ).toLocaleString()}
              </time>
            </p>
            {photo.originalCapturedAt && (
              <p>
                Captured {new Date(photo.originalCapturedAt).toLocaleString()}
              </p>
            )}
            {photo.capturedLocal && (
              <p>Camera time {photo.capturedLocal} · timezone unknown</p>
            )}
            {(photo.stage || photo.category) && (
              <p>{[photo.stage, photo.category].filter(Boolean).join(' · ')}</p>
            )}
            {photo.internalCaption && <p>Internal: {photo.internalCaption}</p>}
            {canPublish ? (
              <Sharing photo={photo} disabled={readOnly} />
            ) : (
              <p>
                {photo.customerVisible
                  ? 'Published to customer'
                  : 'Private to staff'}
              </p>
            )}
          </article>
        ))}
      </div>
      {index >= 0 && (
        <Suspense fallback={<p role="status">Opening photo…</p>}>
        <Viewer
          photos={filtered}
          index={index}
          onIndex={(next) => setSelected(filtered[next]!.evidenceId)}
          onClose={() => setSelected(null)}
        />
        </Suspense>
      )}
    </>
  );
}
