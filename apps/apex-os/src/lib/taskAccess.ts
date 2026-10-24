type TaskAccess = {
  jobId: string | null;
  createdBy: string;
  assignedUserId: string | null;
};
export function taskInScope(
  task: TaskAccess,
  scope: 'mine' | 'all',
  userId: string | undefined,
): boolean {
  return (
    scope === 'all' ||
    (!!userId &&
      (task.assignedUserId === userId ||
        (task.jobId === null &&
          task.createdBy === userId &&
          task.assignedUserId === null)))
  );
}
export function canEditTask(
  task: TaskAccess,
  me: { userId: string; role: string } | null,
): boolean {
  return (
    !!me &&
    (task.createdBy === me.userId ||
      task.assignedUserId === me.userId ||
      (task.jobId !== null &&
        ['admin', 'office', 'superintendent'].includes(me.role)))
  );
}
