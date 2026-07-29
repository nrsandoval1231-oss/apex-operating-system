import { readFileSync } from 'node:fs';

const loadJson = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
const sum = (values) => values.reduce((total, value) => total + value, 0);
const assertIntegerCents = (value, path) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${path} must be a non-negative integer number of cents.`);
};
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const validateEstimate = (estimate) => {
  if (!/^[a-f0-9]{64}$/.test(estimate.source?.sha256 ?? '')) throw new Error('Estimate source SHA-256 is invalid.');
  estimate.sections.forEach((section, sectionIndex) => {
    assertIntegerCents(section.subtotalCents, `estimate.sections[${sectionIndex}].subtotalCents`);
    const lineTotal = sum(section.lines.map((line, lineIndex) => {
      if (line.amountCents == null) return 0;
      assertIntegerCents(line.amountCents, `estimate.sections[${sectionIndex}].lines[${lineIndex}].amountCents`);
      return line.amountCents;
    }));
    if (lineTotal !== section.subtotalCents) throw new Error(`Estimate section ${section.name} does not reconcile: ${lineTotal} != ${section.subtotalCents}.`);
  });
  const sectionTotal = sum(estimate.sections.map((section) => section.subtotalCents));
  if (sectionTotal !== estimate.totals.jobCostCents) throw new Error(`Estimate sections do not reconcile to job cost: ${sectionTotal} != ${estimate.totals.jobCostCents}.`);
  const fee = Math.round(estimate.totals.jobCostCents * estimate.totals.feeRateBasisPoints / 10_000);
  if (fee !== estimate.totals.feeCents) throw new Error('Estimate contractor fee does not reconcile.');
  if (estimate.totals.jobCostCents + estimate.totals.feeCents !== estimate.totals.estimatedCustomerTotalCents) throw new Error('Estimate customer total does not reconcile.');
};

const validateActual = (actual) => {
  if (!/^[a-f0-9]{64}$/.test(actual.source?.sha256 ?? '')) throw new Error('Actual-cost source SHA-256 is invalid.');
  actual.transactions.forEach((transaction, index) => assertIntegerCents(transaction.amountCents, `actual.transactions[${index}].amountCents`));
  const transactionTotal = sum(actual.transactions.map((transaction) => transaction.amountCents));
  if (transactionTotal !== actual.totals.poolExpensesCents) throw new Error(`Actual transactions do not reconcile: ${transactionTotal} != ${actual.totals.poolExpensesCents}.`);
  const fee = Math.round(actual.totals.poolExpensesCents * actual.totals.feeRateBasisPoints / 10_000);
  if (fee !== actual.totals.contractorFeeCents) throw new Error('Actual contractor fee does not reconcile.');
  if (actual.totals.poolExpensesCents + actual.totals.contractorFeeCents !== actual.totals.customerTotalCents) throw new Error('Actual customer total does not reconcile.');
  const paymentTotal = sum(actual.payments.map((payment, index) => {
    assertIntegerCents(payment.amountCents, `actual.payments[${index}].amountCents`);
    return payment.amountCents;
  }));
  if (paymentTotal !== actual.paymentsReceivedCents) throw new Error('Payment rows do not reconcile to payments received.');
  if (actual.paymentsReceivedCents + actual.remainingBalanceCents !== actual.totals.customerTotalCents) throw new Error('Payments plus remaining balance do not reconcile to customer total.');
};

export function readWhitakerEvidence() {
  const estimate = loadJson('./evidence/whitaker/estimate.json');
  const actual = loadJson('./evidence/whitaker/actual-costs.json');
  validateEstimate(estimate);
  validateActual(actual);
  return deepFreeze({ estimate, actual });
}

export function reconcileWhitakerEvidence({ estimate, actual }) {
  validateEstimate(estimate);
  validateActual(actual);
  const unclassifiedTransactionCount = actual.transactions.filter((transaction) => transaction.classification == null).length;
  return deepFreeze({
    estimateCostCents: estimate.totals.jobCostCents,
    estimatedFeeCents: estimate.totals.feeCents,
    estimatedCustomerTotalCents: estimate.totals.estimatedCustomerTotalCents,
    actualTransactionCount: actual.transactions.length,
    actualCostCents: actual.totals.poolExpensesCents,
    actualFeeCents: actual.totals.contractorFeeCents,
    actualCustomerTotalCents: actual.totals.customerTotalCents,
    paymentsReceivedCents: actual.paymentsReceivedCents,
    remainingBalanceCents: actual.remainingBalanceCents,
    estimatedCostVarianceCents: actual.totals.poolExpensesCents - estimate.totals.jobCostCents,
    estimatedCustomerVarianceCents: actual.totals.customerTotalCents - estimate.totals.estimatedCustomerTotalCents,
    unclassifiedTransactionCount,
    authority: {
      use: 'single-job estimate-to-actual replay',
      quantityAuthority: false,
      productionRateCalibration: false,
      reason: 'These documents describe one Whitaker job. They reconcile quoted and actual dollars but do not independently validate Designer quantities or support production pricing rates. Transactions must be reviewed and cost-code classified before category variance analysis.',
    },
  });
}
