import { useJobPhotos, useMe } from '../api/useJobs';
import PhotoComposer from '../photos/PhotoComposer';
import PhotoGallery from '../photos/PhotoGallery';
import '../photos/photos.css';

export default function PhotoWorkspace({
  jobId,
  readOnly = false,
}: {
  jobId: string;
  readOnly?: boolean;
}) {
  const query = useJobPhotos(jobId);
  const me = useMe();
  return (
    <section aria-label="Project photos" className="photo-workspace">
      <h3>Project photos</h3>
      {me.data && (
        <PhotoComposer
          key={`${me.data.userId}:${jobId}`}
          ownerId={me.data.userId}
          jobId={jobId}
          readOnly={readOnly}
        />
      )}
      {query.loading && <p role="status">Loading photos…</p>}
      {query.error && (
        <p role="alert">
          {query.error.message}
          <button className="btn ghost" onClick={query.reload}>
            Retry gallery
          </button>
        </p>
      )}
      {query.data && (
        <PhotoGallery
          photos={query.data}
          canPublish={
            !!me.data &&
            ['admin', 'office', 'superintendent'].includes(me.data.role)
          }
          readOnly={readOnly}
        />
      )}
    </section>
  );
}
