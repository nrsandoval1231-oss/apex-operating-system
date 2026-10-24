import type { Database, Queryable } from '@apex/database';
import {
  createCanonicalId,
  TaskSchema,
  TaskCreateSchema,
  TaskEditSchema,
  TaskCompleteSchema,
  STAFF_ROLES,
  type Task,
  type EventActor,
} from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { assertJobMutable } from './jobState.js';
const fail = (message: string): never => {
  throw new DomainRuleError(message);
};
export function nextTaskDate(day: string, cadence: Task['recurrence']): string {
  const d = new Date(day + 'T00:00:00Z');
  if (cadence === 'monthly') {
    const n = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 2);
    d.setUTCDate(0);
    d.setUTCDate(Math.min(n, d.getUTCDate()));
  } else d.setUTCDate(d.getUTCDate() + (cadence === 'weekly' ? 7 : 1));
  return d.toISOString().slice(0, 10);
}
export class TaskService {
  constructor(private readonly db: Database) {}
  private async staff(tx: Queryable, actor: EventActor) {
    if (
      actor.kind !== 'user' ||
      !STAFF_ROLES.includes(actor.role as (typeof STAFF_ROLES)[number])
    )
      return fail('Staff access required.');
    const u = await tx.query<{ role: string }>(
      'select role from app_users where user_id=$1 and active=true',
      [actor.userId],
    );
    if (
      !u.rows[0] ||
      !STAFF_ROLES.includes(u.rows[0].role as (typeof STAFF_ROLES)[number])
    )
      return fail('Active staff access required.');
    return {
      id: actor.userId,
      manager: ['admin', 'office', 'superintendent'].includes(u.rows[0].role),
    };
  }
  private visible(t: Task, id: string) {
    return t.jobId !== null || t.createdBy === id || t.assignedUserId === id;
  }
  async list(actor: EventActor, jobId?: string) {
    const u = await this.staff(this.db, actor);
    const rows = await this.db.query<{ snapshot: Task }>(
      `select snapshot from tasks where (job_id is not null or created_by=$1 or assigned_user_id=$1) and ($2::text is null or job_id=$2) order by task_id desc`,
      [u.id, jobId ?? null],
    );
    return rows.rows.map((r) => TaskSchema.parse(r.snapshot));
  }
  async assignees(actor: EventActor) {
    await this.staff(this.db, actor);
    const rows = await this.db.query<{ userId: string; displayName: string }>(
      `select user_id as "userId", display_name as "displayName" from app_users where active=true and role=any($1::text[]) order by display_name`,
      [[...STAFF_ROLES]],
    );
    return rows.rows;
  }
  async history(actor: EventActor, id: string) {
    const u = await this.staff(this.db, actor);
    const r = await this.db.query<{ snapshot: Task }>(
      'select snapshot from tasks where task_id=$1',
      [id],
    );
    if (!r.rows[0] || !this.visible(r.rows[0].snapshot, u.id))
      return fail('Task not found.');
    return (
      await this.db.query<{ entry: unknown }>(
        'select entry from task_history where task_id=$1 order by history_id',
        [id],
      )
    ).rows.map((r) => r.entry);
  }
  async command(
    actor: EventActor,
    key: string,
    action: 'create' | 'edit' | 'complete',
    id: string | null,
    input: unknown,
  ): Promise<Task> {
    const body =
      action === 'create'
        ? TaskCreateSchema.parse(input)
        : action === 'edit'
          ? TaskEditSchema.parse(input)
          : TaskCompleteSchema.parse(input);
    if (key.trim().length < 8 || key.length > 200)
      return fail('Idempotency key requires 8 to 200 characters.');
    return this.db.transaction(async (tx) => {
      const u = await this.staff(tx, actor);
      // Serialize keys independently of task/job locking, so concurrent identical creates replay.
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
      const binding = JSON.stringify({
        actor: u.id,
        action,
        target: id,
        input: body,
      });
      const prior = (
        await tx.query<{ binding: string; response: Task }>(
          'select binding,response from task_receipts where idempotency_key=$1',
          [key],
        )
      ).rows[0];
      if (prior) {
        if (prior.binding !== binding)
          return fail(
            'Idempotency key already used for a different actor or request.',
          );
        const current = (
          await tx.query<{ snapshot: Task }>(
            'select snapshot from tasks where task_id=$1',
            [prior.response.taskId],
          )
        ).rows[0];
        if (!current || !this.visible(current.snapshot, u.id))
          return fail('Task not found.');
        return TaskSchema.parse(prior.response);
      }
      let old: Task | undefined;
      if (id) {
        const found = (
          await tx.query<{ snapshot: Task }>(
            'select snapshot from tasks where task_id=$1',
            [id],
          )
        ).rows[0];
        if (!found || !this.visible(found.snapshot, u.id))
          return fail('Task not found.');
        if (found.snapshot.jobId)
          await assertJobMutable(tx, found.snapshot.jobId);
        old = (
          await tx.query<{ snapshot: Task }>(
            'select snapshot from tasks where task_id=$1 for update',
            [id],
          )
        ).rows[0]?.snapshot;
        if (!old || !this.visible(old, u.id)) return fail('Task not found.');
        if (
          old.createdBy !== u.id &&
          old.assignedUserId !== u.id &&
          !(old.jobId && u.manager)
        )
          return fail(
            'Only the creator, assignee, or project manager may edit this task.',
          );
        if (
          old.revision !==
          ('expectedRevision' in body ? body.expectedRevision : 0)
        )
          return fail('Task changed. Reload before saving.');
        if (old.completedAt)
          return fail(
            'Completed tasks retain their completion history and cannot be edited.',
          );
      } else if ('jobId' in body && body.jobId)
        await assertJobMutable(tx, body.jobId);
      if ('assignedUserId' in body && body.assignedUserId) {
        const a = await tx.query(
          'select 1 from app_users where user_id=$1 and active=true and role=any($2::text[]) for share',
          [body.assignedUserId, [...STAFF_ROLES]],
        );
        if (!a.rows.length) return fail('Assignee must be active staff.');
      }
      if (
        action === 'complete' &&
        old?.recurrence !== 'none' &&
        old?.assignedUserId
      ) {
        const eligible = await tx.query(
          'select 1 from app_users where user_id=$1 and active=true and role=any($2::text[]) for share',
          [old.assignedUserId, [...STAFF_ROLES]],
        );
        if (!eligible.rows.length)
          return fail(
            'Recurring task assignee must be active staff. Reassign before completing.',
          );
      }
      const now = new Date().toISOString();
      const fields =
        action === 'complete'
          ? {}
          : Object.fromEntries(
              Object.entries(body).filter(([k]) => k !== 'expectedRevision'),
            );
      const task = TaskSchema.parse({
        ...old,
        ...fields,
        taskId: old?.taskId ?? createCanonicalId('task'),
        createdBy: old?.createdBy ?? u.id,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
        revision: (old?.revision ?? 0) + 1,
        parentTaskId: old?.parentTaskId ?? null,
        completedAt: action === 'complete' ? now : null,
        completedBy: action === 'complete' ? u.id : null,
      });
      await this.save(
        tx,
        task,
        action === 'create'
          ? 'created'
          : action === 'edit'
            ? 'edited'
            : 'completed',
        u.id,
        !!old,
      );
      if (action === 'complete' && task.recurrence !== 'none' && task.dueDate) {
        const next = TaskSchema.parse({
          ...task,
          taskId: createCanonicalId('task'),
          parentTaskId: task.taskId,
          dueDate: nextTaskDate(task.dueDate, task.recurrence),
          revision: 1,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          completedBy: null,
        });
        await this.save(tx, next, 'created', u.id, false);
      }
      await tx.query('insert into task_receipts values ($1,$2,$3::jsonb)', [
        key,
        binding,
        JSON.stringify(task),
      ]);
      return task;
    });
  }
  private async save(
    tx: Queryable,
    t: Task,
    action: string,
    actor: string,
    update: boolean,
  ) {
    if (update)
      await tx.query(
        'update tasks set assigned_user_id=$2,snapshot=$3::jsonb where task_id=$1',
        [t.taskId, t.assignedUserId, JSON.stringify(t)],
      );
    else
      await tx.query(
        'insert into tasks(task_id,job_id,created_by,assigned_user_id,parent_task_id,snapshot) values($1,$2,$3,$4,$5,$6::jsonb)',
        [
          t.taskId,
          t.jobId,
          t.createdBy,
          t.assignedUserId,
          t.parentTaskId,
          JSON.stringify(t),
        ],
      );
    await tx.query(
      'insert into task_history(task_id,entry) values($1,$2::jsonb)',
      [
        t.taskId,
        JSON.stringify({ action, actor, at: t.updatedAt, snapshot: t }),
      ],
    );
  }
}
