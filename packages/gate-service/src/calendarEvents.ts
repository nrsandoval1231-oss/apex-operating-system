import type { Database, Queryable } from '@apex/database';
import {
  createCanonicalId,
  CalendarEventSchema,
  CalendarEventCreateSchema,
  CalendarEventEditSchema,
  CalendarEventCancelSchema,
  STAFF_ROLES,
  type CalendarEvent,
  type EventActor,
} from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { assertJobMutable } from './jobState.js';
const fail = (message: string): never => {
  throw new DomainRuleError(message);
};
export class CalendarService {
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
  private visible(t: CalendarEvent, id: string) {
    return t.jobId !== null || t.createdBy === id || t.assignedUserId === id;
  }
  async list(actor: EventActor, jobId?: string) {
    const u = await this.staff(this.db, actor);
    const rows = await this.db.query<{ snapshot: CalendarEvent }>(
      `select snapshot from calendar_events where (job_id is not null or created_by=$1 or assigned_user_id=$1) and ($2::text is null or job_id=$2) order by calendar_event_id desc`,
      [u.id, jobId ?? null],
    );
    return rows.rows.map((r) => CalendarEventSchema.parse(r.snapshot));
  }
  async history(actor: EventActor, id: string) {
    const u = await this.staff(this.db, actor);
    // Visibility and audit entries must come from one PostgreSQL statement snapshot.
    // A reassignment between separate reads must never expose later private entries.
    const result = await this.db.query<{ entry: unknown }>(
      `select h.entry from calendar_events t
       join calendar_event_history h on h.calendar_event_id=t.calendar_event_id
       where t.calendar_event_id=$1 and (t.job_id is not null or t.created_by=$2 or t.assigned_user_id=$2)
       order by h.history_id`,
      [id, u.id],
    );
    if (result.rows.length === 0) return fail('Event not found.');
    return result.rows.map((r) => r.entry);
  }

  async command(
    actor: EventActor,
    key: string,
    action: 'create' | 'edit' | 'cancel',
    id: string | null,
    input: unknown,
  ): Promise<CalendarEvent> {
    const body =
      action === 'create'
        ? CalendarEventCreateSchema.parse(input)
        : action === 'edit'
          ? CalendarEventEditSchema.parse(input)
          : CalendarEventCancelSchema.parse(input);
    if (key.trim().length < 8 || key.length > 200)
      return fail('Idempotency key requires 8 to 200 characters.');
    return this.db.transaction(async (tx) => {
      const u = await this.staff(tx, actor);
      // Serialize keys independently of calendar_event/job locking, so concurrent identical creates replay.
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
      const binding = JSON.stringify({
        actor: u.id,
        action,
        target: id,
        input: body,
      });
      const prior = (
        await tx.query<{ binding: string; response: CalendarEvent }>(
          'select binding,response from calendar_event_receipts where idempotency_key=$1',
          [key],
        )
      ).rows[0];
      if (prior) {
        if (prior.binding !== binding)
          return fail(
            'Idempotency key already used for a different actor or request.',
          );
        const current = (
          await tx.query<{ snapshot: CalendarEvent }>(
            'select snapshot from calendar_events where calendar_event_id=$1',
            [prior.response.eventId],
          )
        ).rows[0];
        if (!current || !this.visible(current.snapshot, u.id))
          return fail('Event not found.');
        return CalendarEventSchema.parse(prior.response);
      }
      let old: CalendarEvent | undefined;
      if (id) {
        const found = (
          await tx.query<{ snapshot: CalendarEvent }>(
            'select snapshot from calendar_events where calendar_event_id=$1',
            [id],
          )
        ).rows[0];
        if (!found || !this.visible(found.snapshot, u.id))
          return fail('Event not found.');
        if (found.snapshot.jobId)
          await assertJobMutable(tx, found.snapshot.jobId);
        old = (
          await tx.query<{ snapshot: CalendarEvent }>(
            'select snapshot from calendar_events where calendar_event_id=$1 for update',
            [id],
          )
        ).rows[0]?.snapshot;
        if (!old || !this.visible(old, u.id)) return fail('Event not found.');
        if (
          old.createdBy !== u.id &&
          old.assignedUserId !== u.id &&
          !(old.jobId && u.manager)
        )
          return fail(
            'Only the creator, assignee, or project manager may edit this event.',
          );
        if (
          old.revision !==
          ('expectedRevision' in body ? body.expectedRevision : 0)
        )
          return fail('Event changed. Reload before saving.');
        if (old.cancelledAt)
          return fail(
            'Cancelled events retain their audit history and cannot be edited.',
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
      const now = new Date().toISOString();
      const fields =
        action === 'cancel'
          ? {}
          : Object.fromEntries(
              Object.entries(body).filter(([k]) => k !== 'expectedRevision'),
            );
      const event = CalendarEventSchema.parse({
        ...old,
        ...fields,
        eventId: old?.eventId ?? createCanonicalId('agenda'),
        createdBy: old?.createdBy ?? u.id,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
        revision: (old?.revision ?? 0) + 1,
        cancelledAt: action === 'cancel' ? now : null,
        cancelledBy: action === 'cancel' ? u.id : null,
      });
      await this.save(
        tx,
        event,
        action === 'create'
          ? 'created'
          : action === 'edit'
            ? 'edited'
            : 'cancelled',
        u.id,
        !!old,
      );
      await tx.query(
        'insert into calendar_event_receipts values ($1,$2,$3::jsonb)',
        [key, binding, JSON.stringify(event)],
      );
      return event;
    });
  }
  private async save(
    tx: Queryable,
    t: CalendarEvent,
    action: string,
    actor: string,
    update: boolean,
  ) {
    if (update)
      await tx.query(
        'update calendar_events set assigned_user_id=$2,snapshot=$3::jsonb where calendar_event_id=$1',
        [t.eventId, t.assignedUserId, JSON.stringify(t)],
      );
    else
      await tx.query(
        'insert into calendar_events(calendar_event_id,job_id,created_by,assigned_user_id,snapshot) values($1,$2,$3,$4,$5::jsonb)',
        [t.eventId, t.jobId, t.createdBy, t.assignedUserId, JSON.stringify(t)],
      );
    await tx.query(
      'insert into calendar_event_history(calendar_event_id,entry) values($1,$2::jsonb)',
      [
        t.eventId,
        JSON.stringify({ action, actor, at: t.updatedAt, snapshot: t }),
      ],
    );
  }
}
