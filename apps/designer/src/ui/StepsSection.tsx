/**
 * Steps and benches, measured.
 *
 * The plan drew the stair and the code table judged it, but nothing on the sheet
 * said how tall it was or how deep a tread ran — which is what someone standing
 * in the hole needs. Risers print bottom first, the same order the code text and
 * the job input use, so the sheet and the checklist read alike.
 */

import { seatMetrics, stepMetrics } from '../engine/stepMetrics.ts';
import type { Job } from '../engine/types.ts';

const ft = (value: number) => {
  const whole = Math.floor(value + 1e-9);
  const inches = Math.round((value - whole) * 12);
  return inches === 12 ? `${whole + 1}'-0"` : `${whole}'-${inches}"`;
};
const sf = (value: number) => `${value.toFixed(1)} sf`;

export function StepsSection({ job }: { job: Job }) {
  const steps = job.pool.steps.map(stepMetrics);
  const seats = job.pool.seats.map(seatMetrics);

  if (steps.length === 0 && seats.length === 0) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Steps and benches</h2>
        <span className="note">
          measured from the job inputs · risers bottom first · not part of the approved quantity
          payload
        </span>
      </div>

      {steps.length > 0 && (
        <table className="calc-table steps-table">
          <thead>
            <tr>
              <th>Stair</th>
              <th>Treads</th>
              <th>Tread depth</th>
              <th>Stair width</th>
              <th>Total rise</th>
              <th>Risers, bottom first</th>
              <th>Projects</th>
              <th>Tread area</th>
              <th>Lands in</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id}>
                <td>{step.id}{job.pool.steps.find((s) => s.id === step.id)?.isRequiredEntryExit ? ' · required entry' : ''}</td>
                <td>{step.treadCount}</td>
                <td>{step.treadRunFt * 12}&quot;</td>
                <td>{ft(step.treadWidthFt)}</td>
                <td>{ft(step.totalRiseFt)}</td>
                <td className="mono">{step.riserHeightsIn.join(' / ')}&quot;</td>
                <td>{ft(step.totalRunFt)}</td>
                <td>{sf(step.treadAreaSf)}</td>
                <td>{ft(step.floorDepthFt)} water</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {seats.length > 0 && (
        <table className="calc-table steps-table">
          <thead>
            <tr>
              <th>Seat</th>
              <th>Kind</th>
              <th>Below waterline</th>
              <th>Surface depth</th>
              <th>Width</th>
              <th>Stands off floor</th>
              <th>Surface area</th>
              <th>Leading edge</th>
            </tr>
          </thead>
          <tbody>
            {seats.map((seat) => (
              <tr key={seat.id}>
                <td>{seat.id}</td>
                <td>{seat.kind}</td>
                <td>{seat.depthBelowWaterlineIn}&quot;</td>
                <td>{seat.surfaceDepthIn}&quot;</td>
                <td>{seat.surfaceWidthIn}&quot;</td>
                <td>{ft(seat.heightAboveFloorFt)}</td>
                <td>{sf(seat.surfaceAreaSf)}</td>
                <td>{ft(seat.leadingEdgeLengthFt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
