import { WorkspaceCalendarSchema } from '@apex/contracts';
import { apiGet } from './client';
import { useResource } from './useJobs';
const load = (path: string, signal: AbortSignal) =>
  apiGet(path, WorkspaceCalendarSchema, signal);
export const useWorkspaceCalendar = () =>
  useResource('/api/workspace-calendar', load);
