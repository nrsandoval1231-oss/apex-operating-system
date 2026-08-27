/**
 * Structure section. Three states, and two of them show no numbers at all:
 * no detail stored, no detail covering this job, or quantities.
 */

import type { StructureResult } from '../engine/structure.ts';
import type { EnvelopeMatch } from '../engine/standardDetail.ts';
import { CalcTable } from './CalcTable.tsx';
import { num, num1 } from './format.ts';

export function StructureSection({ structure }: { structure: StructureResult }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>3 · Structure takeoff</h2>
        <span className="note">reads a stored standard detail · designs nothing</span>
      </div>

      {structure.outcome === 'no-detail' && (
        <div className="stop">
          <h3>No standard detail stored — no structural quantities</h3>
          <p>{structure.message}</p>
        </div>
      )}

      {structure.outcome === 'out-of-envelope' && (
        <>
          <div className="stop">
            <h3>Out of envelope — no structural quantities</h3>
            <p>{structure.message}</p>
          </div>
          {structure.attempts.map((a) => (
            <EnvelopeTable key={a.detail.id} match={a} />
          ))}
        </>
      )}

      {structure.outcome === 'quantities' && <Quantities structure={structure} />}
    </section>
  );
}

function EnvelopeTable({ match }: { match: EnvelopeMatch }) {
  return (
    <>
      <div className="subsection">
        {match.detail.name} · rev {match.detail.versionDate}
        <span className={`chip ${match.status === 'in-envelope' ? 'pass' : 'fail'}`}>
          {match.status === 'in-envelope' ? 'IN' : 'OUT'}
        </span>
      </div>
      <table className="checks">
        <colgroup>
          <col style={{ width: '9%' }} />
          <col style={{ width: '21%' }} />
          <col style={{ width: '35%' }} />
          <col style={{ width: '35%' }} />
        </colgroup>
        <tbody>
          {match.findings.map((f) => (
            <tr key={f.dimension} className={f.ok ? undefined : 'is-fail'}>
              <td>
                <span className={`chip ${f.ok ? 'pass' : 'fail'}`}>{f.ok ? 'PASS' : 'FAIL'}</span>
              </td>
              <td className="check-title">{f.dimension}</td>
              <td className="check-limit">envelope&nbsp;&nbsp;{f.limit}</td>
              <td className="check-actual">job&nbsp;&nbsp;{f.actual}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="notes">
        <ul>
          {match.confirmations.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Quantities({ structure }: { structure: Extract<StructureResult, { outcome: 'quantities' }> }) {
  const q = structure.quantities;
  const d = q.detail;

  return (
    <>
      {!d.envelopeConfirmed && (
        <div className="stop">
          <h3>Envelope not confirmed</h3>
          <p>
            The depth range and plan limits on {d.id} were assumed, not stated. Quantities below are
            real, but the boundary that decides whether this detail covers a job has not been agreed.
          </p>
        </div>
      )}

      <EnvelopeTable match={q.envelope} />

      <div className="subsection">
        Detail as entered
        <span>
          {d.shellThicknessIn} in shell · {d.barSize} at {d.barSpacingIn} in o.c. each way ·{' '}
          {d.stressPointSpacingIn} in at coves and stress points · bond beam {d.bondBeamWidthIn}×
          {d.bondBeamDepthIn} in with {d.bondBeamBarCount} × {d.bondBeamBarSize} · {d.gunitePsi} psi
        </span>
      </div>

      <div className="subsection">Gunite</div>
      <CalcTable
        calcs={[
          q.developedArea,
          q.shellVolume,
          q.coveVolume,
          q.bondBeamVolume,
          ...(q.damWallVolume ? [q.damWallVolume] : []),
          q.gunite.net,
          q.gunite.waste,
          q.gunite.ordered,
          q.guniteCy,
        ]}
        emphasize={[q.guniteCy.id]}
      />

      <div className="subsection">Reinforcement</div>
      <CalcTable
        calcs={[q.barLinearFeet, q.bondBeamBarLf, q.barWeight, q.stockBars, q.tieCount]}
        emphasize={[q.stockBars.id]}
      />

      <div className="subsection">
        Bar schedule
        <span>
          {num1(q.cutPlan.requiredLf)} lf required · {q.cutPlan.stockBars} ×{' '}
          {q.cutPlan.stockLengthFt} ft stock · {num1(q.cutPlan.dropLf)} lf drop (
          {(q.cutPlan.dropPct * 100).toFixed(1)}%) · {q.cutPlan.splices} splices
        </span>
      </div>
      <table className="checks">
        <colgroup>
          <col style={{ width: '46%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Family</th>
            <th style={{ textAlign: 'right' }}>Count</th>
            <th style={{ textAlign: 'right' }}>Length ea</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {q.barSchedule.map((r, i) => (
            <tr key={`${r.family}-${i}`}>
              <td className="check-title">{r.family}</td>
              <td className="c-result">{r.count}</td>
              <td className="c-result">{num(r.lengthFt)} ft</td>
              <td className="c-result">{num(r.count * r.lengthFt)} lf</td>
            </tr>
          ))}
        </tbody>
      </table>

      {q.pierVolume && (
        <>
          <div className="subsection">Piers</div>
          <CalcTable calcs={[q.pierVolume]} />
        </>
      )}

      <div className="notes">
        <div className="notes-head">Notes</div>
        <ul>
          {q.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
