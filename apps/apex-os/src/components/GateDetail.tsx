import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiGet } from '../api/client';
import EvidenceProof from './EvidenceProof';

/**
 * What actually happened at a Gate, for the person who signed it.
 *
 * Gate detail existed only in the field console, which is built for whoever is
 * doing the work rather than the owner reviewing it — so a released Gate could
 * not be opened anywhere in Apex OS, and the evidence behind it could not be
 * seen at all.
 *
 * Read-only on purpose. Working a Gate stays in the field console; this is for
 * looking at one that is finished.
 */

const RequirementSchema = z.object({
  key: z.string(),
  status: z.string(),
  evidenceRequired: z.boolean(),
  evidenceIds: z.array(z.string()),
  note: z.string().nullable().optional(),
  evaluatedBy: z.string().nullable().optional(),
});

const GateStateSchema = z.object({
  gateInstanceId: z.string(),
  status: z.string(),
  requirements: z.array(RequirementSchema),
});

type GateStateShape = z.infer<typeof GateStateSchema>;

const TITLE = (key: string) =>
  key.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export default function GateDetail({ gateInstanceId }: { gateInstanceId: string }) {
  const [gate, setGate] = useState<GateStateShape | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiGet(`/api/gates/${gateInstanceId}`, GateStateSchema)
      .then((data) => { if (live) setGate(data); })
      .catch((caught: unknown) => {
        if (live) setError(caught instanceof Error ? caught.message : 'Could not load this Gate.');
      });
    return () => { live = false; };
  }, [gateInstanceId]);

  if (error !== null) return <p className="attach-error" role="alert">{error}</p>;
  if (gate === null) return <p className="state-quiet">Loading the Gate…</p>;

  return (
    <div className="gate-detail">
      {gate.requirements.map((requirement) => (
        <div key={requirement.key} className={`gate-requirement is-${requirement.status}`}>
          <div className="gate-requirement-head">
            <span className="what">{TITLE(requirement.key)}</span>
            <span className={`tag ${requirement.status === 'passed' ? 'tag-clear' : requirement.status === 'failed' ? 'tag-urgent' : 'tag-dim'}`}>
              {requirement.status}
            </span>
          </div>

          {requirement.note !== null && requirement.note !== undefined && requirement.note !== '' && (
            <p className="note">{requirement.note}</p>
          )}

          {requirement.evidenceIds.length === 0 ? (
            <p className="note">
              {/*
                * Said plainly. A requirement that passed without proof is a
                * different thing from one nobody has reached yet, and the
                * distinction is exactly what somebody reviewing is looking for.
                */}
              {requirement.evidenceRequired ? 'No evidence recorded' : 'No evidence required'}
            </p>
          ) : (
            <div className="proof-grid">
              {requirement.evidenceIds.map((evidenceId) => (
                <EvidenceProof key={evidenceId} evidenceId={evidenceId} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
