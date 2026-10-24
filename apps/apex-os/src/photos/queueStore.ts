import type { JobPhotoUpload } from '@apex/contracts';

export interface QueuedPhoto {
  id: string;
  ownerId: string;
  jobId: string;
  name: string;
  payload: JobPhotoUpload;
  byteSize: number;
  queuedAt: string;
  attempted: boolean;
}
export type DraftField = 'caption' | 'stage' | 'category';
export const MAX_QUEUE_FILES = 10;
export const MAX_QUEUE_BYTES = 40 * 1024 * 1024;
const DATABASE = 'apex-device-photo-queue';
const STORE = 'photos';

export class QueueConflictError extends Error {}

async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Device storage is blocked.'));
  });
}

/** Read and conditional write share one native transaction, including across tabs. */
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (
    store: IDBObjectStore,
    done: (result: T) => void,
    refuse: (error: Error) => void,
  ) => void,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result: T;
      let failure: Error | undefined;
      const refuse = (error: Error) => {
        failure = error;
        tx.abort();
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure ?? tx.error);
      tx.onabort = () =>
        reject(
          failure ?? tx.error ?? new Error('Device storage was interrupted.'),
        );
      try {
        work(
          tx.objectStore(STORE),
          (value) => {
            result = value;
          },
          refuse,
        );
      } catch (error) {
        refuse(
          error instanceof Error ? error : new Error('Device storage failed.'),
        );
      }
    });
  } finally {
    db.close();
  }
}

function assertScope(current: QueuedPhoto, requested: QueuedPhoto): void {
  if (
    current.ownerId !== requested.ownerId ||
    current.jobId !== requested.jobId
  ) {
    throw new QueueConflictError(
      'This pending photo belongs to another account or project.',
    );
  }
}

export async function readQueue(
  ownerId: string,
  jobId: string,
): Promise<QueuedPhoto[]> {
  const rows = await transaction<QueuedPhoto[]>('readonly', (store, done) => {
    store.getAll().onsuccess = (event) =>
      done((event.target as IDBRequest<QueuedPhoto[]>).result);
  });
  return rows
    .filter((row) => row.ownerId === ownerId && row.jobId === jobId)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

/** Only newly selected files may insert a freshly generated identity. Never upsert. */
export async function addQueuedPhoto(photo: QueuedPhoto): Promise<void> {
  await transaction<void>('readwrite', (store, done, refuse) => {
    const read = store.getAll();
    read.onsuccess = () => {
      const rows = read.result as QueuedPhoto[];
      const scoped = rows.filter(
        (row) => row.ownerId === photo.ownerId && row.jobId === photo.jobId,
      );
      if (rows.some((row) => row.id === photo.id)) {
        refuse(
          new QueueConflictError('This pending photo identity already exists.'),
        );
      } else if (
        scoped.length >= MAX_QUEUE_FILES ||
        scoped.reduce((sum, row) => sum + row.byteSize, 0) + photo.byteSize >
          MAX_QUEUE_BYTES
      ) {
        refuse(
          new QueueConflictError(
            'Device queue is limited to 10 photos and 40 MB per project. Upload or discard some first.',
          ),
        );
      } else store.add(photo).onsuccess = () => done();
    };
  });
}

/** Missing rows are terminal for every stale edit/freeze; neither operation inserts. */
async function changeExisting(
  photo: QueuedPhoto,
  change: (current: QueuedPhoto) => QueuedPhoto,
): Promise<QueuedPhoto | null> {
  return transaction('readwrite', (store, done, refuse) => {
    const read = store.get(photo.id);
    read.onsuccess = () => {
      const current = read.result as QueuedPhoto | undefined;
      if (!current) {
        done(null);
        return;
      }
      try {
        assertScope(current, photo);
        const next = change(current);
        if (next === current) done(current);
        else store.put(next).onsuccess = () => done(next);
      } catch (error) {
        refuse(error as Error);
      }
    };
  });
}

export async function updateQueuedPhoto(
  photo: QueuedPhoto,
  field: DraftField,
  value: string | null,
): Promise<QueuedPhoto | null> {
  return changeExisting(photo, (current) =>
    current.attempted
      ? current
      : {
          ...current,
          payload: { ...current.payload, [field]: value },
        },
  );
}

/** Every attempt sends this authoritative row; the first attempt freezes its payload. */
export async function freezeQueuedPhoto(
  photo: QueuedPhoto,
): Promise<QueuedPhoto | null> {
  return changeExisting(photo, (current) =>
    current.attempted ? current : { ...current, attempted: true },
  );
}

export async function deleteQueuedPhoto(photo: QueuedPhoto): Promise<void> {
  await transaction<void>('readwrite', (store, done, refuse) => {
    const read = store.get(photo.id);
    read.onsuccess = () => {
      const current = read.result as QueuedPhoto | undefined;
      if (!current) {
        done();
        return;
      }
      try {
        assertScope(current, photo);
        store.delete(photo.id).onsuccess = () => done();
      } catch (error) {
        refuse(error as Error);
      }
    };
  });
}
