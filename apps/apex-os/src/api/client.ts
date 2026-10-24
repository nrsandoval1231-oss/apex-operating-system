import type { ZodType } from 'zod';
import { getToken } from './session';

/**
 * Thin client over the Gate API.
 *
 * Every response is validated against the shared @apex/contracts schema before
 * it reaches a component, so a drifted or partial payload fails loudly here
 * instead of rendering as a plausible-looking pool project.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request failed because no valid pilot token is present. */
  get isAuthFailure(): boolean {
    return this.status === 403;
  }
}

/**
 * A dropped request is retried once, quietly.
 *
 * The dev proxy blips while the app rebuilds, and a phone changing cell or
 * leaving a jobsite's wifi does the same thing for a different reason. One
 * silent retry turns most of those into nothing the user ever sees.
 */
const RETRY_DELAY_MS = 400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Coalesce concurrent token/path reads. A subscriber cancels its own wait, never
// another subscriber's fetch. Successful commands invalidate pending sharing.
const pendingReads = new Map<string, Promise<unknown>>();
export const apiGet = async <T>(
  path: string,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T> => {
  const token = getToken(),
    key = JSON.stringify([token, path]);
  let pending = pendingReads.get(key);
  if (!pending) {
    pending = (async () => {
      const send = () =>
        fetch(path, {
          headers: {
            ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
            accept: 'application/json',
          },
        });
      let response: Response;
      try {
        try {
          response = await send();
        } catch {
          await wait(RETRY_DELAY_MS);
          response = await send();
        }
      } catch {
        throw new ApiError(
          'Could not reach the Apex API. The connection failed rather than the request.',
          0,
        );
      }
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new ApiError(
          typeof body === 'object' &&
          body !== null &&
          typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : `Request failed with HTTP ${response.status}.`,
          response.status,
        );
      return body;
    })();
    pendingReads.set(key, pending);
    const clear = () => {
      if (pendingReads.get(key) === pending) pendingReads.delete(key);
    };
    void pending.then(clear, clear);
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const body = await new Promise<unknown>((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    pending!
      .then(resolve, reject)
      .finally(() => signal?.removeEventListener('abort', abort));
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      'The Apex API returned data this build does not understand.',
      200,
    );
  return parsed.data;
};

/** A resolved actor change must not coalesce new private reads with old ones. */
export function clearPendingReads(): void {
  pendingReads.clear();
}

/** XHR photo uploads use the same invalidation boundary as JSON commands. */
export function invalidateAndNotify(): void {
  clearPendingReads();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('apex:data-changed'));
  }
}

/**
 * A request that changes something.
 *
 * Deliberately not retried. `apiGet` retries a dropped read because reading
 * twice costs nothing; issuing a customer link twice, or revoking one twice, is
 * not the same thing at all. A write that fails is reported and left to a
 * person to repeat.
 */
export const apiSend = async <T>(
  path: string,
  schema: ZodType<T>,
  init: { method: 'POST' | 'DELETE'; body?: unknown; idempotencyKey?: string },
): Promise<T> => {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method,
      headers: {
        ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
        'content-type': 'application/json',
        accept: 'application/json',
        // Callers may retain one key per user intent after an uncertain response.
        // Existing callers still receive a fresh key for each explicit attempt.
        'idempotency-key': init.idempotencyKey ?? crypto.randomUUID(),
      },
      body: JSON.stringify(init.body ?? {}),
    });
  } catch {
    throw new ApiError(
      'Could not reach the Apex API. The connection failed rather than the request.',
      0,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed with HTTP ${response.status}.`;
    throw new ApiError(message, response.status);
  }

  invalidateAndNotify();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      'The Apex API returned data this build does not understand.',
      response.status,
    );
  }
  return parsed.data;
};
