import { JobPhotoSchema, type JobPhoto } from '@apex/contracts';
import { ApiError } from '../api/client';
import type { QueuedPhoto } from './queueStore';

export function uploadPhoto(
  photo: QueuedPhoto,
  token: string,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<JobPhoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => signal.removeEventListener('abort', abort);
    xhr.open('POST', `/api/jobs/${photo.jobId}/photos`);
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.setRequestHeader('idempotency-key', photo.id);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = xhr.ontimeout = () => {
      cleanup();
      reject(
        new ApiError(
          'Confirmation was not received. Photo remains pending; retry safely.',
          0,
        ),
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    xhr.onload = () => {
      cleanup();
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new ApiError(
            (body as { error?: string } | null)?.error ??
              'Photo was not confirmed. Retry when ready.',
            xhr.status,
          ),
        );
        return;
      }
      const parsed = JobPhotoSchema.safeParse(body);
      if (!parsed.success) {
        reject(
          new ApiError(
            'Upload receipt was not understood. Retry safely.',
            xhr.status,
          ),
        );
        return;
      }
      resolve(parsed.data);
    };
    xhr.send(JSON.stringify(photo.payload));
  });
}
