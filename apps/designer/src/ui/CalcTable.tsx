/**
 * Renders Calc records. This component is the whole "show the work" pattern:
 * it has no arithmetic in it and cannot produce a number the engine did not
 * compute. Formula, inputs with units, and result are all mandatory columns.
 */

import type { Calc } from '../engine/calc.ts';
import { num } from './format.ts';

export function CalcTable({
  calcs,
  emphasize = [],
}: {
  calcs: readonly Calc[];
  /** Calc ids to render heavier — the totals a reader scans for. */
  emphasize?: readonly string[];
}) {
  return (
    <table className="calcs">
      <colgroup>
        <col className="col-label" />
        <col className="col-formula" />
        <col className="col-inputs" />
        <col className="col-result" />
        <col className="col-unit" />
      </colgroup>
      <thead>
        <tr>
          <th>Quantity</th>
          <th>Formula</th>
          <th>Inputs</th>
          <th style={{ textAlign: 'right' }}>Result</th>
          <th style={{ paddingLeft: 4 }}>Unit</th>
        </tr>
      </thead>
      <tbody>
        {calcs.map((c) => (
          <tr key={c.id} className={emphasize.includes(c.id) ? 'emphasis' : undefined}>
            <td>
              <div className="c-label">{c.label}</div>
              {c.source && <span className="c-source">{c.source}</span>}
            </td>
            <td>
              <div className="c-formula">{c.formula}</div>
            </td>
            <td>
              <div className="c-inputs">
                {c.inputs.map((i, n) => (
                  <span key={i.symbol}>
                    {n > 0 && <span className="sep">, </span>}
                    <span className="sym">{i.symbol}</span>=<span title={i.label}>{num(i.value)}</span>{' '}
                    {i.unit}
                  </span>
                ))}
              </div>
              {c.notes?.map((note) => (
                <div className="c-note" key={note}>
                  {note}
                </div>
              ))}
            </td>
            <td className="c-result">{num(c.value)}</td>
            <td className="c-unit">{c.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
