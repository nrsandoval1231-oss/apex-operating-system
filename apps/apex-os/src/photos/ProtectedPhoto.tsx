import { useEffect, useState } from 'react';
import type { JobPhoto } from '@apex/contracts';
import { useToken } from '../api/useJobs';

export default function ProtectedImage({
  photo,
  full = false,
}: {
  photo: JobPhoto;
  full?: boolean;
}) {
  const token = useToken();
  const [source, setSource] = useState<{
    token: string;
    id: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    setError('');
    setSource(null);
    void fetch(`/api/evidence/${photo.evidenceId}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load photo.');
        const bytes = await response.blob();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(bytes);
        setSource({ token, id: photo.evidenceId, url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load photo.');
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo.evidenceId, token, attempt]);
  if (error && !full)
    return <span className="photo-image-error">{error} Open to retry.</span>;
  if (error)
    return (
      <span className="photo-image-error">
        {error}
        <button
          className="btn ghost"
          onClick={(e) => {
            e.stopPropagation();
            setAttempt((n) => n + 1);
          }}
        >
          Reload image
        </button>
      </span>
    );
  const url =
    source?.token === token && source.id === photo.evidenceId
      ? source.url
      : null;
  return url ? (
    <img
      className={full ? 'photo-full-image' : 'photo-thumbnail'}
      src={url}
      alt={
        photo.internalCaption ||
        (photo.purpose === 'jobsite-photo'
          ? 'Jobsite photo'
          : `Gate evidence: ${photo.gateTitle}`)
      }
    />
  ) : (
    <span role="status">Loading photo…</span>
  );
}
