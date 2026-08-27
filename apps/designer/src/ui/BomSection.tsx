/**
 * The order list.
 *
 * One column of quantities and one of what they are. The basis for each figure
 * is there but held back visually — someone ordering steel does not read it,
 * and someone questioning a number needs it on the same line rather than in
 * another document.
 *
 * Anything a module refused to produce is printed at the bottom in full. A
 * short BOM that looks complete is how a job gets under-ordered.
 */

import { buildBom } from '../engine/bom.ts';
import type { TakeoffResult } from '../engine/index.ts';
import type { Job } from '../engine/types.ts';

const qty = (value: number) =>
  Number.isInteger(value) ? value.toLocaleString('en-US') : value.toLocaleString('en-US', { maximumFractionDigits: 1 });

export function BomSection({ job, takeoff }: { job: Job; takeoff: TakeoffResult }) {
  const bom = buildBom(job, takeoff);

  return (
    <section className="section bom" id="out-bom">
      <div className="section-head">
        <h2>Order list</h2>
        <span className="note">
          every figure comes from the takeoff · ordered quantities include waste and say so
        </span>
      </div>

      {bom.groups.map((group) => (
        <div className="bom-group" key={group.title}>
          <div className="bom-group-title">{group.title}</div>
          <ul className="bom-lines">
            {group.lines.map((line) => (
              <li key={line.item}>
                <span className="bom-qty">
                  {qty(line.quantity)} <span className="bom-unit">{line.unit}</span>
                </span>
                <span className="bom-item">
                  {line.item}
                  {line.includesWaste && <span className="bom-waste">incl. waste</span>}
                  <span className="bom-basis">{line.basis}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {bom.missing.length > 0 && (
        <div className="bom-missing">
          <strong>Not on this list</strong>
          <ul>
            {bom.missing.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
