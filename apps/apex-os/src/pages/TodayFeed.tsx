import { Link } from 'react-router';
import {
  CARD_GROUP_TITLE,
  CardGroupSchema,
  type ActionCard,
  type CardGroup,
} from '@apex/contracts';
import { useActionCards } from '../api/useJobs';
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
  const cards = data ?? [];
  const needsYou = cards.filter((card) => card.group === 'needs-you').length;

  return (
    <>
      <header className="title-block">
        <h1>Today</h1>
        <div className="stamp">
          {today()}
          {data !== null && (
            <b>{needsYou === 0 ? 'All clear' : `${needsYou} need${needsYou === 1 ? 's' : ''} you`}</b>
          )}
        </div>
      </header>

      <QueryState
        loading={loading}
        error={error}
        isEmpty={cards.length === 0}
        emptyTitle="Nothing needs attention"
        emptyBody="Every active job is clear. Cards appear here when a gate, a draw, or a project record needs a decision."
        onRetry={reload}
      />

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
