import { Link } from 'react-router';
import type { BriefItem } from '@apex/contracts';
import { useDailyBrief } from '../api/useJobs';
import QueryState from '../components/QueryState';
import { formatContract, shortId } from '../lib/jobDisplay';

/**
 * The daily owner brief — PRD §9.14.
 *
 * A view over the same action cards the Today screen renders. The brief is
 * generated once each morning and then frozen, which is what lets it say what
 * changed since yesterday; Today stays live. Nothing is derived independently
 * here, so the two screens cannot disagree about what needs doing.
 */

const readableDate = (day: string): string => {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed)) return day;
  return new Date(parsed).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
};

const standingLabel = (days: number): string =>
  days === 1 ? 'New today' : `Standing ${days} days`;

function Item({ item }: { item: BriefItem }) {
  const { card } = item;
  return (
    <li>
      <div style={{ minWidth: 0 }}>
        <div className="what">{card.title}</div>
        <div className="note">
          {card.customerName ?? `Job ${shortId(card.jobId)}`}
          {' · '}
          {standingLabel(item.standingDays)}
          {card.dueLabel === null ? '' : ` · ${card.dueLabel}`}
        </div>
      </div>
      <div className="figure">
        <Link to={card.actionHref} className="action">Open</Link>
      </div>
    </li>
  );
}

function Section({ title, items, empty }: { title: string; items: readonly BriefItem[]; empty: string }) {
  return (
    <>
      <div className="section-rule">
        <h2>{title}</h2>
        {items.length > 0 && <span className="count">{items.length}</span>}
      </div>
      {items.length === 0
        ? <p className="state-quiet">{empty}</p>
        : <ul className="schedule">{items.map((item) => <Item key={item.card.cardId} item={item} />)}</ul>}
    </>
  );
}

export default function OwnerBrief() {
  const { data: brief, error, loading, reload } = useDailyBrief();

  if (brief === null) {
    return (
      <>
        <header className="title-block"><h1>Brief</h1></header>
        <QueryState
          loading={loading} error={error} isEmpty={false}
          emptyTitle="" emptyBody="" onRetry={reload}
        />
      </>
    );
  }

  const needs = brief.needsYou.length;
  const quiet = needs === 0 && brief.running.length === 0 && brief.thisWeek.length === 0;
  const first = brief.previousBriefDate === null;

  return (
    <>
      <header className="title-block">
        <h1>Brief</h1>
        <div className="stamp">
          {readableDate(brief.briefDate)}
          <b>{needs === 0 ? 'Nothing needs you' : `${needs} need${needs === 1 ? 's' : ''} you`}</b>
        </div>
      </header>

      <dl className="totals">
        <div style={{ display: 'contents' }} className="lead">
          <dt>Ready to bill</dt>
          <dd>{formatContract(brief.readyToBillCents)}</dd>
        </div>
        <dt>New</dt>
        <dd>{first ? 'First brief' : brief.newSinceLast.length}</dd>
        <dt>Cleared</dt>
        <dd>{first ? '—' : brief.cleared.length}</dd>
        <dt>Since</dt>
        <dd>{brief.previousBriefDate ?? 'nothing yet'}</dd>
      </dl>

      {quiet && (
        <div className="state">
          <h3>All clear</h3>
          <p>No gate, draw, or project record needs a decision this morning.</p>
        </div>
      )}

      {brief.newSinceLast.length > 0 && (
        <Section
          title={`New since ${brief.previousBriefDate ?? 'the last brief'}`}
          items={brief.newSinceLast}
          empty=""
        />
      )}

      {brief.cleared.length > 0 && (
        <>
          <div className="section-rule">
            <h2>Cleared since then</h2>
            <span className="count">{brief.cleared.length}</span>
          </div>
          <ul className="schedule">
            {brief.cleared.map((item) => (
              <li key={item.cardId}>
                <div style={{ minWidth: 0 }}>
                  <div className="what">{item.title}</div>
                  <div className="note">{item.customerName ?? 'Resolved'}</div>
                </div>
                <div className="figure"><span className="tag tag-clear">Done</span></div>
              </li>
            ))}
          </ul>
        </>
      )}

      {!quiet && (
        <>
          <Section title="Things need you" items={brief.needsYou} empty="Nothing is waiting on a decision." />
          <Section title="Running" items={brief.running} empty="No work in progress to check." />
          <Section title="This week" items={brief.thisWeek} empty="Nothing scheduled in the next fortnight." />
        </>
      )}

      {/* Named rather than omitted: a brief silently missing four of its nine
          PRD sections reads as "all clear" on subjects it never checked. */}
      <div className="section-rule"><h2>Not covered yet</h2></div>
      <dl className="facts">
        {brief.notCovered.map((subject) => (
          <div key={subject} style={{ display: 'contents' }}>
            <dt>{subject}</dt>
            <dd className="unset">Not built</dd>
          </div>
        ))}
      </dl>

      <p className="notice">
        Generated {new Date(brief.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        {' '}and frozen for the day. Today stays live if you want the current picture.
      </p>
    </>
  );
}
