import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import {
  DesignerTakeoffSubmissionSchema,
  FinishEstimateResultSchema,
  type DesignerTakeoffSubmission,
  type FinishEstimateResult,
} from '@apex/contracts';
import { apiSend } from '../api/client';
import { buildOrderWorkbook } from '../lib/xlsx';
import { MEASURED_LINE_DEFINITIONS } from '@apex/pricing-engine';

const directDefinitions = [
  [300, 'Pool Equipment'], [500, 'Utilities - Plumber & Electrician'], [600, 'Lights'],
  [900, 'Cover'], [1100, 'Water Features'], [1200, 'Automation'], [1300, 'Additional Upgrades'],
] as const;

export default function FinishEstimate({ leadId }: { leadId: string }) {
  const [submission, setSubmission] = useState<DesignerTakeoffSubmission | null>(null);
  const [fileName, setFileName] = useState('');
  const [feePercent, setFeePercent] = useState('');
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [measuredAmounts, setMeasuredAmounts] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<FinishEstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const readHandoff = (raw: string | null): { type?: string; submission?: unknown; fileName?: string; leadId?: string } | null => {
      if (!raw) return null;
      try { return JSON.parse(raw) as { submission?: unknown; fileName?: string; leadId?: string }; } catch { return null; }
    };
    const named = readHandoff(window.name);
    const stored = sessionStorage.getItem(`apex-estimate-submission:${leadId}`);
    const handoff = named?.type === 'apex-estimate-handoff' && named.leadId === leadId
      ? named
      : readHandoff(stored);
    if (!handoff) return;
    try {
      const parsed = DesignerTakeoffSubmissionSchema.parse(handoff.submission);
      setSubmission(parsed);
      setFileName(handoff.fileName ?? 'Designer takeoff');
      if (named?.leadId === leadId) window.name = '';
    } catch {
      sessionStorage.removeItem(`apex-estimate-submission:${leadId}`);
      if (named?.leadId === leadId) window.name = '';
    }
  }, [leadId]);

  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = DesignerTakeoffSubmissionSchema.parse(JSON.parse(await file.text()));
      setSubmission(parsed); setFileName(file.name); setResult(null);
    } catch { setError('Choose an unmodified Apex Designer takeoff export.'); }
  };

  const finish = async () => {
    if (!submission) return setError('Choose the approved Designer takeoff first.');
    const percent = Number(feePercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return setError('Enter the approved fee from 0% through 100%.');
    setBusy(true); setError(null);
    try {
      const directLines = directDefinitions.map(([code, name]) => {
        const amount = Number(amounts[code]);
        if (excluded[code]) return { code, name, scopeStatus: 'not-applicable' as const,
          amountCents: null, basis: 'Explicitly excluded by the estimator.' };
        if (amounts[code]?.trim() && Number.isFinite(amount) && amount > 0) return {
          code, name, scopeStatus: 'quoted' as const, amountCents: Math.round(amount * 100),
          basis: 'Quote entered by the authenticated estimator.',
        };
        return { code, name, scopeStatus: 'unresolved' as const, amountCents: null,
          basis: 'No quote or exclusion recorded.' };
      });
      const measuredLines = MEASURED_LINE_DEFINITIONS.map(([id, , name]) => {
        const amount = Number(measuredAmounts[id]);
        return {
          id, amountCents: measuredAmounts[id]?.trim() && Number.isFinite(amount) && amount >= 0
            ? Math.round(amount * 100) : null,
          basis: measuredAmounts[id]?.trim()
            ? 'Approved estimate entered by the authenticated estimator.'
            : `No approved estimate recorded for ${name}.`,
        };
      });
      let next: FinishEstimateResult;
      if (result?.proposal.status === 'draft') {
        const updated = await apiSend(`/api/proposals/${result.proposal.proposalVersionId}/draft`,
          FinishEstimateResultSchema.shape.proposal, { method: 'POST', body: {
            expectedVersionNumber: result.proposal.versionNumber,
            expectedDraftRevision: result.proposal.draftRevision,
            directLines, measuredLines, feeRateBps: Math.round(percent * 100),
          } });
        const payload = updated.proposalPayload;
        const blockers = Array.isArray(payload['blockers']) ? payload['blockers'] : [];
        next = { ...result, proposal: updated, blockers: FinishEstimateResultSchema.shape.blockers.parse(blockers) };
        if (next.blockers.length === 0) {
          const issued = await apiSend(`/api/proposals/${updated.proposalVersionId}/issue`,
            FinishEstimateResultSchema.shape.proposal, { method: 'POST', body: {
              expectedVersionNumber: updated.versionNumber, expectedDraftRevision: updated.draftRevision,
            } });
          next = { ...next, proposal: issued };
        }
      } else {
        next = await apiSend(`/api/opportunities/${leadId}/finish-estimate`, FinishEstimateResultSchema, {
          method: 'POST', body: { submission, directLines, measuredLines, feeRateBps: Math.round(percent * 100) },
        });
      }
      setResult(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Estimate could not be finished.'); }
    finally { setBusy(false); }
  };

  const downloadWorkbook = () => {
    if (!result) return;
    const bytes = buildOrderWorkbook(result.workbook);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `apex-order-${result.takeoff.revisionNumber}.xlsx`; anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="estimate-sheet">
      <div className="section-rule"><h2>Approved takeoff</h2></div>
      <label className="action action-quiet file-action">
        {fileName || 'Choose Designer export'}
        <input type="file" accept="application/json,.json" onChange={load} />
      </label>

      <div className="section-rule"><h2>Pricing decisions</h2></div>
      <label className="estimate-fee">Approved fee %
        <input inputMode="decimal" value={feePercent} onChange={(event) => setFeePercent(event.target.value)} placeholder="Not recorded" />
      </label>
      <div className="estimate-lines">
        {MEASURED_LINE_DEFINITIONS.map(([id, , name, quantityCode, unit]) => (
          <div className="estimate-line" key={id}>
            <div><b>{name}</b><span>{quantityCode} · {unit}</span></div>
            <label>Approved estimate $<input inputMode="decimal" value={measuredAmounts[id] ?? ''}
              onChange={(event) => setMeasuredAmounts((current) => ({ ...current, [id]: event.target.value }))} /></label>
          </div>
        ))}
        {directDefinitions.map(([code, name]) => (
          <div className="estimate-line" key={code}>
            <div><b>{name}</b><span>{code}</span></div>
            <label>Quote $<input inputMode="decimal" value={amounts[code] ?? ''}
              disabled={excluded[code] === true}
              onChange={(event) => setAmounts((current) => ({ ...current, [code]: event.target.value }))} /></label>
            <label className="estimate-na"><input type="checkbox" checked={excluded[code] === true}
              onChange={(event) => setExcluded((current) => ({ ...current, [code]: event.target.checked }))} /> Not applicable</label>
          </div>
        ))}
      </div>
      <button type="button" className="action" disabled={busy} onClick={finish}>{busy ? 'Finishing…' : 'Finish estimate'}</button>
      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="estimate-complete" aria-live="polite">
          <div className={`tag ${result.blockers.length ? 'tag-urgent' : 'tag-clear'}`}>
            {result.blockers.length ? 'Pricing incomplete' : 'Proposal ready'}
          </div>
          {result.blockers.map((blocker) => <p key={`${blocker.code}-${blocker.lineCode ?? blocker.quantityCode}`}>{blocker.message}</p>)}
          <div className="estimate-actions">
            <Link className="action" to={`/proposals/${result.proposal.proposalVersionId}`}>Preview proposal</Link>
            <button type="button" className="action action-quiet" onClick={downloadWorkbook}>Download order workbook</button>
          </div>
        </div>
      )}
    </section>
  );
}
