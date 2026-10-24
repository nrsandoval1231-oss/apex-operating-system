import { describe, it, expect } from 'vitest';
import { taskInScope, canEditTask } from './taskAccess';
const base = { jobId: 'project', createdBy: 'other', assignedUserId: 'other' };
describe('canonical task presentation access', () => {
  it('my checklist includes assigned work and own unassigned personal work only', () => {
    expect(taskInScope(base, 'mine', 'me')).toBe(false);
    expect(taskInScope({ ...base, createdBy: 'me' }, 'mine', 'me')).toBe(false);
    expect(taskInScope({ ...base, assignedUserId: 'me' }, 'mine', 'me')).toBe(
      true,
    );
    expect(
      taskInScope(
        { ...base, jobId: null, createdBy: 'me', assignedUserId: null },
        'mine',
        'me',
      ),
    ).toBe(true);
    expect(
      taskInScope({ ...base, jobId: null, createdBy: 'me' }, 'mine', 'me'),
    ).toBe(false);
  });
  it('project staff controls follow creator assignee and manager policy', () => {
    expect(canEditTask(base, { userId: 'me', role: 'field' })).toBe(false);
    expect(
      canEditTask(
        { ...base, assignedUserId: 'me' },
        { userId: 'me', role: 'field' },
      ),
    ).toBe(true);
    expect(canEditTask(base, { userId: 'me', role: 'superintendent' })).toBe(
      true,
    );
    expect(
      canEditTask({ ...base, jobId: null }, { userId: 'me', role: 'admin' }),
    ).toBe(false);
  });
});
