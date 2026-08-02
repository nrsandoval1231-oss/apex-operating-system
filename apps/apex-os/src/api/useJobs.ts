import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActionCardListSchema,
  DailyBriefSchema,
  DrawScheduleSchema,
  JobGatePlanSchema,
  JobSummaryListSchema,
  JobSummarySchema,
  type ActionCard,
  type DailyBrief,
  type DrawSchedule,
  type JobGatePlanEntry,
  type JobSummary,
} from '@apex/contracts';
import { ApiError, apiGet } from './client';
import { getToken, subscribeToToken } from './session';

export interface Query<T> {
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly loading: boolean;
  readonly reload: () => void;
}

/** Re-renders whichever screens depend on the pilot token when it changes. */
export const useToken = (): string => useSyncExternalStore(subscribeToToken, getToken, () => '');

/**
 * Load one API resource, refetching whenever the path, token, or reload counter
 * changes. Aborted and superseded requests never write state, so a fast token
 * change cannot leave a stale response on screen.
 */
const useResource = <T>(
  path: string | null,
  load: (path: string, signal: AbortSignal) => Promise<T>,
): Query<T> => {
  const token = useToken();
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({
    data: null,
    error: null,
    loading: path !== null,
  });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState((previous) => ({ ...previous, loading: true }));
    load(path, controller.signal)
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((cause: unknown) => {
        if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        const error = cause instanceof ApiError ? cause : new ApiError('Unexpected client error.', 0);
        setState({ data: null, error, loading: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, token, attempt, load]);

  return { ...state, reload };
};

const loadJobs = (path: string, signal: AbortSignal): Promise<readonly JobSummary[]> =>
  apiGet(path, JobSummaryListSchema, signal);

const loadJob = (path: string, signal: AbortSignal): Promise<JobSummary> =>
  apiGet(path, JobSummarySchema, signal);

/** Every job the current user may see, newest first. */
export const useJobs = (): Query<readonly JobSummary[]> => useResource('/api/jobs', loadJobs);

/** One job summary. Pass undefined while the route parameter is unresolved. */
export const useJob = (jobId: string | undefined): Query<JobSummary> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}`, loadJob);

const loadCards = (path: string, signal: AbortSignal): Promise<readonly ActionCard[]> =>
  apiGet(path, ActionCardListSchema, signal);

/** The §9.5 action feed, derived server-side from stored state. */
export const useActionCards = (): Query<readonly ActionCard[]> =>
  useResource('/api/today', loadCards);

const loadBrief = (path: string, signal: AbortSignal): Promise<DailyBrief> =>
  apiGet(path, DailyBriefSchema, signal);

/** Today's brief. Generated once per day by the server, then frozen. */
export const useDailyBrief = (): Query<DailyBrief> => useResource('/api/brief', loadBrief);

const loadDraws = (path: string, signal: AbortSignal): Promise<DrawSchedule> =>
  apiGet(path, DrawScheduleSchema, signal);

/** The job's draw schedule and where the money stands. */
export const useDrawSchedule = (jobId: string | undefined): Query<DrawSchedule> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/draws`, loadDraws);

const loadGatePlan = (path: string, signal: AbortSignal): Promise<readonly JobGatePlanEntry[]> =>
  apiGet(path, JobGatePlanSchema, signal);

/** The job's seven Gate templates and whichever of them have been opened. */
export const useJobGates = (jobId: string | undefined): Query<readonly JobGatePlanEntry[]> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/gates`, loadGatePlan);
