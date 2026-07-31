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

export const apiGet = async <T>(path: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T> => {
  const token = getToken();
  if (token === '') throw new ApiError('A pilot access token is required.', 403);

  let response: Response;
  try {
    response = await fetch(path, {
      ...(signal ? { signal } : {}),
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('The Apex API is unreachable. Is the Gate API running?', 0);
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
