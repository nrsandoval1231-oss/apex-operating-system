import { useJobPhotos } from '../api/useJobs';
import EvidenceProof from './EvidenceProof';
export default function PhotoWorkspace({
  jobId,
  readOnly = false,
}: {
  jobId: string;
  readOnly?: boolean;
}) {
  const query = useJobPhotos(jobId);
  return (
    <section aria-label="Project photos">
      <h3>Project photos</h3>
      {readOnly && <p>Historical photos · view only</p>}
      {query.loading && <p role="status">Loading photos…</p>}
      {query.error && (
        <p role="alert">
          {query.error.message}
          <button onClick={query.reload}>Retry</button>
        </p>
      )}
      {query.data?.length === 0 && <p>No project photos recorded.</p>}
      {query.data?.map((p) => (
        <article key={p.evidenceId}>
          <p>
            {p.gateTitle} · {p.requirementKey}
          </p>
          <EvidenceProof evidenceId={p.evidenceId} />
        </article>
      ))}
    </section>
  );
}
