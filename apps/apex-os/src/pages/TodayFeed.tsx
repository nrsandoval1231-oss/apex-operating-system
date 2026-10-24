import Checklist from '../components/Checklist';
import { Link } from 'react-router';
import {
  CARD_GROUP_TITLE,
  CardGroupSchema,
  type ActionCard,
  type CardGroup,
} from '@apex/contracts';
import { useActionCards, useLeadFollowupsToday, useMe } from '../api/useJobs';
import QueryState from '../components/QueryState';
import { shortId } from '../lib/jobDisplay';

/**
 * The §9.5 action feed — the screen this product exists for.
 *
 * Every card is derived from stored state by @apex/domain. Nothing here is
 * invented, and nothing appears without a reason and a consequence: a feed the
 * owner learns to distrust is worse than no feed at all.
 */

const URGENCY_TAG: Readonly<Record<ActionCard['urgency'], string | null>> = {
  urgent: 'Holding work',
  important: 'Needs a decision',
  routine: null,
};

const GROUP_EMPTY: Readonly<Record<CardGroup, string>> = {
  'needs-you': 'Nothing is waiting on a decision.',
  running: 'No separate running actions. Active project work is tracked in Projects.',
  'this-week': 'Nothing scheduled in the next fortnight.',
};

const today = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function Card({ card }: { card: ActionCard }) {
  const urgent = card.urgency === 'urgent';
  const tag = URGENCY_TAG[card.urgency];

  /*
   * The whole card is the link, not just the action at the bottom.
   *
   * The href was always there; it rendered as the smallest target on the card
   * and everything else was dead, so the feed read as unclickable. The owner
   * asked to "drill all the way down" and the way in was a few characters wide.
   *
   * The visible action stays. It names what this card wants done, which the
   * card body cannot, and it is what somebody reaches for on a phone.
   */
  return (
    <article className={`row settle is-linked ${urgent ? 'is-urgent' : ''} ${card.urgency === 'routine' ? 'is-quiet' : ''}`}>
      <Link to={card.actionHref} className="row-hit" aria-label={card.title} />
      <div className="row-head">
        <div style={{ minWidth: 0 }}>
          <div className="row-who">{card.customerName ?? `Job ${shortId(card.jobId)}`}</div>
          <div className="row-where">{card.location ?? 'Address not recorded'}</div>
        </div>
        {tag !== null && (
          <span className={`tag ${urgent ? 'tag-stamp' : 'tag-urgent'}`}>{tag}</span>
        )}
      </div>

      <h3 className="row-action">{card.title}</h3>
      <p className="row-reason">{card.reason}</p>

      <div className="row-foot">
        <span className="due">{card.dueLabel ?? ''}</span>
        <Link to={card.actionHref} className="action">{card.actionLabel}</Link>
      </div>
    </article>
  );
}

export default function TodayFeed() {
  const { data, error, loading, reload } = useActionCards();
  const me = useMe();
  const canViewOpportunities = me.data !== null && ['admin', 'office'].includes(me.data.role);
  const roleKnownWithoutAccess = me.data !== null && ['field', 'superintendent', 'customer'].includes(me.data.role);
  const precontract = useLeadFollowupsToday(canViewOpportunities);
  const cards = data ?? [];
  const followups = precontract.data ?? [];
  const needsYou = cards.filter((card) => card.group === 'needs-you').length + followups.length;
  const allLoaded = data !== null && !loading && (canViewOpportunities
    ? precontract.data !== null && !precontract.loading
    : roleKnownWithoutAccess);

  return (
    <>
      <header className="title-block">
        <h1>Today</h1>
        {me.data && <p>Welcome, {me.data.displayName.split(' ')[0]}.</p>}
        <div className="stamp">
          {today()}
          {allLoaded && (
            <b>{needsYou === 0 ? 'Operational cards clear' : `${needsYou} operational item${needsYou === 1 ? '' : 's'}`}</b>
          )}
        </div>
      </header>

      <Checklist compact />

      <QueryState
        loading={loading}
        error={error}
        isEmpty={cards.length === 0 && precontract.data?.length === 0 && precontract.error === null}
        emptyTitle="Nothing needs attention"
        emptyBody="Construction cards appear when a gate, draw, or project record needs a decision. Pre-contract follow-ups are listed separately above."
        onRetry={reload}
      />

      {precontract.error && <p className="error" role="alert">Pre-contract coverage could not be loaded. Construction cards below remain available. {precontract.error.message}</p>}
      {me.error && <p className="error" role="alert">Your staff role could not be loaded, so opportunity follow-up coverage is unavailable.</p>}
      {roleKnownWithoutAccess && <p className="state-quiet">Pre-contract opportunity follow-ups are available to admin and office staff.</p>}
      {precontract.loading && <p className="state-quiet" aria-live="polite">Loading opportunity follow-ups…</p>}
      {precontract.data !== null && <section aria-label="Pre-contract opportunity follow-ups">
        <div className="section-rule"><h2>Opportunity follow-ups</h2>{followups.length > 0 && <span className="count">{followups.length}</span>}</div>
        {followups.length === 0 ? <p className="state-quiet">No due or missing next actions on open opportunities.</p> : followups.map((item) => {
          const title = item.kind === 'overdue' ? 'Overdue follow-up' : item.kind === 'due-today' ? 'Follow-up due today' : 'Set the next action';
          const reason = item.kind === 'missing-next-action'
            ? item.proposalState === 'issued' ? 'A Proposal has been issued. Record the next action; this does not imply customer contact.' : 'This open opportunity has no recorded next action.'
            : item.nextAction ?? 'Follow-up action';
          return <article className={`row settle ${item.kind === 'overdue' ? 'is-urgent' : ''}`} key={item.leadId}>
            <div className="row-head"><div><div className="row-who">{item.customerName ?? item.leadId}</div><div className="row-where">{item.addressLine}</div></div><span className="tag tag-urgent">{title}</span></div>
            <h3 className="row-action">{reason}</h3>
            <div className="row-foot"><span className="due">{item.dueDate ?? ''}{item.assignedUserName ? ` · ${item.assignedUserName}` : ''}</span><Link className="action" to={`/opportunities/${item.leadId}`}>Open opportunity</Link></div>
          </article>;
        })}
      </section>}

      {cards.length > 0 && CardGroupSchema.options.map((group) => {
        const inGroup = cards.filter((card) => card.group === group);
        return (
          <section key={group}>
            <div className="section-rule">
              <h2>{CARD_GROUP_TITLE[group]}</h2>
              {inGroup.length > 0 && <span className="count">{inGroup.length}</span>}
            </div>
            {inGroup.length === 0
              ? <p className="state-quiet">{GROUP_EMPTY[group]}</p>
              : inGroup.map((card) => <Card key={card.cardId} card={card} />)}
          </section>
        );
      })}
    </>
  );
}
