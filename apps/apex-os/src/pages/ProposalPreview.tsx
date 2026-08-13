import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import { CustomerProposalPayloadSchema, ProposalVersionSchema,
  type CustomerProposalPayload, type ProposalVersion } from '@apex/contracts';
import { apiGet, apiSend } from '../api/client';

const money = (cents: number | null) => cents === null ? 'Incomplete' : new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2,
}).format(cents / 100);

export default function ProposalPreview() {
  const { proposalVersionId } = useParams<{ proposalVersionId: string }>();
  const [proposal, setProposal] = useState<ProposalVersion | null>(null);
  const [payload, setPayload] = useState<CustomerProposalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptanceConfirmed, setAcceptanceConfirmed] = useState(false);

  const load = useCallback(async () => {
    if (!proposalVersionId) return;
    try {
      const next = await apiGet(`/api/proposals/${proposalVersionId}`, ProposalVersionSchema);
      setProposal(next); setPayload(CustomerProposalPayloadSchema.parse(next.proposalPayload)); setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Proposal could not be loaded.'); }
  }, [proposalVersionId]);
  useEffect(() => { void load(); }, [load]);

  const copyEmail = async () => {
    if (!payload?.email) return;
    await navigator.clipboard.writeText(`Subject: ${payload.email.subject}\n\n${payload.email.body}`);
    setNotice('Email subject and body copied. Nothing was marked sent.');
  };
  const savePdf = () => {
    setNotice('Your browser print dialog can save this proposal as a PDF. No server PDF is generated.');
    window.print();
  };
  const sign = async () => {
    if (!proposal) return;
    try {
      const result = await apiSend(`/api/proposals/${proposal.proposalVersionId}/sign`, z.strictObject({
        proposal: ProposalVersionSchema, jobId: z.string(), projectId: z.string(),
      }), {
        method: 'POST', body: { expectedVersionNumber: proposal.versionNumber,
          expectedDraftRevision: proposal.draftRevision, customerAcceptanceConfirmed: true },
      });
      setProposal(result.proposal); setNotice('Verified customer acceptance was recorded and one construction project was created.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Proposal could not be signed.'); }
  };

  return (
    <>
      <header className="title-block proposal-title">
        <div><Link className="link-quiet" to="/projects">← Projects</Link><h1>Pool proposal</h1></div>
        {proposal && <div className="stamp">{proposal.status}<b>V{proposal.versionNumber}</b></div>}
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {proposal && payload && (
        <article className="proposal-paper">
          <header><div className="proposal-mark">APEX <span>DESIGNER POOLS</span></div>
            <div><h2>{payload.customer.name ?? 'Customer not recorded'}</h2><p>{payload.customer.address ?? 'Address not recorded'}</p></div></header>
          <div className="proposal-total"><span>Estimated project total</span><b>{money(payload.totalCents)}</b></div>
          <section><h3>Included scope</h3><ul>{payload.scope.map((line) => <li key={line.name}>
            <span>{line.name}</span><span className={`tag ${line.resolved ? 'tag-clear' : 'tag-urgent'}`}>{line.resolved ? 'Resolved' : 'Needs price'}</span>
          </li>)}</ul></section>
          {payload.blockers.length > 0 && <section className="proposal-blockers"><h3>Cannot issue yet</h3>
            {payload.blockers.map((blocker) => <p key={`${blocker.code}-${blocker.lineCode ?? blocker.quantityCode}`}>{blocker.message}</p>)}</section>}
          <footer><span>Takeoff {payload.takeoff.revisionId.slice(-10)}</span><span>Model {payload.takeoff.quantityModelVersion}</span></footer>
        </article>
      )}
      {proposal && payload && <div className="proposal-actions">
        <button className="action" type="button" onClick={savePdf}
          title="Open your browser print dialog to save a PDF">Download / Save PDF</button>
        <button className="action action-quiet" type="button" disabled={!payload.email} onClick={copyEmail}>Copy email</button>
        {payload.email && <a className="action action-quiet" href={`mailto:?subject=${encodeURIComponent(payload.email.subject)}&body=${encodeURIComponent(payload.email.body)}`}>Open email app</a>}
        {proposal.status === 'issued' && <label className="proposal-acceptance"><input type="checkbox" checked={acceptanceConfirmed}
          onChange={(event) => setAcceptanceConfirmed(event.target.checked)} /> I verified the customer accepted this exact issued proposal.</label>}
        {proposal.status === 'issued' && <button className="action action-quiet" type="button" disabled={!acceptanceConfirmed} onClick={sign}>Record verified acceptance & create project</button>}
        {proposal.status === 'signed' && proposal.jobId && <Link className="action action-quiet" to={`/projects/${proposal.jobId}`}>Open project</Link>}
      </div>}
    </>
  );
}
