import { TaskListSchema, TaskAssigneesSchema } from '@apex/contracts';
import { apiGet } from './client';
import { useResource } from './useJobs';
const loadTasks = (p: string, s: AbortSignal) => apiGet(p, TaskListSchema, s);
const loadAssignees = (p: string, s: AbortSignal) =>
  apiGet(p, TaskAssigneesSchema, s);
export const useTasks = (jobId?: string) =>
  useResource(
    jobId ? `/api/tasks?jobId=${encodeURIComponent(jobId)}` : '/api/tasks',
    loadTasks,
  );
export const useTaskAssignees = () =>
  useResource('/api/task-assignees', loadAssignees);
