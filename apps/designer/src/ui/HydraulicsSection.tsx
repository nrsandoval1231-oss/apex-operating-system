/**
 * Hydraulics section. Velocity is reported per segment against every threshold,
 * each labeled with the standard it comes from — the whole point is that nobody
 * reads the energy standard as if it were the code.
 */

import type { HydraulicsResult, RunResult, VelocityCheck } from '../engine/hydraulics.ts';
import { CalcTable } from './CalcTable.tsx';
import { num, num1 } from './format.ts';

export function HydraulicsSection({ hydraulics }: { hydraulics: HydraulicsResult | null }) {
  if (!hydraulics) return null;
  const h = hydraulics;

  return (
    <section className="section">
      <div className="section-head">
        <h2>4 · Hydraulics</h2>
        <span className="note">
          flow → size → TDH → pump curve → actual flow → re-check · {h.systemFlowBasis}
          {h.pumpModel &&
            ` · ${h.pumpModel.manufacturer} ${h.pumpModel.series} ${h.pumpModel.id}, ${h.pumpModel.totalHp} THP`}
        </span>
      </div>

      <div className="subsection">Design flow</div>
      <CalcTable
        calcs={[h.flow.maxFlow, h.flow.minFlow, h.flow.turnoverFlow, h.flow.designFlow, h.flow.achievedTurnover]}
        emphasize={[h.flow.designFlow.id]}
      />
      {h.flow.checks.map((c) => (
        <CheckLine key={c.standard} check={c} />
      ))}

      <div className="subsection">
        Suction outlets
        <span>required cover rating {num1(h.sofaRequirement.value)} gpm each</span>
      </div>
      {h.outletChecks.map((c) => (
        <CheckLine key={c.standard} check={c} />
      ))}
      <CalcTable calcs={[h.sofaRequirement, h.hydrostaticValves]} />

      <div className="subsection">
        Segments
        <span>velocity at {num1(h.systemFlowGpm)} gpm system flow</span>
      </div>
      {h.runs.map((r) => (
        <RunBlock key={r.run.id} result={r} />
      ))}

      <div className="subsection">Total dynamic head</div>
      <CalcTable calcs={[...h.tdhBreakdown, h.tdh]} emphasize={[h.tdh.id]} />

      {h.speedOptions.length > 0 && (
        <>
          <div className="subsection">
            Variable-speed options
            <span>
              {h.selectedSpeed
                ? `running at ${h.selectedSpeed.rpm} rpm`
                : 'no published speed meets design flow'}
              {h.recommendedRpm ? ` · set near ${h.recommendedRpm} rpm` : ''}
            </span>
          </div>
          <table className="checks">
            <thead>
              <tr>
                <th>Speed</th>
                <th style={{ textAlign: 'right' }}>Delivers</th>
                <th style={{ textAlign: 'right' }}>At head</th>
                <th>Meets design flow</th>
              </tr>
            </thead>
            <tbody>
              {h.speedOptions.map((o) => (
                <tr key={o.rpm} className={o.rpm === h.selectedSpeed?.rpm ? 'emphasis' : undefined}>
                  <td className="check-title">
                    {o.rpm} rpm{o.rpm === h.selectedSpeed?.rpm ? ' — selected' : ''}
                  </td>
                  <td className="c-result">
                    {o.operatingPoint ? `${num1(o.operatingPoint.gpm)} gpm` : 'no crossing'}
                  </td>
                  <td className="c-result">
                    {o.operatingPoint ? `${num1(o.operatingPoint.headFt)} ft` : '—'}
                  </td>
                  <td>
                    <span className={`chip ${o.meetsDesignFlow ? 'pass' : 'guidance'}`}>
                      {o.meetsDesignFlow ? 'YES' : 'NO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {h.speedSelectionNote && (
            <div className="notes">
              <p>{h.speedSelectionNote}</p>
            </div>
          )}
        </>
      )}

      <div className="subsection">
        Operating point
        {h.operatingPoint && (
          <span>
            {num1(h.operatingPoint.gpm)} gpm at {num1(h.operatingPoint.headFt)} ft ·{' '}
            {h.iterations} iteration{h.iterations === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {h.operatingChecks.map((c) => (
        <CheckLine key={c.standard} check={c} />
      ))}
      {h.operatingPoint ? (
        <div className="notes">
          <p>{h.operatingPointNote}</p>
          <ul>
            {h.convergenceLog.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="stop">
          <h3>No pump curve — no operating point</h3>
          <p>{h.operatingPointNote}</p>
        </div>
      )}

      {h.installationRequirements.length > 0 && (
        <div className="notes">
          <div className="notes-head">Manufacturer installation requirements</div>
          <ul>
            {h.installationRequirements.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="notes">
        <div className="notes-head">Notes</div>
        <ul>
          {h.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RunBlock({ result }: { result: RunResult }) {
  // Guidance does not roll up: the segment reads on code and the energy
  // standard, and the GENESIS line is reported alongside.
  const worst = result.checks.some((c) => c.status === 'fail')
    ? 'fail'
    : result.checks.some((c) => c.status === 'flag')
      ? 'flag'
      : 'pass';

  return (
    <div className="run">
      <div className="run-head">
        <span className={`chip ${worst}`}>{worst.toUpperCase()}</span>
        <span className="check-title">{result.run.label}</span>
        <span className="check-section">
          {result.size} in Sch 40 · {num(result.normalFlowGpm)} gpm normal ·{' '}
          {num(result.governingFlowGpm)} gpm governing
        </span>
        <span className="run-v">{num(result.velocity.value)} fps</span>
      </div>
      <div className="check-limit">{result.governingCondition}</div>
      <div className="run-checks">
        {result.checks.map((c) => (
          <span key={c.standard} className={`run-check ${c.status}`}>
            <b>{c.status.toUpperCase()}</b> {c.standard} — limit {c.limitFps} fps
          </span>
        ))}
      </div>
      <CalcTable calcs={[result.velocity, result.equivalentLength, result.frictionLoss]} />
    </div>
  );
}

function CheckLine({ check }: { check: VelocityCheck }) {
  return (
    <div className={`check ${check.status === 'fail' ? 'is-fail' : ''}`}>
      <div className="check-top">
        <span className={`chip ${check.status}`}>{check.status.toUpperCase()}</span>
        <span className="check-title">{check.standard}</span>
      </div>
      <div className="check-message">{check.note}</div>
    </div>
  );
}
