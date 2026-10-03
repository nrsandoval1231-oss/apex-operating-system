import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import {
  AppRoleSchema,
  CalendarEntryListSchema,
  ActionCardListSchema,
  CustomerLinkStatusSchema,
  DailyBriefSchema,
  JobInspectionListSchema,
  JobCloseoutSchema,
  JobPhotoListSchema,
  ScheduledVisitListSchema,
  StaffCustomerDecisionListSchema,
  VisitConflictSchema,
  DrawScheduleSchema,
  JobGatePlanSchema,
  JobSummaryListSchema,
  JobSummarySchema,
  type ActionCard,
  type CustomerLinkStatus,
  type DailyBrief,
  type DrawSchedule,
  type JobGatePlanEntry,
  type JobInspection,
  type JobCloseout,
  type JobPhoto,
  type JobSummary,
  type StaffCustomerDecision,
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
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener('apex:data-changed', refresh);
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
      window.removeEventListener('apex:data-changed', refresh);
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
export const useJobs = (view: 'all' | 'active' | 'historical' = 'all'): Query<readonly JobSummary[]> =>
  useResource(view === 'all' ? '/api/jobs' : `/api/jobs?view=${view}`, loadJobs);

/** One job summary. Pass undefined while the route parameter is unresolved. */
export const useJob = (jobId: string | undefined): Query<JobSummary> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}`, loadJob);

const loadCloseout = (path: string, signal: AbortSignal): Promise<JobCloseout> =>
  apiGet(path, JobCloseoutSchema, signal);

export const useJobCloseout = (jobId: string | undefined): Query<JobCloseout> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/close`, loadCloseout);

const loadCards = (path: string, signal: AbortSignal): Promise<readonly ActionCard[]> =>
  apiGet(path, ActionCardListSchema, signal);

/** The §9.5 action feed, derived server-side from stored state. */
export const useActionCards = (): Query<readonly ActionCard[]> =>
  useResource('/api/today', loadCards);

const JobScheduleSchema = z.strictObject({
  visits: ScheduledVisitListSchema,
  conflicts: z.array(VisitConflictSchema),
});
export type JobSchedule = z.infer<typeof JobScheduleSchema>;

const loadSchedule = (path: string, signal: AbortSignal): Promise<JobSchedule> =>
  apiGet(path, JobScheduleSchema, signal);

/** A job's booked visits and any conflict detected against them. */
export const useJobSchedule = (jobId: string | undefined): Query<JobSchedule> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/visits`, loadSchedule);

const loadCalendar = (path: string, signal: AbortSignal) => apiGet(path, CalendarEntryListSchema, signal);
export const useCalendar = (): Query<readonly z.infer<typeof CalendarEntryListSchema>[number][]> =>
  useResource('/api/calendar', loadCalendar);

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

const loadInspections = (path: string, signal: AbortSignal): Promise<readonly JobInspection[]> =>
  apiGet(path, JobInspectionListSchema, signal);

/**
 * Every inspection on the job — PRD §9.7.
 *
 * All seven come back every time. One nobody has touched arrives with a null
 * status, because "not requested" is the state most likely to stop a pour.
 */
export const useJobInspections = (jobId: string | undefined): Query<readonly JobInspection[]> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/inspections`, loadInspections);

/* ------------------------------------------------------- customer page (§9.11) */

const loadLinkStatus = (path: string, signal: AbortSignal): Promise<CustomerLinkStatus> =>
  apiGet(path, CustomerLinkStatusSchema, signal);

/**
 * The job's customer link, its history, and the recorded reads.
 *
 * The token is not part of this payload and never will be: it exists in the
 * clear once, in the response to issuing or rotating, and is not recoverable.
 */
export const useCustomerLink = (jobId: string | undefined): Query<CustomerLinkStatus> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/customer-link`, loadLinkStatus);

const loadPhotos = (path: string, signal: AbortSignal): Promise<readonly JobPhoto[]> =>
  apiGet(path, JobPhotoListSchema, signal);

/** Every gate photo on the job, published or not. */
export const useJobPhotos = (jobId: string | undefined): Query<readonly JobPhoto[]> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/photos`, loadPhotos);

const loadDecisions = (path: string, signal: AbortSignal): Promise<readonly StaffCustomerDecision[]> =>
  apiGet(path, StaffCustomerDecisionListSchema, signal);

/** What Apex is waiting on from this customer. */
export const useJobDecisions = (jobId: string | undefined): Query<readonly StaffCustomerDecision[]> =>
  useResource(jobId === undefined ? null : `/api/jobs/${jobId}/decisions`, loadDecisions);

const StaffSessionSchema = z.strictObject({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  role: AppRoleSchema,
});
export type StaffSession = z.infer<typeof StaffSessionSchema>;

const loadMe = (path: string, signal: AbortSignal): Promise<StaffSession> =>
  apiGet(path, StaffSessionSchema, signal);

/** Who this browser is, from `app_users`. The role is the row, never a token claim. */
export const useMe = (): Query<StaffSession> => useResource('/api/me', loadMe);
