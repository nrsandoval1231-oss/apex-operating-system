import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { getToken, subscribeToToken } from '../api/session';
import { invalidateAndNotify } from '../api/client';
import { preparePhoto } from './preparePhoto';
import { uploadPhoto } from './uploadPhoto';
import {
  readQueue,
  addQueuedPhoto,
  updateQueuedPhoto,
  freezeQueuedPhoto,
  QueueConflictError,
  deleteQueuedPhoto,
  MAX_QUEUE_BYTES,
  MAX_QUEUE_FILES,
  type QueuedPhoto,
} from './queueStore';

type Props = { ownerId: string; jobId: string; readOnly: boolean };
export default function PhotoComposer({ ownerId, jobId, readOnly }: Props) {
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [ready, setReady] = useState(false);
  const [durable, setDurable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const draftSaves = useRef<Promise<void>>(Promise.resolve());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const [stage, setStage] = useState('');
  const [category, setCategory] = useState<'' | 'before' | 'during' | 'after'>(
    '',
  );
  const [progress, setProgress] = useState<{
    id: string;
    value: number;
  } | null>(null);
  const [opened, setOpened] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  const composer = useRef<HTMLDivElement>(null);
  const live = useRef(true);
  // Once a row was durable, an unavailable/missing store can never turn it into
  // a page-only upload. This also covers stale send callbacks after deletion.
  const durableIds = useRef(new Set<string>());
  const discardedIds = useRef(new Set<string>());
  const unsavedDraftIds = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null);
  const token = getToken();

  useEffect(() => {
    live.current = true;
    const stop = subscribeToToken(() => {
      live.current = false;
      controller.current?.abort();
    });
    void readQueue(ownerId, jobId)
      .then((rows) => {
        if (live.current) {
          durableIds.current = new Set(rows.map((photo) => photo.id));
          setQueue(rows);
          setReady(true);
        }
      })
      .catch(() => {
        if (live.current) {
          setDurable(false);
          setReady(true);
        }
      });
    return () => {
      live.current = false;
      controller.current?.abort();
      stop();
    };
  }, [ownerId, jobId]);

  useEffect(() => {
    if (params.get('action') === 'add-photos') {
      setOpened(true);
      // Repeated quick actions on the same route must open/focus the composer.
      requestAnimationFrame(() => {
        composer.current?.focus({ preventScroll: true });
        composer.current?.scrollIntoView({ block: 'start' });
      });
    }
  }, [params, location.key]);

  useEffect(() => {
    if (!queue.length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [queue.length]);

  async function addDraft(photo: QueuedPhoto) {
    if (!durable) return;
    try {
      await addQueuedPhoto(photo);
      durableIds.current.add(photo.id);
    } catch (cause) {
      if (cause instanceof QueueConflictError) throw cause;
      if (live.current) setDurable(false);
    }
  }

  function applyAuthoritative(
    requested: QueuedPhoto,
    current: QueuedPhoto | null,
  ) {
    if (!live.current || discardedIds.current.has(requested.id)) return;
    setQueue((rows) =>
      current
        ? rows.map((row) => (row.id === requested.id ? current : row))
        : rows.filter((row) => row.id !== requested.id),
    );
    if (current?.attempted && !requested.attempted) {
      setMessage(
        'This photo already started uploading in another tab. Its saved details were kept.',
      );
    }
  }

  function editDraft(field: 'caption' | 'stage' | 'category', value: string) {
    const drafts = queue.filter(
      (photo) => !photo.attempted && !discardedIds.current.has(photo.id),
    );
    setQueue((rows) =>
      rows.map((photo) =>
        photo.attempted
          ? photo
          : {
              ...photo,
              payload: { ...photo.payload, [field]: value || null },
            },
      ),
    );
    if (!drafts.length) return;
    setSavingDetails(true);
    const saving = draftSaves.current.then(async () => {
      for (const photo of drafts) {
        if (
          discardedIds.current.has(photo.id) ||
          !durableIds.current.has(photo.id)
        )
          continue;
        try {
          const current = await updateQueuedPhoto(photo, field, value || null);
          unsavedDraftIds.current.delete(photo.id);
          applyAuthoritative(photo, current);
        } catch (cause) {
          unsavedDraftIds.current.add(photo.id);
          if (live.current) {
            setDurable(false);
            setError(
              cause instanceof Error
                ? cause.message
                : 'Optional details could not be saved.',
            );
          }
        }
      }
    });
    draftSaves.current = saving;
    void saving.finally(() => {
      if (live.current && draftSaves.current === saving)
        setSavingDetails(false);
    });
  }

  async function select(files: FileList | null) {
    if (!files || busy || readOnly || !ready) return;
    const selected = Array.from(files);
    if (queue.length + selected.length > MAX_QUEUE_FILES) {
      setError(
        `Keep at most ${MAX_QUEUE_FILES} photos pending per project. Upload or discard some first.`,
      );
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const additions: QueuedPhoto[] = [];
    let bytes = queue.reduce((sum, item) => sum + item.byteSize, 0);
    try {
      for (const file of selected) {
        const prepared = await preparePhoto(file);
        if (!live.current || token !== getToken()) return;
        bytes += prepared.byteSize;
        if (bytes > MAX_QUEUE_BYTES)
          throw new Error(
            'Device queue is limited to 40 MB per project. Upload or discard some first.',
          );
        const photo: QueuedPhoto = {
          id: crypto.randomUUID(),
          ownerId,
          jobId,
          name: file.name,
          ...prepared,
          payload: {
            ...prepared.payload,
            caption: caption || null,
            stage: stage.trim() || null,
            category: category || null,
          },
          queuedAt: new Date().toISOString(),
          attempted: false,
        };
        await addDraft(photo);
        additions.push(photo);
      }
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not prepare this photo.',
        );
    } finally {
      if (live.current) {
        setQueue((previous) => [...previous, ...additions]);
        setBusy(false);
      }
    }
  }

  async function discard(photo: QueuedPhoto) {
    // Mark locally before awaiting storage so delayed callbacks cannot restore UI.
    // Other tabs are protected by the store's conditional existing-row mutations.
    discardedIds.current.add(photo.id);
    try {
      if (durableIds.current.has(photo.id)) await deleteQueuedPhoto(photo);
      unsavedDraftIds.current.delete(photo.id);
    } catch {
      discardedIds.current.delete(photo.id);
      setDurable(false);
      setError(
        'Could not clear device storage. Recovery is unavailable until storage works again.',
      );
      return;
    }
    if (live.current)
      setQueue((rows) => rows.filter((row) => row.id !== photo.id));
  }

  async function send(photos: QueuedPhoto[]) {
    if (busy || savingDetails || !ready || token !== getToken()) return;
    setBusy(true);
    setError('');
    setMessage('');
    controller.current = new AbortController();
    let confirmed = 0;
    try {
      for (const original of photos) {
        if (!live.current || token !== getToken()) break;
        if (readOnly && !original.attempted) continue;
        if (discardedIds.current.has(original.id)) continue;
        let photo: QueuedPhoto;
        if (durableIds.current.has(original.id)) {
          if (unsavedDraftIds.current.has(original.id)) {
            throw new Error(
              'Device storage could not save changed details. Restore storage and edit again, or discard this draft before uploading.',
            );
          }
          let frozen: QueuedPhoto | null;
          try {
            frozen = await freezeQueuedPhoto(original);
          } catch (cause) {
            if (live.current) setDurable(false);
            throw cause;
          }
          if (!frozen) {
            applyAuthoritative(original, null);
            if (live.current)
              setMessage(
                'This pending photo was already removed from the device.',
              );
            continue;
          }
          photo = frozen;
        } else {
          // Initial unavailable-IDB fallback has never had a shared durable row.
          photo = { ...original, attempted: true };
        }
        if (!live.current || token !== getToken()) break;
        setQueue((rows) =>
          rows.map((row) => (row.id === photo.id ? photo : row)),
        );
        setProgress({ id: photo.id, value: 0 });
        await uploadPhoto(photo, token, controller.current.signal, (value) => {
          if (live.current) setProgress({ id: photo.id, value });
        });
        // Clear durable bytes only after a validated server receipt.
        try {
          discardedIds.current.add(photo.id);
          if (durableIds.current.has(photo.id)) await deleteQueuedPhoto(photo);
        } catch {
          setDurable(false);
          setError(
            'Uploaded, but device cleanup failed. Retrying this saved request is safe.',
          );
        }
        if (!live.current || token !== getToken()) break;
        setQueue((rows) => rows.filter((row) => row.id !== photo.id));
        confirmed++;
        invalidateAndNotify();
      }
      if (live.current && confirmed)
        setMessage(`${confirmed} photo${confirmed === 1 ? '' : 's'} uploaded.`);
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? `${cause.message} Device bytes remain pending.`
            : 'Upload not confirmed. Retry safely.',
        );
    } finally {
      if (live.current) {
        setBusy(false);
        setProgress(null);
      }
      controller.current = null;
    }
  }

  return (
    <div className="photo-composer" ref={composer} tabIndex={-1}>
      {!readOnly && (
        <button
          className="btn"
          onClick={() => {
            setOpened((value) => !value);
            if (!opened)
              requestAnimationFrame(() => {
                composer.current?.focus({ preventScroll: true });
                composer.current?.scrollIntoView({ block: 'start' });
              });
          }}
          aria-expanded={opened}
        >
          Add photos
        </button>
      )}
      {readOnly && <p>Historical project · new uploads disabled.</p>}
      {opened && !readOnly && (
        <div className="photo-fields">
          <p>Optional project documentation.</p>
          <p>
            JPEG, PNG or WebP · up to 8 MB each. Convert HEIC to JPEG first.
          </p>
          <div className="photo-actions">
            <label
              className={`btn ghost photo-file-button${busy || !ready ? ' is-disabled' : ''}`}
            >
              Take photo
              <input
                aria-label="Take photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={busy || !ready}
                onChange={(e) => {
                  void select(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <label
              className={`btn ghost photo-file-button${busy || !ready ? ' is-disabled' : ''}`}
            >
              Choose from library
              <input
                aria-label="Choose from library"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={busy || !ready}
                onChange={(e) => {
                  void select(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <details className="photo-optional-details">
            <summary>Optional details</summary>
            <label>
              Internal caption (optional)
              <textarea
                maxLength={1000}
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  editDraft('caption', e.target.value);
                }}
                disabled={busy}
              />
            </label>
            <label>
              Stage (optional)
              <input
                maxLength={120}
                value={stage}
                onChange={(e) => {
                  setStage(e.target.value);
                  editDraft('stage', e.target.value.trim());
                }}
                disabled={busy}
                placeholder="No stage selected"
              />
            </label>
            <label>
              Category (optional)
              <select
                aria-label="Category (optional)"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as typeof category);
                  editDraft('category', e.target.value);
                }}
                disabled={busy}
              >
                <option value="">No category selected</option>
                <option value="before">Before</option>
                <option value="during">During</option>
                <option value="after">After</option>
              </select>
            </label>
            <p>
              Applies to selected photos before upload starts. Attempted uploads
              keep their saved details.
            </p>
          </details>
        </div>
      )}
      {!ready && <p role="status">Recovering device queue…</p>}
      {!durable && (
        <p role="alert">
          Device recovery unavailable. New changes may exist only in this page;
          keep it open until upload is confirmed.
        </p>
      )}
      {queue.length > 0 && (
        <section aria-label="Device photo queue" className="photo-queue">
          <h4>Pending on this device · {queue.length}</h4>
          <p>
            {durable
              ? 'Saved for your account and this project on this device.'
              : 'Recovery unavailable.'}{' '}
            Pending photos are not in the gallery. Discard removes device bytes
            only; an uncertain upload may already exist on the server.
          </p>
          <ul>
            {queue.map((photo) => (
              <li key={photo.id}>
                <strong>{photo.name}</strong>
                <span>
                  {photo.payload.stage ?? 'No stage'} ·{' '}
                  {photo.payload.category ?? 'No category'}
                </span>
                {photo.payload.caption && <span>{photo.payload.caption}</span>}
                {progress?.id === photo.id ? (
                  <>
                    <progress
                      aria-label={`Uploading ${photo.name}`}
                      max={100}
                      value={progress.value}
                    />
                    <span>
                      {progress.value === 100
                        ? 'Awaiting server confirmation…'
                        : `Uploading ${progress.value}%`}
                    </span>
                  </>
                ) : (
                  <span>
                    Pending ·{' '}
                    {photo.attempted
                      ? 'Retry with saved request'
                      : 'Ready to upload'}
                  </span>
                )}
                <div className="photo-actions">
                  <button
                    className="btn ghost"
                    disabled={
                      busy || savingDetails || (readOnly && !photo.attempted)
                    }
                    onClick={() => void send([photo])}
                  >
                    {readOnly
                      ? 'Check upload receipt'
                      : photo.attempted
                        ? 'Retry'
                        : 'Upload'}
                  </button>
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => void discard(photo)}
                  >
                    Discard
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <button
              className="btn"
              disabled={busy || savingDetails}
              onClick={() => void send(queue)}
            >
              Upload pending photos
            </button>
          )}
        </section>
      )}
      {savingDetails && <p role="status">Saving optional details…</p>}
      {busy && !progress && <p role="status">Preparing photos…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
