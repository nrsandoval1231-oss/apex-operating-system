/**
 * Lubbock amendment checks. Every check that ran is listed — passes included.
 * PRD: pass, fail, or the governing limit, never silently.
 */

import type { CodeCheck } from '../engine/codeChecks.ts';

export function CodeCheckTable({ checks }: { checks: readonly CodeCheck[] }) {
  return (
    <table className="checks">
      <colgroup>
        <col style={{ width: '9%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '48%' }} />
        <col style={{ width: '26%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>Status</th>
          <th>Section</th>
          <th>Check</th>
          <th>Governing limit / actual</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((c) => (
          <tr key={c.id} className={c.status === 'fail' ? 'is-fail' : undefined}>
            <td>
              <span className={`chip ${c.status}`}>{c.status.toUpperCase()}</span>
            </td>
            <td className="check-section">{shortSection(c.section)}</td>
            <td>
              <div className="check-title">{c.title}</div>
              {c.status !== 'pass' && <div className="check-message">{c.message}</div>}
              {c.compliancePath && (
                <div className="check-path">
                  <strong>Compliance path:</strong> {c.compliancePath}
                </div>
              )}
            </td>
            <td>
              <div className="check-limit">limit&nbsp;&nbsp;{c.governingLimit}</div>
              <div className="check-actual">actual&nbsp;{c.actual}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "411.2.1 (Lubbock amendment, Art. 28.18)" -> "411.2.1 Lubbock". */
function shortSection(section: string): string {
  const n = section.split(' ')[0];
  return `${n} Lubbock`;
}
