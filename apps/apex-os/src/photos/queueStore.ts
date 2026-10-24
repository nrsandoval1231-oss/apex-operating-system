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
export const MAX_QUEUE_FILES = 10;
export const MAX_QUEUE_BYTES = 40 * 1024 * 1024;
const DATABASE = 'apex-device-photo-queue';
const STORE = 'photos';

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
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error('Device storage was interrupted.'));
    });
  } finally {
    db.close();
  }
}
export async function readQueue(
  ownerId: string,
  jobId: string,
): Promise<QueuedPhoto[]> {
  const rows = await transaction<QueuedPhoto[]>('readonly', (store) =>
    store.getAll(),
  );
  return rows
    .filter((row) => row.ownerId === ownerId && row.jobId === jobId)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}
export async function putQueuedPhoto(photo: QueuedPhoto): Promise<void> {
  await transaction('readwrite', (store) => store.put(photo));
}
export async function deleteQueuedPhoto(id: string): Promise<void> {
  await transaction('readwrite', (store) => store.delete(id));
}
