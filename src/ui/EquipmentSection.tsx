/**
 * Equipment, gas demand and pad layout.
 *
 * Gas gets a stop-styled banner even when it passes: it is a demand
 * calculation, and the sheet should never read like a gas design.
 */

import type { EquipmentResult } from '../engine/equipment.ts';
import { CalcTable } from './CalcTable.tsx';
import { num1 } from './format.ts';

export function EquipmentSection({ equipment }: { equipment: EquipmentResult | null }) {
  if (!equipment) return null;
  const { pump, gas, pad } = equipment;

  return (
    <section className="section">
      <div className="section-head">
        <h2>8 · Equipment, gas demand &amp; pad</h2>
        <span className="note">pump matched to the converged operating point</span>
      </div>

      {pump && (
        <>
          <div className="subsection">
            Pump selection
            <span>{pump.basis}</span>
          </div>
          <table className="checks">
            <thead>
              <tr>
                <th>Pump</th>
                <th style={{ textAlign: 'right' }}>THP</th>
                <th style={{ textAlign: 'right' }}>Speed</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {pump.candidates.map((c) => (
                <tr
                  key={c.model.id}
                  className={c.model.id === pump.selected?.model.id ? 'emphasis' : undefined}
                >
                  <td className="check-title">
                    {c.model.series} {c.model.id}
                    {c.model.id === pump.selected?.model.id ? ' — selected' : ''}
                  </td>
                  <td className="c-result">{c.model.totalHp}</td>
                  <td className="c-result">{c.speedRpm ? `${c.speedRpm} rpm` : '—'}</td>
                  <td>
                    <span className={`chip ${c.meetsDesignFlow ? 'pass' : 'guidance'}`}>
                      {c.meetsDesignFlow ? 'MEETS' : 'NO'}
                    </span>
                    <div className="check-message" style={{ color: 'var(--ink-soft)' }}>
                      {c.note}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {gas && (
        <>
          <div className="subsection">
            Gas demand
            <span>{gas.fuel}</span>
          </div>

          <div className="stop">
            <h3>Demand calculation — not a gas design</h3>
            <p>{gas.disclaimer}</p>
          </div>

          <CalcTable
            calcs={[
              gas.heaterDemand,
              gas.heaterCfh,
              gas.totalConnectedLoadBtu,
              gas.totalConnectedLoadCfh,
              gas.developedLength,
            ]}
            emphasize={[gas.totalConnectedLoadCfh.id]}
          />

          <div className="check">
            <div className="check-top">
              <span
                className={`chip ${
                  gas.meterCheck.status === 'pass'
                    ? 'pass'
                    : gas.meterCheck.status === 'fail'
                      ? 'fail'
                      : 'guidance'
                }`}
              >
                {gas.meterCheck.status.toUpperCase()}
              </span>
              <span className="check-title">Meter capacity</span>
            </div>
            <div className="check-message">{gas.meterCheck.message}</div>
          </div>

          <div className="check">
            <div className="check-top">
              <span
                className={`chip ${
                  gas.intendedSize.status === 'confirmed'
                    ? 'pass'
                    : gas.intendedSize.status === 'too-small'
                      ? 'fail'
                      : 'guidance'
                }`}
              >
                {gas.intendedSize.label ?? 'NONE'}
              </span>
              <span className="check-title">Shop-standard size</span>
            </div>
            <div className="check-message">{gas.intendedSize.message}</div>
          </div>

          <div className="check">
            <div className="check-top">
              <span className={`chip ${gas.referenceSize.sizeLabel ? 'pass' : 'guidance'}`}>
                {gas.referenceSize.sizeLabel ?? 'NO SIZE'}
              </span>
              <span className="check-title">Reference size, dedicated run</span>
            </div>
            <div className="check-message">{gas.referenceSize.message}</div>
          </div>

          <div className="notes">
            <ul>
              {gas.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="subsection">
        Equipment pad
        <span>
          {num1(pad.padLength.value)} × {num1(pad.padWidth.value)} ft ·{' '}
          {num1(pad.distanceFromPool.value)} ft from the pool
        </span>
      </div>
      {pad.impossibleRuns.map((m) => (
        <div className="check is-fail" key={m}>
          <div className="check-top">
            <span className="chip fail">FAIL</span>
            <span className="check-title">Run shorter than the distance to the pad</span>
          </div>
          <div className="check-message">{m}</div>
        </div>
      ))}
      <CalcTable
        calcs={[pad.distanceFromPool, ...pad.items.map((i) => i.footprint), pad.padLength, pad.padWidth, pad.padArea, pad.valveCount, pad.actuatorCount]}
        emphasize={[pad.padArea.id]}
      />
      <div className="notes">
        <ul>
          {pad.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          {equipment.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
