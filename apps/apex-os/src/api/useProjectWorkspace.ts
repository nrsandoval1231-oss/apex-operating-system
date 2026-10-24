import {
  WorkspaceProjectListSchema,
  ProjectNotesSchema,
  ProjectActivitySchema,
} from '@apex/contracts';
import { apiGet } from './client';
import { useResource } from './useJobs';
const metadata = (p: string, s: AbortSignal) =>
  apiGet(p, WorkspaceProjectListSchema, s);
const notes = (p: string, s: AbortSignal) => apiGet(p, ProjectNotesSchema, s);
const activity = (p: string, s: AbortSignal) =>
  apiGet(p, ProjectActivitySchema, s);
export const useProjectWorkspace = () =>
  useResource('/api/workspace-projects', metadata);
export const useProjectNotes = (jobId: string) =>
  useResource(`/api/jobs/${jobId}/notes`, notes);
export const useProjectActivity = (jobId: string) =>
  useResource(`/api/jobs/${jobId}/activity`, activity);
