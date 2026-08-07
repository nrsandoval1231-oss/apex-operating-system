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

export const apiGet = async <T>(path: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T> => {
  // No token is not an error the client decides. The server may be running in
  // single-machine pilot mode, where a local request needs none; if it is not,
  // it answers 403 and the app shows sign-in. Only the server knows.
  const token = getToken();

  const send = () => fetch(path, {
    ...(signal ? { signal } : {}),
    headers: {
      ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
      accept: 'application/json',
    },
  });

  let response: Response;
  try {
    try {
      response = await send();
    } catch (first) {
      if (first instanceof DOMException && first.name === 'AbortError') throw first;
      await wait(RETRY_DELAY_MS);
      response = await send();
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    // The browser does not say why a fetch failed, so this must not guess. It
    // previously blamed the Gate API, which was wrong often enough to matter:
    // a blocked request, a sleeping laptop, or a dropped proxy look identical
    // from here, and naming the wrong cause sends someone to fix the wrong thing.
    throw new ApiError('Could not reach the Apex API. The connection failed rather than the request.', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `Request failed with HTTP ${response.status}.`;
    throw new ApiError(message, response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('The Apex API returned data this build does not understand.', response.status);
  }
  return parsed.data;
};

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
  init: { method: 'POST' | 'DELETE'; body?: unknown } ,
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
        /*
         * Every write carries an idempotency key, whether or not the route
         * currently demands one.
         *
         * The commanding routes refuse without it, and until the takeoff
         * attach shipped, no route this app could reach was one of them — so
         * the omission sat here harmlessly and surfaced as a 422 the first
         * time it mattered. One per call, not per intent: a retry after a
         * failure is a new attempt by a person who watched the first one fail,
         * and the domain rules are what stop a second approval, not this.
         */
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify(init.body ?? {}),
    });
  } catch {
    throw new ApiError('Could not reach the Apex API. The connection failed rather than the request.', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `Request failed with HTTP ${response.status}.`;
    throw new ApiError(message, response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('The Apex API returned data this build does not understand.', response.status);
  }
  return parsed.data;
};
