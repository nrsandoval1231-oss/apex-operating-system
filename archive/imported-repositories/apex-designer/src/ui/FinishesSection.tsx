/**
 * Cover, finishes, and yard & drainage sections.
 *
 * The cover comes first because it constrains the shell upstream, and because
 * in Lubbock it can be the barrier compliance path for the whole job.
 */

import type { CoverResult } from '../engine/cover.ts';
import type { FinishesResult } from '../engine/finishes.ts';
import type { YardResult } from '../engine/yard.ts';
import type { NetAndWaste } from '../engine/calc.ts';
import { CalcTable } from './CalcTable.tsx';
import { CodeCheckTable } from './CodeCheckTable.tsx';
import { num1 } from './format.ts';

export function CoverSection({ cover }: { cover: CoverResult | null }) {
  if (!cover) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>5 · Cover</h2>
        <span className="note">an input that constrains the shell, not a downstream selection</span>
      </div>

      <div
        className={cover.barrierPath === 'non-compliant' ? 'stop' : 'notes'}
        style={cover.barrierPath === 'non-compliant' ? undefined : { marginTop: 10 }}
      >
        {cover.barrierPath === 'non-compliant' ? (
          <>
            <h3>No valid barrier path</h3>
            <p>{cover.barrierPathLabel}</p>
          </>
        ) : (
          <p>
            <strong>Barrier compliance path:</strong> {cover.barrierPathLabel}
          </p>
        )}
      </div>

      <CodeCheckTable checks={cover.checks} />

      <div className="subsection">
        Quantities
        <span>
          {cover.cover.manufacturer} {cover.cover.model} · spec rev {cover.cover.specRevisionDate}
        </span>
      </div>
      <CalcTable calcs={[cover.vaultVolume, cover.trackLf, cover.bondBeamDrop]} />

      <div className="notes">
        <div className="notes-head">Constraints this cover puts on the shell</div>
        <ul>
          {cover.shellConstraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <div className="notes">
        <ul>
          {cover.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WasteBlock({ q }: { q: NetAndWaste }) {
  return <CalcTable calcs={[q.net, q.waste, q.ordered]} emphasize={[q.ordered.id]} />;
}

export function FinishesSection({ finishes }: { finishes: FinishesResult | null }) {
  if (!finishes) return null;
  const f = finishes;

  return (
    <section className="section">
      <div className="section-head">
        <h2>6 · Finishes</h2>
        <span className="note">waste shown as its own line, never folded into net</span>
      </div>

      <div className="subsection">Waterline tile</div>
      <WasteBlock q={f.waterlineTileLf} />
      <CalcTable calcs={[f.waterlineTileSf]} />

      <div className="subsection">Coping</div>
      <WasteBlock q={f.copingLf} />
      <CalcTable calcs={[f.copingPieces]} emphasize={[f.copingPieces.id]} />

      <div className="subsection">Plaster</div>
      <WasteBlock q={f.plasterSf} />

      <div className="subsection">
        Leading-edge contrast stripe
        <span>Lubbock amended 411.5.1 / 411.5.2 — 1 in minimum, contrasting and slip-resistant</span>
      </div>
      <WasteBlock q={f.contrastStripeLf} />
      <CalcTable calcs={[f.contrastStripeSf]} />

      {f.notes.length > 0 && (
        <div className="notes">
          <div className="notes-head">Notes</div>
          <ul>
            {f.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function YardSection({ yard }: { yard: YardResult | null }) {
  if (!yard) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>7 · Yard &amp; drainage</h2>
        <span className="note">
          {yard.compliancePath} · {num1(yard.fallAcrossDeck.value)} in of fall across the deck
        </span>
      </div>

      <CalcTable
        calcs={[yard.deckArea, yard.deckPerimeter, yard.fallAcrossDeck, yard.deckDrainLf, yard.gradeTransitions]}
        emphasize={[yard.deckArea.id]}
      />

      <div className="subsection">Deck slope, ISPSC 306.5</div>
      <CodeCheckTable checks={yard.checks} />

      <div className="notes">
        <ul>
          {yard.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
