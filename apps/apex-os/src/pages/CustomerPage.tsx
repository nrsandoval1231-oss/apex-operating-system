import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  CustomerLinkStatusSchema,
  IssuedCustomerLinkSchema,
  JobPhotoSchema,
  StaffCustomerDecisionSchema,
  type IssuedCustomerLink,
  type JobPhoto,
} from '@apex/contracts';
import { ApiError, apiSend } from '../api/client';
import { useCustomerLink, useJob, useJobDecisions, useJobPhotos } from '../api/useJobs';
import InlineForm from '../components/InlineForm';
import QueryState from '../components/QueryState';
import { jobTitle } from '../lib/jobDisplay';

/**
 * Customer page controls — PRD §9.11.
 *
 * This screen is where staff decide what a person outside Apex can see. Two
 * things shape it:
 *
 *   · The token is shown exactly once. When a link is issued or rotated, the URL
 *     appears here and nowhere else, ever again. The screen says so plainly
 *     rather than letting someone assume they can come back for it.
 *   · Nothing here is a toggle you can flip by accident. Publishing a photo is
 *     an explicit act with a caption written for the customer, because the
 *     internal caption on a gate photo may name a subcontractor or quote a
 *     checklist item.
 */

const dateTime = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const readable = (iso: string): string => dateTime.format(new Date(iso));

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const job = useJob(id);
  const link = useCustomerLink(id);
  const photos = useJobPhotos(id);
  const decisions = useJobDecisions(id);

  /** The token, held only until this screen is left. It is not stored. */
  const [issued, setIssued] = useState<IssuedCustomerLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Which question is currently being asked, and of what.
   *
   * One open form at a time: every one of these writes something a customer
   * either sees or is judged by, and two half-filled forms on screen is how the
   * wrong caption ends up on the wrong photo.
   */
  const [asking, setAsking] = useState<
    | { kind: 'rotate' | 'revoke' | 'raise' }
    | { kind: 'publish'; photo: JobPhoto }
    | { kind: 'resolve'; decisionId: string; answered: boolean }
    | null
  >(null);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setAsking(null);
    } catch (cause) {
      // The form stays open with what was typed still in it. Losing a written
      // answer because the request failed would be its own small betrayal.
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, []);

  const status = link.data;
  const active = status?.active ?? null;

  const issue = () => run(async () => {
    setIssued(await apiSend(`/api/jobs/${id}/customer-link`, IssuedCustomerLinkSchema, { method: 'POST' }));
    link.reload();
  });

  const rotate = (values: Readonly<Record<string, string>>) => run(async () => {
    setIssued(await apiSend(`/api/jobs/${id}/customer-link/rotate`, IssuedCustomerLinkSchema, {
      method: 'POST',
      body: values['reason'] ? { reason: values['reason'] } : {},
    }));
    link.reload();
  });

  const revoke = (values: Readonly<Record<string, string>>) => run(async () => {
    await apiSend(`/api/jobs/${id}/customer-link`, CustomerLinkStatusSchema, {
      method: 'DELETE',
      body: values['reason'] ? { reason: values['reason'] } : {},
    });
    setIssued(null);
    link.reload();
  });

  const publish = (photo: JobPhoto, values: Readonly<Record<string, string>>) => run(async () => {
    // The caption is asked for at the moment of publishing rather than left to
    // a second step somebody forgets. Leaving it blank publishes the photo with
    // no caption — never with the internal one.
    await apiSend(`/api/evidence/${photo.evidenceId}/visibility`, JobPhotoSchema, {
      method: 'POST',
      body: { visible: true, ...(values['caption'] ? { caption: values['caption'] } : {}) },
    });
    photos.reload();
  });

  const takeDown = (photo: JobPhoto) => run(async () => {
    await apiSend(`/api/evidence/${photo.evidenceId}/visibility`, JobPhotoSchema, {
      method: 'POST',
      body: { visible: false },
    });
    photos.reload();
  });

  const raiseDecision = (values: Readonly<Record<string, string>>) => run(async () => {
    const neededBy = values['neededBy'] ?? '';
    await apiSend(`/api/jobs/${id}/decisions`, StaffCustomerDecisionSchema, {
      method: 'POST',
      body: {
        title: values['title'],
        detail: values['detail'],
        consequence: values['consequence'],
        ...(/^\d{4}-\d{2}-\d{2}$/.test(neededBy) ? { neededBy } : {}),
      },
    });
    decisions.reload();
  });

  const resolveDecision = (
    decisionId: string,
    answered: boolean,
    values: Readonly<Record<string, string>>,
  ) => run(async () => {
    await apiSend(`/api/decisions/${decisionId}/resolve`, StaffCustomerDecisionSchema, {
      method: 'POST',
      body: {
        status: answered ? 'answered' : 'withdrawn',
        ...(values['note'] ? { answerNote: values['note'] } : {}),
      },
    });
    decisions.reload();
  });

  const published = (photos.data ?? []).filter((photo) => photo.customerVisible);
  const openDecisions = (decisions.data ?? []).filter((decision) => decision.status === 'open');

  return (
    <>
      <header className="title-block">
        <div style={{ minWidth: 0 }}>
          <Link
            to={`/projects/${id}`}
            className="link-quiet"
            style={{ display: 'inline-block', marginBottom: '10px' }}
          >
            ← Project
          </Link>
          <h1>Customer page</h1>
        </div>
        <div className="stamp">
          {job.data === null ? 'Loading' : jobTitle(job.data)}
          <b>{active === null ? 'No link' : `${active.pageViews} view${active.pageViews === 1 ? '' : 's'}`}</b>
        </div>
      </header>

      {error !== null && <p className="notice" role="alert" style={{ color: 'var(--amber)' }}>{error}</p>}

      {/* ------------------------------------------------------------- link */}

      <div className="section-rule"><h2>The link</h2></div>

      <QueryState
        loading={link.loading}
        error={link.error}
        isEmpty={false}
        emptyTitle=""
        emptyBody=""
        onRetry={link.reload}
        quiet
      />

      {issued !== null && (
        <div className="state" style={{ borderColor: 'var(--sage)' }}>
          <h3>Send this to the customer now</h3>
          <p className="mono" style={{ wordBreak: 'break-all', color: 'var(--ink)' }}>
            {/* Absolute once a public origin is configured; a path before that,
                which only means anything alongside the warning below. */}
            {issued.publiclyReachable ? issued.url : `${window.location.origin}${issued.url}`}
          </p>
          <p>
            {/* Said plainly, because the alternative is someone closing this tab
                and assuming they can find it again. */}
            This is the only time this link will be shown. Apex OS stores a hash of it,
            not the link itself. If it is lost, rotate to issue a new one.
          </p>
          <button
            type="button"
            className="action action-quiet"
            onClick={() => void navigator.clipboard?.writeText(
              issued.publiclyReachable ? issued.url : `${window.location.origin}${issued.url}`,
            )}
          >
            Copy link
          </button>
        </div>
      )}

      {status !== undefined && status !== null && (
        <>
          <dl className="facts">
            <dt>Status</dt>
            <dd className={active === null ? 'unset' : ''}>
              {active === null ? 'No live link — the customer cannot see anything' : 'Live'}
            </dd>
            <dt>Issued</dt>
            <dd className={active === null ? 'unset' : ''}>
              {active === null ? '—' : `${readable(active.issuedAt)}${active.issuedByName === null ? '' : ` by ${active.issuedByName}`}`}
            </dd>
            <dt>Last opened</dt>
            <dd className={active?.lastViewedAt == null ? 'unset' : ''}>
              {active?.lastViewedAt == null ? 'Never opened' : readable(active.lastViewedAt)}
            </dd>
          </dl>

          {asking?.kind === 'rotate' && (
            <InlineForm
              title="Replace this link"
              note="The link the customer already has stops working the moment this is done. They will need the new one."
              fields={[{ name: 'reason', label: 'Why', placeholder: 'Forwarded to someone outside the household', multiline: true }]}
              submitLabel="Rotate the link"
              busy={busy}
              onSubmit={rotate}
              onCancel={() => setAsking(null)}
            />
          )}

          {asking?.kind === 'revoke' && (
            <InlineForm
              title="Close this link"
              note="The customer loses their page immediately and gets nothing in its place until a new link is issued."
              fields={[{ name: 'reason', label: 'Why', placeholder: 'Project cancelled', multiline: true }]}
              submitLabel="Revoke the link"
              busy={busy}
              onSubmit={revoke}
              onCancel={() => setAsking(null)}
            />
          )}

          {asking === null && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
              {active === null ? (
                <button type="button" className="action action-solid" disabled={busy} onClick={issue}>
                  Issue the link
                </button>
              ) : (
                <>
                  <button type="button" className="action" disabled={busy} onClick={() => setAsking({ kind: 'rotate' })}>
                    Rotate
                  </button>
                  <button type="button" className="action action-quiet" disabled={busy} onClick={() => setAsking({ kind: 'revoke' })}>
                    Revoke
                  </button>
                </>
              )}
            </div>
          )}

          {/* Said only when it is true. The warning existed because a link
              copied from a laptop reaches nobody; once a public origin is
              configured it would be false, and a stale warning teaches people
              to ignore the real ones. */}
          {issued !== null && !issued.publiclyReachable && (
            <p className="notice">
              This link only works on this machine. Sending it to a customer would give
              them something that opens nothing. A customer-reachable link needs
              APEX_PUBLIC_ORIGIN set in a deployed environment.
            </p>
          )}
        </>
      )}

      {/* --------------------------------------------------------- accesses */}

      {status != null && status.recentAccesses.length > 0 && (
        <>
          <div className="section-rule">
            <h2>Reads</h2>
            <span className="count">{status.recentAccesses.length} recorded</span>
          </div>
          <ul className="schedule">
            {status.recentAccesses.slice(0, 20).map((access, index) => (
              <li key={`${access.occurredAt}-${index}`}>
                <div style={{ minWidth: 0 }}>
                  <div className="what">{readable(access.occurredAt)}</div>
                  <div className="note">
                    {[
                      access.resource === 'page' ? 'Opened the page' : 'Loaded a photo',
                      access.ipPrefix ?? 'Network not recorded',
                    ].join(' · ')}
                  </div>
                </div>
                <div className="figure">
                  <span className={`tag ${access.outcome === 'served' ? 'tag-dim' : 'tag-urgent'}`}>
                    {access.outcome === 'served' ? 'Served' : 'Revoked link'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ---------------------------------------------------------- photos */}

      <div className="section-rule">
        <h2>Photos</h2>
        <span className="count">{published.length} of {(photos.data ?? []).length} published</span>
      </div>

      <QueryState
        loading={photos.loading}
        error={photos.error}
        isEmpty={(photos.data ?? []).length === 0}
        emptyTitle="No photos"
        emptyBody="No gate photos have been captured on this job yet."
        onRetry={photos.reload}
        quiet
      />

      {asking?.kind === 'publish' && (
        <InlineForm
          title={`Publish this photo — ${asking.photo.requirementKey}`}
          note="Write the caption for the customer. The internal caption is never shown to them, and leaving this blank publishes the photo with no caption at all."
          fields={[{
            name: 'caption',
            label: 'Caption the customer sees',
            placeholder: 'Steel is in and inspected',
            ...(asking.photo.customerCaption !== null ? { initial: asking.photo.customerCaption } : {}),
          }]}
          submitLabel="Publish"
          busy={busy}
          onSubmit={(values) => publish((asking as { photo: JobPhoto }).photo, values)}
          onCancel={() => setAsking(null)}
        />
      )}

      {(photos.data ?? []).length > 0 && (
        <ul className="schedule">
          {(photos.data ?? []).map((photo) => (
            <li key={photo.evidenceId}>
              <div style={{ minWidth: 0 }}>
                <div className="what">{photo.gateTitle}</div>
                <div className="note">
                  {[photo.requirementKey, readable(photo.capturedAt)].join(' · ')}
                </div>
                {/* Shown so whoever publishes can see what they would be
                    publishing under. The customer never sees this line. */}
                {photo.internalCaption !== null && (
                  <div className="note" style={{ marginTop: '4px' }}>
                    Internal: {photo.internalCaption}
                  </div>
                )}
                {photo.customerVisible && (
                  <div className="note" style={{ marginTop: '4px', color: 'var(--sage)' }}>
                    Customer sees: {photo.customerCaption ?? 'no caption'}
                  </div>
                )}
              </div>
              <div className="figure">
                <button
                  type="button"
                  className={`action ${photo.customerVisible ? 'action-quiet' : ''}`}
                  disabled={busy}
                  onClick={() => (photo.customerVisible
                    ? takeDown(photo)
                    : setAsking({ kind: 'publish', photo }))}
                >
                  {photo.customerVisible ? 'Take down' : 'Publish'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------------------------------- decisions */}

      <div className="section-rule">
        <h2>Decisions</h2>
        <span className="count">{openDecisions.length} open</span>
      </div>

      <QueryState
        loading={decisions.loading}
        error={decisions.error}
        isEmpty={(decisions.data ?? []).length === 0}
        emptyTitle="Nothing pending"
        emptyBody="Apex is not waiting on the customer for anything."
        onRetry={decisions.reload}
        quiet
      />

      {(decisions.data ?? []).length > 0 && (
        <ul className="schedule">
          {(decisions.data ?? []).map((decision) => (
            <li key={decision.decisionId}>
              <div style={{ minWidth: 0 }}>
                <div className="what">{decision.title}</div>
                <div className="note">{decision.detail}</div>
                <div className="note" style={{ marginTop: '4px' }}>{decision.consequence}</div>
                {decision.neededBy !== null && (
                  <div className="note" style={{ marginTop: '4px' }}>Needed by {decision.neededBy}</div>
                )}
                {decision.answerNote !== null && (
                  <div className="note" style={{ marginTop: '4px', color: 'var(--sage)' }}>
                    Answer: {decision.answerNote}
                  </div>
                )}
              </div>
              <div className="figure">
                {decision.status === 'open' ? (
                  <>
                    <button
                      type="button"
                      className="action"
                      disabled={busy}
                      onClick={() => setAsking({ kind: 'resolve', decisionId: decision.decisionId, answered: true })}
                    >
                      Record answer
                    </button>
                    <button
                      type="button"
                      className="action action-quiet"
                      style={{ marginTop: '6px' }}
                      disabled={busy}
                      onClick={() => setAsking({ kind: 'resolve', decisionId: decision.decisionId, answered: false })}
                    >
                      Withdraw
                    </button>
                  </>
                ) : (
                  <span className={`tag ${decision.status === 'answered' ? 'tag-clear' : 'tag-dim'}`}>
                    {decision.status === 'answered' ? 'Answered' : 'Withdrawn'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {asking?.kind === 'resolve' && (
        <InlineForm
          title={asking.answered ? 'Record the customer’s answer' : 'Withdraw this question'}
          note={asking.answered
            ? 'Write down what they actually said. This becomes the record that they chose it, so it is worth being specific.'
            : 'Say why Apex no longer needs an answer. The question disappears from the customer’s page either way.'}
          fields={[{
            name: 'note',
            label: asking.answered ? 'What the customer said' : 'Why',
            required: asking.answered,
            multiline: true,
            placeholder: asking.answered ? 'Chose the sage 1×1 glass on the phone, confirmed by text' : '',
          }]}
          submitLabel={asking.answered ? 'Record the answer' : 'Withdraw'}
          busy={busy}
          onSubmit={(values) => resolveDecision(
            (asking as { decisionId: string }).decisionId,
            (asking as { answered: boolean }).answered,
            values,
          )}
          onCancel={() => setAsking(null)}
        />
      )}

      {asking?.kind === 'raise' ? (
        <InlineForm
          title="Ask the customer for something"
          note="Every word here is shown to the customer exactly as written. No costs, no subcontractor names, no internal shorthand."
          fields={[
            { name: 'title', label: 'What you need', required: true, placeholder: 'Waterline tile' },
            {
              name: 'detail',
              label: 'Explain it in their words',
              required: true,
              multiline: true,
              placeholder: 'Three samples are at the office for you to look at.',
            },
            {
              name: 'consequence',
              label: 'What waits on it',
              required: true,
              multiline: true,
              placeholder: 'Tile goes on after the shell cures; without a choice the crew has nothing to set.',
            },
            { name: 'neededBy', label: 'Needed by (YYYY-MM-DD)', placeholder: '2026-08-12' },
          ]}
          submitLabel="Put it on their page"
          busy={busy}
          onSubmit={raiseDecision}
          onCancel={() => setAsking(null)}
        />
      ) : (
        <div style={{ marginTop: '16px' }}>
          <button type="button" className="action" disabled={busy} onClick={() => setAsking({ kind: 'raise' })}>
            Ask the customer for something
          </button>
        </div>
      )}

      <p className="notice">
        The customer page takes no input. An answer arrives by phone or text and is
        written down here, because a selection submitted from a link with no login is
        not evidence that the customer made it.
      </p>
    </>
  );
}
