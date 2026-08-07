import { useEffect, useState } from 'react';
import { getToken } from '../api/session';

/**
 * One piece of Gate evidence, shown to the person whose signature it protects.
 *
 * The system photographs the work, hashes it, stores it immutably and refuses to
 * release a Gate without it — and until now showed it to nobody. It was being
 * collected for an audit that could not be performed.
 *
 * **Fetched rather than linked.** `/api/evidence/:id` requires a bearer token and
 * an `<img src>` cannot carry one, so the bytes are fetched with the session and
 * turned into an object URL. That URL is revoked on unmount: it is a handle to
 * evidence and should not outlive the screen showing it.
 *
 * The kind is read from the response rather than assumed. A requirement accepts
 * documents as well as photographs, and rendering a PDF into an `<img>` would
 * produce a broken picture where a person expected a plan.
 */
export default function EvidenceProof({ evidenceId }: { evidenceId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        const token = getToken();
        const response = await fetch(`/api/evidence/${evidenceId}`, {
          headers: token === '' ? {} : { authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (!live) return;
        objectUrl = URL.createObjectURL(blob);
        setType(blob.type);
        setUrl(objectUrl);
      } catch {
        if (live) setFailed(true);
      }
    };
    void load();

    return () => {
      live = false;
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceId]);

  if (failed) {
    return (
      <div className="proof-tile is-missing" title={evidenceId}>
        Could not load
      </div>
    );
  }

  if (url === null) {
    return <div className="proof-tile is-loading" title={evidenceId}>Loading…</div>;
  }

  if (!type.startsWith('image/')) {
    // A document is offered, not rendered. Opening it is the reader's choice.
    return (
      <a className="proof-tile is-document" href={url} target="_blank" rel="noreferrer" title={evidenceId}>
        Open {type === 'application/pdf' ? 'PDF' : 'file'}
      </a>
    );
  }

  return (
    <a className="proof-tile" href={url} target="_blank" rel="noreferrer" title={evidenceId}>
      <img src={url} alt={`Evidence ${evidenceId}`} loading="lazy" />
    </a>
  );
}
