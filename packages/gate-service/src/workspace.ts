import type { Database, Queryable } from '@apex/database';
import {
  createCanonicalId,
  STAFF_ROLES,
  WorkspaceProjectSchema,
  ProjectNoteSchema,
  ProjectNotesSchema,
  ProjectActivitySchema,
  ProjectNoteCommandSchema,
  ProjectPriorityCommandSchema,
  type EventActor,
  type JobId,
} from '@apex/contracts';
import { DomainRuleError, RoleRefusalError } from '@apex/domain';
import { assertJobMutable } from './jobState.js';
import { gateRequiredByScope, type SignedScopeLine } from './gateScope.js';
const divisions = [
  'Designer Pools',
  'Concrete Coating',
  'Design & Renovation',
  'Pool Service',
];
const iso = (value: string | Date) => new Date(value).toISOString();
export class WorkspaceService {
  constructor(private readonly db: Database) {}
  private async staff(tx: Queryable, actor: EventActor, manager = false) {
    if (
      actor.kind !== 'user' ||
      !STAFF_ROLES.includes(actor.role as (typeof STAFF_ROLES)[number])
    )
      throw new RoleRefusalError('Staff access required.');
    const u = (
      await tx.query<{ role: string }>(
        'select role from app_users where user_id=$1 and active=true',
        [actor.userId],
      )
    ).rows[0];
    if (!u || !STAFF_ROLES.includes(u.role as (typeof STAFF_ROLES)[number]))
      throw new RoleRefusalError('Active staff access required.');
    if (manager && !['admin', 'office', 'superintendent'].includes(u.role))
      throw new RoleRefusalError('Project manager access required.');
    return actor.userId;
  }
  async list(actor: EventActor) {
    await this.staff(this.db, actor);
    const result = await this.db.query<{
      job_id: string;
      proposal_version_id: string | null;
      vertical: string | null;
      priority: string;
      revision: number;
      scope: unknown;
      gates: { definitionKey: string; status: string | null }[];
    }>(`
   select j.job_id,l.accepted_payload->>'vertical' as vertical,coalesce(m.priority,'normal') as priority,coalesce(m.revision,0) as revision,
    pv.proposal_payload->'scope' as scope,pv.proposal_version_id,
    (select coalesce(jsonb_agg(jsonb_build_object('definitionKey',gd.definition_key,'status',gi.status)),'[]'::jsonb)
     from gate_definitions gd left join gate_instances gi on gi.definition_key=gd.definition_key and gi.job_id=j.job_id where gd.active=true) as gates
   from jobs j join leads l on l.lead_id=j.lead_id left join project_workspace_metadata m on m.job_id=j.job_id
   left join proposal_versions pv on pv.lead_id=j.lead_id and pv.version_number=j.signed_proposal_version and pv.status='signed'
   order by j.created_at desc,j.job_id desc`);
    return result.rows.map((r) => {
      const division = divisions.includes(r.vertical ?? '') ? r.vertical : null;
      const scope = Array.isArray(r.scope)
        ? r.scope.filter(
            (x): x is SignedScopeLine => typeof x === 'object' && x !== null,
          )
        : null;
      const gates = r.gates.filter((g) =>
        gateRequiredByScope(g.definitionKey, scope),
      );
      return WorkspaceProjectSchema.parse({
        jobId: r.job_id,
        proposalVersionId: r.proposal_version_id,
        division,
        stageCatalog: division === 'Designer Pools' ? 'pools' : null,
        priority: r.priority,
        revision: r.revision,
        gates:
          division === 'Designer Pools'
            ? {
                released: gates.filter((g) => g.status === 'released').length,
                required: gates.length,
              }
            : null,
      });
    });
  }
  async notes(actor: EventActor, jobId: JobId) {
    await this.staff(this.db, actor);
    const rows = await this.db.query<{
      note_id: string;
      job_id: string;
      text: string;
      actor: string;
      occurred_at: string | Date;
    }>(
      'select * from project_notes where job_id=$1 order by occurred_at desc,note_id desc',
      [jobId],
    );
    return ProjectNotesSchema.parse(
      rows.rows.map((r) => ({
        noteId: r.note_id,
        jobId: r.job_id,
        text: r.text,
        actor: r.actor,
        at: iso(r.occurred_at),
      })),
    );
  }
  async command(
    actor: EventActor,
    key: string,
    jobId: JobId,
    action: 'note' | 'priority',
    input: unknown,
  ) {
    const body =
      action === 'note'
        ? ProjectNoteCommandSchema.parse(input)
        : ProjectPriorityCommandSchema.parse(input);
    if (key.trim().length < 8 || key.length > 200)
      throw new DomainRuleError(
        'Idempotency key requires 8 to 200 characters.',
      );
    return this.db.transaction(async (tx) => {
      const user = await this.staff(tx, actor, action === 'priority');
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
      const binding = JSON.stringify({
        actor: user,
        jobId,
        action,
        input: body,
      });
      const prior = (
        await tx.query<{ binding: string; response: unknown }>(
          'select binding,response from project_workspace_receipts where idempotency_key=$1',
          [key],
        )
      ).rows[0];
      if (prior) {
        if (prior.binding !== binding)
          throw new DomainRuleError(
            'Idempotency key already used for a different actor or request.',
          );
        return prior.response;
      }
      await assertJobMutable(tx, jobId);
      const at = new Date().toISOString();
      let response: unknown;
      if ('text' in body) {
        response = ProjectNoteSchema.parse({
          noteId: createCanonicalId('note'),
          jobId,
          text: body.text,
          actor: user,
          at,
        });
        await tx.query('insert into project_notes values($1,$2,$3,$4,$5)', [
          (response as { noteId: string }).noteId,
          jobId,
          body.text,
          user,
          at,
        ]);
      } else {
        const revision =
          (
            await tx.query<{ revision: number }>(
              'select revision from project_workspace_metadata where job_id=$1',
              [jobId],
            )
          ).rows[0]?.revision ?? 0;
        if (revision !== body.expectedRevision)
          throw new DomainRuleError(
            'Project priority changed. Reload before saving.',
          );
        const next = revision + 1;
        await tx.query(
          'insert into project_workspace_metadata values($1,$2,$3,$4,$5) on conflict(job_id) do update set priority=excluded.priority,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at',
          [jobId, body.priority, next, user, at],
        );
        await tx.query(
          'insert into project_workspace_history(job_id,actor,occurred_at,priority,revision) values($1,$2,$3,$4,$5)',
          [jobId, user, at, body.priority, next],
        );
        response = { jobId, priority: body.priority, revision: next };
      }
      await tx.query(
        'insert into project_workspace_receipts values($1,$2,$3::jsonb)',
        [key, binding, JSON.stringify(response)],
      );
      return response;
    });
  }
  async activity(actor: EventActor, jobId: JobId) {
    await this.staff(this.db, actor);
    const rows = await this.db.query<{
      id: string;
      source: string;
      title: string;
      actor: string | null;
      at: string | Date;
    }>(
      `
   select 'note:'||note_id as id,'note' as source,text as title,actor,occurred_at as at from project_notes where job_id=$1
   union all select 'priority:'||history_id,'priority','Priority set to '||priority,actor,occurred_at from project_workspace_history where job_id=$1
   union all select 'task:'||h.history_id,'task',h.entry->>'action'||': '||(h.entry->'snapshot'->>'title'),h.entry->>'actor',(h.entry->>'at')::timestamptz from task_history h join tasks t on t.task_id=h.task_id where t.job_id=$1
   union all select 'appointment:'||h.history_id,'appointment',h.entry->>'action'||': '||(h.entry->'snapshot'->>'title'),h.entry->>'actor',(h.entry->>'at')::timestamptz from calendar_event_history h join calendar_events e on e.calendar_event_id=h.calendar_event_id where e.job_id=$1
   union all select 'operational:'||event_id,'operational',event_type,actor->>'userId',occurred_at from events where job_id=$1
   union all select 'photo:'||evidence_id,'photo',coalesce(caption,'Photo recorded'),captured_by,captured_at from evidence_records e where e.job_id=$1 and e.kind='photo' and not exists(select 1 from events v where v.job_id=$1 and v.event_type='evidence.added' and v.payload->>'evidenceId'=e.evidence_id)
   order by at desc,id desc`,
      [jobId],
    );
    return ProjectActivitySchema.parse(
      rows.rows.map((r) => ({ ...r, at: iso(r.at) })),
    );
  }
}
