/**
 * Structured logging — deployment plan slice 6.
 *
 * One JSON object per line, because the deployed logs are read by a platform
 * log viewer and grep, not by a person watching a terminal.
 *
 * THE RULE THIS FILE EXISTS FOR: a customer link token lives in the URL path.
 * Logging a raw request path would write live, working tokens into the log
 * stream — where they are retained, searchable, and visible to anyone with
 * dashboard access. That would undo the whole point of storing only the hash.
 * `redactPath` runs on every logged path, and nothing here logs a header.
 */

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Replace a customer link token with a marker.
 *
 * Matches the token shape rather than the route, so it redacts anywhere a token
 * appears — including on a path that does not exist, which is exactly where a
 * mistyped or probing request would otherwise leak one.
 */
export const redactPath = (path: string): string =>
  path.replace(/\/c\/[A-Za-z0-9_-]{43}/g, '/c/[token]');

export interface LogFields {
  readonly [key: string]: string | number | boolean | null | undefined;
}

const emit = (level: LogLevel, event: string, fields: LogFields): void => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === 'error') console.error(line);
  else console.log(line);
};

export const log = {
  info: (event: string, fields: LogFields = {}) => emit('info', event, fields),
  warn: (event: string, fields: LogFields = {}) => emit('warn', event, fields),
  /**
   * Errors carry a message and, in development, a stack. The stack is omitted
   * when a public origin is configured — stack traces name internal paths and
   * package versions, and the log viewer is not always as private as the box.
   */
  error: (event: string, error: unknown, fields: LogFields = {}) => emit('error', event, {
    ...fields,
    message: error instanceof Error ? error.message : String(error),
    ...(process.env.APEX_PUBLIC_ORIGIN ? {} : { stack: error instanceof Error ? error.stack : undefined }),
  }),
};
