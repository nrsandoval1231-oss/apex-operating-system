/**
 * Saved designs.
 *
 * The reference tab held five fixtures nobody would ever start a real job from.
 * It now holds the jobs actually drawn on this machine, with the fixtures kept
 * at the bottom because they are still the only visible proof that the refusal
 * paths refuse.
 *
 * Storage is localStorage, and that is a real limitation stated rather than
 * hidden: designs live in this browser on this machine. They are not shared,
 * not backed up, and clearing site data deletes them. The JSON save/load in the
 * advanced form is what moves a design between machines, and the panel says so.
 *
 * Jobs are serialised with the same jobFile helpers the file export uses, so a
 * saved design and an exported one cannot drift into two formats.
 */

import { useCallback, useEffect, useState } from 'react';
import { parseJob, serializeJob } from '../engine/jobFile.ts';
import type { Job } from '../engine/types.ts';

const KEY = 'apex-designer.saved-jobs.v1';

export interface SavedJob {
  readonly id: string;
  readonly name: string;
  /** ISO timestamp, for ordering and for showing how stale a design is. */
  readonly savedAt: string;
  /** The job as jobFile JSON, so this and the file export share one format. */
  readonly json: string;
}

function readAll(): SavedJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A stored record from a future version, or a hand-edited one, must not take
    // the whole list down.
    return parsed.filter((entry): entry is SavedJob =>
      Boolean(entry) && typeof entry === 'object'
      && typeof (entry as SavedJob).id === 'string'
      && typeof (entry as SavedJob).json === 'string');
  } catch {
    return [];
  }
}

export function useSavedJobs() {
  const [saved, setSaved] = useState<SavedJob[]>([]);

  useEffect(() => { setSaved(readAll()); }, []);

  const persist = useCallback((next: SavedJob[]) => {
    setSaved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Quota or a privacy mode that refuses storage. The design is still on
      // screen and still exportable; losing the convenience is not worth
      // interrupting the work.
    }
  }, []);

  const save = useCallback((job: Job, name: string) => {
    const entry: SavedJob = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || job.name,
      savedAt: new Date().toISOString(),
      json: serializeJob(job),
    };
    // Same name overwrites: saving twice from one design should not leave two
    // entries a day apart with no way to tell them apart.
    persist([entry, ...readAll().filter((s) => s.name !== entry.name)]);
  }, [persist]);

  const remove = useCallback((id: string) => {
    persist(readAll().filter((s) => s.id !== id));
  }, [persist]);

  return { saved, save, remove };
}

export function SavedJobsPanel({
  job,
  saved,
  onSave,
  onRemove,
  onLoad,
  children,
}: {
  job: Job;
  saved: readonly SavedJob[];
  onSave: (job: Job, name: string) => void;
  onRemove: (id: string) => void;
  onLoad: (job: Job) => void;
  /** The reference fixtures, rendered underneath the saved designs. */
  children?: React.ReactNode;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = (entry: SavedJob) => {
    const result = parseJob(entry.json);
    if (!result.ok) {
      setError(`"${entry.name}" could not be opened: ${result.errors.join(' ')}`);
      return;
    }
    setError(null);
    onLoad(result.job);
  };

  return (
    <div className="saved-panel print-hide">
      <div className="saved-row">
        <input
          type="text"
          value={name}
          placeholder={job.name}
          aria-label="Name for the saved design"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" onClick={() => { onSave(job, name); setName(''); }}>
          Save this design
        </button>
      </div>

      {error && <p className="saved-error">{error}</p>}

      {saved.length === 0 ? (
        <p className="saved-empty">
          No saved designs yet. Saved designs live in this browser on this machine — use Advanced →
          Save JSON to move one to another computer.
        </p>
      ) : (
        <ul className="saved-list">
          {saved.map((entry) => (
            <li key={entry.id}>
              <button className="btn ghost saved-open" onClick={() => load(entry)}>{entry.name}</button>
              <span className="saved-when">{new Date(entry.savedAt).toLocaleDateString()}</span>
              <button className="saved-remove" onClick={() => onRemove(entry.id)} aria-label={`Delete ${entry.name}`}>×</button>
            </li>
          ))}
        </ul>
      )}

      {children && (
        <div className="saved-reference">
          <span>Engine fixtures and refusal cases, not starting points:</span>
          {children}
        </div>
      )}
    </div>
  );
}
