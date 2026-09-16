/** Number formatting for the sheet. Every number renders monospace and tabular. */

/**
 * Up to 4 significant decimals, trailing zeros trimmed, thousands separated.
 * Deliberately does not round to a "clean" number — the sheet shows what the
 * math produced so it can be reconciled against a hand calc.
 */
export function num(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : 5;
  const rounded = Number(n.toFixed(decimals));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/**
 * Rounded to one decimal, for the headline block only. The full precision stays
 * on the line item below it — the headline is for scanning, not reconciling.
 */
export function num1(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}
