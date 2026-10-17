import type { Database, Queryable } from '@apex/database';
import {
  LeadFollowupSchema,
  LeadFollowupTodayListSchema,
  OpportunityWorkSchema,
  readLeadIdentity,
  type EventActor,
  type LeadFollowup,
  type LeadFollowupTodayRow,
  type OpportunityWork,
} from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';

interface FollowupRow {
  followup_id: number | string;
  lead_id: string;
  next_action: string;
  due_date: string | Date;
  assigned_user_id: string;
  assigned_user_name: string;
  created_by: string;
  created_at: string | Date;
  completed_by: string | null;
  completed_at: string | Date | null;
}

const dateValue = (value: string | Date): string => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value).slice(0, 10);
const instantValue = (value: string | Date): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const mapFollowup = (row: FollowupRow): LeadFollowup => LeadFollowupSchema.parse({
  followupId: Number(row.followup_id), leadId: row.lead_id, nextAction: row.next_action,
  dueDate: dateValue(row.due_date), assignedUserId: row.assigned_user_id,
  assignedUserName: row.assigned_user_name, createdBy: row.created_by,
  createdAt: instantValue(row.created_at), completedBy: row.completed_by,
  completedAt: row.completed_at === null ? null : instantValue(row.completed_at),
});

const followupSelect = `select f.followup_id, f.lead_id, f.next_action, f.due_date,
  f.assigned_user_id, au.display_name as assigned_user_name, f.created_by, f.created_at,
  f.completed_by, f.completed_at
  from lead_followups f join app_users au on au.user_id = f.assigned_user_id`;

const eligibleLead = async (tx: Queryable, leadId: string) => {
  const result = await tx.query<{ lead_id: string; status: string }>(
    `select lead_id, status from leads where lead_id = $1 for update`, [leadId],
  );
  const lead = result.rows[0];
  if (!lead || !['accepted', 'qualified', 'proposal'].includes(lead.status)) {
    throw new DomainRuleError('Only an open pre-contract opportunity can have a follow-up.');
  }
  const job = await tx.query('select 1 from jobs where lead_id = $1', [leadId]);
  if (job.rows.length > 0) throw new DomainRuleError('A signed opportunity cannot have a pre-contract follow-up.');
  return lead;
};

const requireOffice = (actor: EventActor): string => {
  if (actor.kind !== 'user' || !['admin', 'office'].includes(actor.role)) {
    throw new DomainRuleError('Only admin or office staff may manage lead follow-ups.');
  }
  return actor.userId;
};

export class LeadFollowupService {
  constructor(private readonly db: Database) {}

  async getToday(today: string): Promise<readonly LeadFollowupTodayRow[]> {
    const result = await this.db.query<{
      lead_id: string; status: 'accepted' | 'qualified' | 'proposal'; accepted_payload: unknown;
      due_date: string | Date | null; next_action: string | null; assigned_user_name: string | null;
      issued: boolean;
    }>(`select l.lead_id, l.status, l.accepted_payload, f.due_date, f.next_action,
        au.display_name as assigned_user_name,
        (select pv.status = 'issued' from proposal_versions pv where pv.lead_id = l.lead_id order by pv.version_number desc limit 1) as issued
      from leads l left join jobs j on j.lead_id = l.lead_id
      left join lead_followups f on f.lead_id = l.lead_id and f.completed_at is null
      left join app_users au on au.user_id = f.assigned_user_id
      where l.status in ('accepted', 'qualified', 'proposal') and j.job_id is null
        and (f.followup_id is null or f.due_date <= $1::date)
      order by case when f.followup_id is null then 2 when f.due_date < $1::date then 0 else 1 end,
        f.due_date asc nulls last, l.lead_id asc`, [today]);
    const rows = result.rows.map((row) => {
      const identity = readLeadIdentity(row.accepted_payload);
      const dueDate = row.due_date === null ? null : dateValue(row.due_date);
      return {
        leadId: row.lead_id,
        customerName: identity.customerName ?? null,
        addressLine: identity.addressLine,
        leadStatus: row.status,
        kind: dueDate === null ? 'missing-next-action' : dueDate < today ? 'overdue' : 'due-today',
        dueDate,
        nextAction: row.next_action,
        proposalState: row.issued ? 'issued' : null,
        assignedUserName: row.assigned_user_name,
      } as const;
    });
    return LeadFollowupTodayListSchema.parse(rows);
  }

  async getOpportunity(leadId: string): Promise<OpportunityWork | null> {
    const result = await this.db.query<{ lead_id: string; status: OpportunityWork['leadStatus']; accepted_payload: unknown; proposal_status: OpportunityWork['proposalState'] }>(
      `select l.lead_id, l.status, l.accepted_payload,
        (select pv.status from proposal_versions pv where pv.lead_id = l.lead_id order by pv.version_number desc limit 1) as proposal_status
       from leads l where l.lead_id = $1`, [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const history = await this.db.query<FollowupRow>(`${followupSelect} where f.lead_id = $1 order by f.created_at desc, f.followup_id desc`, [leadId]);
    const assignees = await this.db.query<{ user_id: string; display_name: string }>(
      `select user_id, display_name from app_users where active and role in ('admin', 'office') order by display_name, user_id`,
    );
    const identity = readLeadIdentity(row.accepted_payload);
    return OpportunityWorkSchema.parse({
      leadId: row.lead_id, customerName: identity.customerName ?? null, addressLine: identity.addressLine,
      leadStatus: row.status, proposalState: row.proposal_status,
      assignees: assignees.rows.map((user) => ({ userId: user.user_id, displayName: user.display_name })),
      followups: history.rows.map(mapFollowup),
    });
  }

  async schedule(input: {
    leadId: string; nextAction: string; dueDate: string; assignedUserId: string;
    actor: EventActor; idempotencyKey: string;
  }): Promise<LeadFollowup> {
    const actorId = requireOffice(input.actor);
    return this.db.transaction(async (tx) => {
      await eligibleLead(tx, input.leadId);
      const replay = await tx.query<FollowupRow & { idempotency_key: string; due_date: string | Date }>(
        `${followupSelect} where f.idempotency_key = $1`, [input.idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].lead_id !== input.leadId) throw new DomainRuleError('Idempotency key was already used for another opportunity.');
        if (replay.rows[0].next_action !== input.nextAction || dateValue(replay.rows[0].due_date) !== input.dueDate
          || replay.rows[0].assigned_user_id !== input.assignedUserId) {
          throw new DomainRuleError('Idempotency key was already used for a different follow-up request.');
        }
        return mapFollowup(replay.rows[0]);
      }
      const assignee = await tx.query<{ user_id: string }>(
        `select user_id from app_users where user_id = $1 and active and role in ('admin', 'office')`, [input.assignedUserId],
      );
      if (!assignee.rows[0]) throw new DomainRuleError('Follow-ups must be assigned to active admin or office staff.');
      await tx.query(`update lead_followups set completed_by = $2, completed_at = now(), completion_idempotency_key = $3
        where lead_id = $1 and completed_at is null`, [input.leadId, actorId, `${input.idempotencyKey}:replace`]);
      const created = await tx.query<{ followup_id: number | string }>(
        `insert into lead_followups (lead_id, next_action, due_date, assigned_user_id, created_by, idempotency_key)
         values ($1, $2, $3::date, $4, $5, $6) returning followup_id`,
        [input.leadId, input.nextAction, input.dueDate, input.assignedUserId, actorId, input.idempotencyKey],
      );
      const row = await tx.query<FollowupRow>(`${followupSelect} where f.followup_id = $1`, [created.rows[0]?.followup_id]);
      if (!row.rows[0]) throw new Error('Created follow-up was not readable.');
      return mapFollowup(row.rows[0]);
    });
  }

  async complete(input: { leadId: string; followupId: number; actor: EventActor; idempotencyKey: string }): Promise<LeadFollowup> {
    const actorId = requireOffice(input.actor);
    return this.db.transaction(async (tx) => {
      await eligibleLead(tx, input.leadId);
      const replay = await tx.query<FollowupRow>(
        `${followupSelect} join lead_followups f2 on f2.followup_id = f.followup_id
         where f.lead_id = $1 and f.followup_id = $2 and f.completion_idempotency_key = $3`,
        [input.leadId, input.followupId, input.idempotencyKey],
      );
      if (replay.rows[0]) return mapFollowup(replay.rows[0]);
      const keyUse = await tx.query('select 1 from lead_followups where completion_idempotency_key = $1', [input.idempotencyKey]);
      if (keyUse.rows.length > 0) throw new DomainRuleError('Idempotency key was already used for a different completion.');
      const updated = await tx.query<{ followup_id: number | string }>(
        `update lead_followups set completed_by = $3, completed_at = now(), completion_idempotency_key = $4
         where lead_id = $1 and followup_id = $2 and completed_at is null returning followup_id`,
        [input.leadId, input.followupId, actorId, input.idempotencyKey],
      );
      if (!updated.rows[0]) throw new DomainRuleError('This follow-up is already complete or no longer exists. Reload the opportunity.');
      const row = await tx.query<FollowupRow>(`${followupSelect} where f.followup_id = $1`, [updated.rows[0].followup_id]);
      if (!row.rows[0]) throw new Error('Completed follow-up was not readable.');
      return mapFollowup(row.rows[0]);
    });
  }
}
