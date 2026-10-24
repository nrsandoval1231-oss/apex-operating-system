import { useState } from 'react';
import { JobPhotoSchema, type JobPhoto } from '@apex/contracts';
import { apiSend } from '../api/client';

export default function Sharing({
  photo,
  disabled,
}: {
  photo: JobPhoto;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.customerCaption ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(visible: boolean) {
    setBusy(true);
    setError('');
    try {
      await apiSend(
        `/api/evidence/${photo.evidenceId}/visibility`,
        JobPhotoSchema,
        {
          method: 'POST',
          body: { visible, caption: visible ? caption.trim() || null : null },
        },
      );
      setEditing(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update sharing.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="photo-sharing">
      <p>
        {photo.customerVisible
          ? `Published to customer · ${photo.customerCaption ?? 'No customer caption'}`
          : 'Private to staff'}
      </p>
      {!disabled && (
        <button
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            setCaption(photo.customerCaption ?? '');
            setEditing((value) => !value);
          }}
        >
          {photo.customerVisible ? 'Edit sharing' : 'Share with customer'}
        </button>
      )}
      {editing && !disabled && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          <p>
            Publish explicitly to the project’s customer page. Internal captions
            stay private.
          </p>
          <label>
            Customer caption (optional)
            <textarea
              maxLength={300}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="photo-actions">
            <button className="btn" disabled={busy}>
              Publish photo
            </button>
            {photo.customerVisible && (
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => void save(false)}
              >
                Unpublish
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
