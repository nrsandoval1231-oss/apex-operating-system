import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { LeadFollowupSchema } from '@apex/contracts';
import { useMe, useOpportunityWork } from '../api/useJobs';
import { ApiError, apiSend } from '../api/client';
import QueryState from '../components/QueryState';

const civilToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function OpportunityWorkPage() {
  const { leadId } = useParams();
  const work = useOpportunityWork(leadId);
  const me = useMe();
  const [nextAction, setNextAction] = useState('');
  const [dueDate, setDueDate] = useState(civilToday);
  const [assignedUserId, setAssignedUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeLead = useRef(leadId);
  useEffect(() => {
    activeLead.current = leadId;
    setNextAction(''); setDueDate(civilToday()); setAssignedUserId(''); setError(null); setSaving(false);
  }, [leadId]);
  const record = work.data;
  const open = record?.followups.find((item) => item.completedAt === null);

  const schedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!leadId) return;
    const assignee = assignedUserId || me.data?.userId;
    if (!assignee) { setError('Load your staff account before scheduling a follow-up.'); return; }
    setSaving(true);
    setError(null);
    const requestedLead = leadId;
    try {
      await apiSend(`/api/opportunities/${leadId}/followups`, LeadFollowupSchema, {
        method: 'POST', body: { nextAction, dueDate, assignedUserId: assignee },
      });
      if (activeLead.current === requestedLead) { setNextAction(''); work.reload(); }
    } catch (cause) {
      if (activeLead.current === requestedLead) setError(cause instanceof ApiError ? cause.message : 'Could not save the follow-up.');
    } finally { if (activeLead.current === requestedLead) setSaving(false); }
  };

  const complete = async () => {
    if (!leadId || !open) return;
    setSaving(true);
    setError(null);
    const requestedLead = leadId;
    try {
      await apiSend(`/api/opportunities/${leadId}/followups/${open.followupId}/complete`, LeadFollowupSchema, { method: 'POST', body: {} });
      if (activeLead.current === requestedLead) work.reload();
    } catch (cause) {
      if (activeLead.current === requestedLead) setError(cause instanceof ApiError ? cause.message : 'Could not complete the follow-up.');
    } finally { if (activeLead.current === requestedLead) setSaving(false); }
  };

  return <>
    <header className="title-block"><h1>Opportunity</h1><div className="stamp"><Link to="/today">Back to Today</Link></div></header>
    <QueryState loading={work.loading || record?.leadId !== leadId} error={work.error} isEmpty={record === null || record.leadId !== leadId} emptyTitle="Opportunity unavailable" emptyBody="This opportunity could not be loaded." onRetry={work.reload} />
    {record && record.leadId === leadId && <>
      <section className="row settle">
        <div className="row-head"><div><div className="row-who">{record.customerName ?? record.leadId}</div><div className="row-where">{record.addressLine}</div></div><span className="tag">{record.leadStatus}</span></div>
        {record.proposalState && <p>Latest Proposal: {record.proposalState}. An issued Proposal records issuance only; it does not show that the customer was contacted.</p>}
      </section>
      <section>
        <div className="section-rule"><h2>Next action</h2></div>
        {open && <article className="row settle">
          <p><strong>{open.nextAction}</strong></p><p>Due {open.dueDate} · assigned to {open.assignedUserName}</p>
          <button type="button" disabled={saving} onClick={complete}>Mark complete</button>
        </article>}
        {record.leadStatus === 'accepted' || record.leadStatus === 'qualified' || record.leadStatus === 'proposal' ? <form className="row settle" onSubmit={schedule}>
          <label>Next action<input required maxLength={1000} value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label>
          <label>Due date<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label>Accountable office user<select required value={assignedUserId || record.assignees.find((user) => user.userId === me.data?.userId)?.userId || record.assignees[0]?.userId || ''} onChange={(event) => setAssignedUserId(event.target.value)}>
            {record.assignees.map((user) => <option key={user.userId} value={user.userId}>{user.displayName}</option>)}
          </select></label>
          {open && <p>Saving a replacement completes the current action and retains it in history.</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={saving || !me.data}>Schedule next action</button>
        </form> : <p>This opportunity is closed to pre-contract follow-ups.</p>}
      </section>
      <section>
        <div className="section-rule"><h2>Follow-up history</h2></div>
        {record.followups.length === 0 ? <p className="state-quiet">No follow-up has been recorded.</p> : record.followups.map((item) => <article className="row settle" key={item.followupId}>
          <p><strong>{item.nextAction}</strong></p><p>Due {item.dueDate} · assigned to {item.assignedUserName}</p>
          <p>{item.completedAt ? `Completed ${item.completedAt.slice(0, 10)}` : 'Open'}</p>
        </article>)}
      </section>
    </>}
  </>;
}
