import type { ReactNode } from 'react';
import type { ApiError } from '../api/client';

/**
 * Renders the non-success states of an API query in plain language.
 *
 * Deliberately has no fallback to sample data: an empty or failed load must look
 * empty or failed, never like a real project. Returns null when there is data to
 * show, so the caller renders its own content.
 */
export default function QueryState({
  loading,
  error,
  isEmpty,
  emptyTitle,
  emptyBody,
  onRetry,
}: {
  loading: boolean;
  error: ApiError | null;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
  onRetry: () => void;
}): ReactNode {
  if (error !== null) {
    const needsToken = error.isAuthFailure;
    return (
      <div className="empty-state" role="alert">
        <div className="empty-state-icon">{needsToken ? '🔒' : '⚠️'}</div>
        <div className="empty-state-text">{needsToken ? 'Not signed in' : 'Could not load'}</div>
        <div className="empty-state-subtext">
          {needsToken
            ? 'Enter the pilot access token issued for this session to see live project data.'
            : error.message}
        </div>
        {!needsToken && (
          <button type="button" className="action-button secondary mt-2" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="empty-state-icon">⏳</div>
        <div className="empty-state-text">Loading…</div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-text">{emptyTitle}</div>
        <div className="empty-state-subtext">{emptyBody}</div>
      </div>
    );
  }

  return null;
}
