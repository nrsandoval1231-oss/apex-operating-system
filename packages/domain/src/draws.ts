import {
  DRAW_SCHEDULE_TEMPLATE,
  TOTAL_BASIS_POINTS,
  type DrawCode,
  type DrawTemplate,
} from '@apex/contracts';
import { DomainRuleError } from './errors.js';

/**
 * Dividing a contract into draws — PRD §9.8.
 *
 * All integer cents. A percentage of an odd total does not divide evenly, and
 * the pieces must still add up to exactly the contract: a customer billed
 * 10/30/30/20/10 of $152,041.73 must be billed $152,041.73 in total, not a cent
 * more or less.
 */

export interface AllocatedDraw {
  readonly template: DrawTemplate;
  readonly amountCents: number;
}

/**
 * Split a contract total across the schedule.
 *
 * Each draw takes the floor of its share, and the rounding remainder — at most a
 * few cents — goes to the **final** draw. Putting it at the end means every
 * earlier invoice is a clean percentage and the arithmetic only has to be
 * explained once, on the last one.
 */
export function allocateDrawAmounts(
  contractCents: number,
  template: readonly DrawTemplate[] = DRAW_SCHEDULE_TEMPLATE,
): readonly AllocatedDraw[] {
  if (!Number.isSafeInteger(contractCents) || contractCents < 0) {
    throw new DomainRuleError('A contract total must be a non-negative whole number of cents.');
  }
  if (template.length === 0) throw new DomainRuleError('A draw schedule must contain at least one draw.');

  const totalBasisPoints = template.reduce((sum, draw) => sum + draw.percentBasisPoints, 0);
  if (totalBasisPoints !== TOTAL_BASIS_POINTS) {
    throw new DomainRuleError(
      `A draw schedule must account for the whole contract: ${totalBasisPoints} of ${TOTAL_BASIS_POINTS} basis points.`,
    );
  }

  const ordered = [...template].sort((a, b) => a.sequence - b.sequence);
  const amounts = ordered.map((draw) =>
    Math.floor((contractCents * draw.percentBasisPoints) / TOTAL_BASIS_POINTS));
  const remainder = contractCents - amounts.reduce((sum, amount) => sum + amount, 0);
  const lastIndex = amounts.length - 1;
  amounts[lastIndex] = (amounts[lastIndex] ?? 0) + remainder;

  const allocated = ordered.map((template_, index) => ({
    template: template_,
    amountCents: amounts[index] ?? 0,
  }));

  // Belt and braces: the invariant this function exists to hold.
  const sum = allocated.reduce((total, draw) => total + draw.amountCents, 0);
  if (sum !== contractCents) {
    throw new DomainRuleError(`Draw allocation lost money: ${sum} allocated of ${contractCents}.`);
  }
  return allocated;
}

/** The draw a Gate releases, or null when the Gate bears none. */
export const drawCodeForGate = (definitionKey: string): DrawCode | null =>
  DRAW_SCHEDULE_TEMPLATE.find((draw) => draw.gateDefinitionKey === definitionKey)?.code ?? null;
