import type { ReactNode } from 'react';
import type { ApiError } from '../api/client';

/**
 * The non-success states of an API query, in plain language.
 *
 * No fallback to sample data: an empty or failed load must look empty or failed,
 * never like a real project. Returns null when there is data, so the caller
 * renders its own content.
 */
export default function QueryState({
  loading,
  error,
  isEmpty,
  emptyTitle,
  emptyBody,
  onRetry,
  quiet = false,
}: {
  loading: boolean;
  error: ApiError | null;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
  onRetry: () => void;
  /** Set when this sits inside a section rather than owning the screen. */
  quiet?: boolean;
}): ReactNode {
  if (error !== null) {
    const needsToken = error.isAuthFailure;
    // A dropped connection has already been retried once inside the client, so
    // by the time it reaches here it is worth a person's attention.
    const offline = error.status === 0;
    return (
      <div className="state is-error" role="alert">
        <h3>{needsToken ? 'Session expired' : offline ? 'No connection' : 'Could not load'}</h3>
        {/*
          * Wording matters here: this is what someone reads when the working day
          * stops. It said "paste a fresh one", which described the pilot-token
          * flow and became wrong the moment staff signed in with a real provider.
          */}
        <p>{needsToken
          ? 'Your session is no longer valid. Sign out and sign in again to continue.'
          : error.message}</p>
        {!needsToken && (
          <button type="button" className="action action-quiet" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return quiet
      ? <p className="state-quiet" aria-busy="true">Loading…</p>
      : <div className="state" aria-busy="true"><h3>Loading</h3></div>;
  }

  if (isEmpty) {
    return quiet
      ? <p className="state-quiet">{emptyBody}</p>
      : (
        <div className="state">
          <h3>{emptyTitle}</h3>
          <p>{emptyBody}</p>
        </div>
      );
  }

  return null;
}
