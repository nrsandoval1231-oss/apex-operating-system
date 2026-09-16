import { readWhitakerEvidence, reconcileWhitakerEvidence } from './whitaker-evidence.mjs';

let pass = 0;
let fail = 0;
const ok = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${condition ? '' : ` -> ${detail}`}`);
  condition ? pass++ : fail++;
};

const evidence = readWhitakerEvidence();
const result = reconcileWhitakerEvidence(evidence);

ok('estimate document hash is pinned', evidence.estimate.source.sha256 === 'e4350228a19f32a75a977187bad0f08621a756e36b9088bfecfec9663ae9140a');
ok('actual-cost document hash is pinned', evidence.actual.source.sha256 === 'be4bb9c8b1fc77e7350ddc812467f8bb9a08b30f915c05538f2dc34c7d5988d4');
ok('estimate section subtotals reconcile to $116,955.18', result.estimateCostCents === 11_695_518);
ok('all 61 actual transactions reconcile to $104,602.12', result.actualTransactionCount === 61 && result.actualCostCents === 10_460_212);
ok('actual 30% contractor fee reconciles exactly', result.actualFeeCents === 3_138_064);
ok('actual cost plus fee reconciles to $135,982.76', result.actualCustomerTotalCents === 13_598_276);
ok('payments plus balance reconcile to actual customer total', result.paymentsReceivedCents + result.remainingBalanceCents === result.actualCustomerTotalCents);
ok('estimate exceeded actual cost by $12,353.06', result.estimatedCostVarianceCents === -1_235_306);
ok('customer estimate exceeded actual cost-plus total by $16,058.97', result.estimatedCustomerVarianceCents === -1_605_897);
ok('same-job documents are replay evidence, not quantity validation', result.authority.quantityAuthority === false);
ok('uncategorized transactions block production rate calibration', result.authority.productionRateCalibration === false && result.unclassifiedTransactionCount === 61);

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
