import {
  takeoff, marginFromFee, feeForMargin, price, poolGeometry, spaGeometry, combinedGeometry,
  deckArea, APEX_STANDARDS,
} from './engine.mjs';
let pass=0, fail=0;
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const ok=(n,c,extra='')=>{console.log((c?'PASS':'FAIL')+' '+n+(c?'':'  → '+extra));c?pass++:fail++;};

/**
 * GROUND TRUTH — Whitaker Oasis, corrected 2026-07-26.
 *
 * The reference takeoff assumed a 7×7 spa and derived 921 sq ft / 104 LF / 13,222 gal from it.
 * Travis confirmed the spa is 6×6×3.5, so those figures are superseded. Pool-only numbers are
 * unaffected; everything combined moved ~3–4%.
 */
const T = {
  poolSurface: 336, poolPerimeter: 76, poolWetted: 749, poolGallons: 11939,
  spaWetted: 138.4, wetted: 887.3, perimeter: 100, gallons: 12881,
  excavation: 92.3, gunite: 27.3, plasterBags: 43, rebarLb: 1061, deckSqFt: 368,
  jobCost: 116955.18, fee: 35086.55, revenue: 152041.73,
};
const WHITAKER = { length: 24, width: 14, spa: {} }; // standards supply depth + spa dims

// ── Foundation §1 — markup vs margin (load-bearing) ──────────────────────────
ok('marginFromFee(0.30)=23.08%', near(marginFromFee(0.30)*100, 23.08, 0.02), (marginFromFee(0.30)*100).toFixed(2));
ok('feeForMargin(0.30)=42.86%', near(feeForMargin(0.30)*100, 42.86, 0.02), (feeForMargin(0.30)*100).toFixed(2));
const wp = price(T.jobCost, 0.30);
ok('Whitaker revenue ≈ 152,041.73', near(wp.revenue, T.revenue, 0.5), wp.revenue.toFixed(2));
ok('Whitaker fee ≈ 35,086.55', near(wp.fee, T.fee, 0.5), wp.fee.toFixed(2));
ok('Whitaker true margin ≈ 23.08%', near(wp.trueMargin*100, 23.08, 0.02), (wp.trueMargin*100).toFixed(2));

// ── Apex build standards (confirmed by Travis) ───────────────────────────────
ok('standard depth profile is 3.5 → 6.0', APEX_STANDARDS.depthShallow===3.5 && APEX_STANDARDS.depthDeep===6.0);
ok('standard spa is 6×6×3.5 (was assumed 7×7)', APEX_STANDARDS.spa.length===6 && APEX_STANDARDS.spa.width===6 && APEX_STANDARDS.spa.depth===3.5);
const bare = poolGeometry({length:24,width:14});
ok('bare length×width applies the standard profile', bare.avgDepth===4.75 && bare.depthShallow===3.5, String(bare.avgDepth));
ok('explicit avgDepth still overrides the standard', poolGeometry({length:24,width:14,avgDepth:6}).avgDepth===6);
ok('spa defaults to 6×6×3.5', near(spaGeometry({}).wettedArea, T.spaWetted, 0.5), spaGeometry({}).wettedArea.toFixed(1));

// Deck = 4 ft border → w·P + 4w². Ref §1000 independently back-solved 280–415 sq ft.
ok('deck from 4 ft border = 368 sq ft', deckArea({perimeter:76}).sqFt===T.deckSqFt, String(deckArea({perimeter:76}).sqFt));
ok('deck lands inside ref §1000 back-solve (280–415)', T.deckSqFt>=280 && T.deckSqFt<=415);
ok('explicit deckSqFt overrides the border rule', deckArea({perimeter:76,deckSqFt:900}).sqFt===900);
ok('deck border width is configurable', deckArea({perimeter:76,deckBorderFt:6}).sqFt===6*76+4*36);

// ── Geometry vs reference §2 (pool-only figures unchanged) ───────────────────
const pool = poolGeometry({length:24,width:14,avgDepth:4.75});
ok('pool surface 336', pool.surfaceArea===T.poolSurface);
ok('pool perimeter 76', pool.perimeter===T.poolPerimeter);
ok('pool wetted ≈ 749', near(pool.wettedArea,T.poolWetted,3), pool.wettedArea.toFixed(1));
ok('pool gallons ≈ 11,939', near(pool.gallons,T.poolGallons,20), pool.gallons.toFixed(0));
const geo = combinedGeometry(WHITAKER);
ok('combined wetted ≈ 887 (6×6 spa)', near(geo.wettedArea,T.wetted,1), geo.wettedArea.toFixed(1));
ok('combined perimeter 100', geo.perimeter===T.perimeter, String(geo.perimeter));
ok('combined gallons ≈ 12,881', near(geo.gallons,T.gallons,20), geo.gallons.toFixed(0));

// ── Assemblies ───────────────────────────────────────────────────────────────
const t = takeoff(WHITAKER);
const L = (n) => t.lines.find(l=>l.name.includes(n));
ok('excavation ≈ 92.3 bank yd³', near(L('Excavation').qty,T.excavation,0.5), String(L('Excavation').qty));
ok('gunite ordered ≈ 27.3 yd³', near(L('Gunite').qty,T.gunite,0.3), String(L('Gunite').qty));
ok('plaster area ≈ 887 sq ft', near(L('Plaster').qty,T.wetted,1), String(L('Plaster').qty));
ok('plaster bags = 43', L('Plaster').extra.bags===T.plasterBags, String(L('Plaster').extra.bags));
ok('rebar steel ≈ 1,061 lb', near(L('Rebar').qty,T.rebarLb,10), String(L('Rebar').qty));
ok('deck line derived from the border rule', L('Pool Deck').qty===T.deckSqFt && L('Pool Deck').extra.derived);
ok('rebar exposes LF #3 allocation basis', L('Rebar').allocationBasis?.metric==='LF #3 bar');

// Unit costs are back-solved so qty × rate reproduces his actual line dollars (calibrate.mjs).
const reproduces = (name, dollars, tol=25) => ok(`reproduces his $${dollars.toLocaleString()} ${name} line`, near(L(name).extended,dollars,tol), fmt(L(name).extended));
const fmt = (n)=>'$'+n.toLocaleString();
reproduces('Excavation', 5500);
reproduces('Gunite', 12000);
reproduces('Rebar', 4000);
reproduces('Coping', 7550);
reproduces('Pool Deck', 5000);
reproduces('Forming', 550);
reproduces('Site Work', 1500);
ok('reproduces his $8,750 plaster (materials + labor)', near(L('Plaster').extended,8750,30), fmt(L('Plaster').extended));
ok('reproduces his $4,450 tile (materials + labor)', near(L('Tile').extended,4450,30), fmt(L('Tile').extended));
ok('tile splits material vs labor like his estimate', near(L('Tile').extra.material,1950,25) && near(L('Tile').extra.labor,2500,25), `${L('Tile').extra.material}/${L('Tile').extra.labor}`);

// Whole-cost-code reconciliation against the real estimate (PRD 02 Milestone 4).
const byCode = (c) => t.lines.filter(l=>l.code===c).reduce((s,l)=>s+l.extended,0);
ok('code 200 Excavation reconciles to $7,000', near(byCode(200),7000,10), fmt(byCode(200)));
ok('code 400 Shell reconciles to $16,800', near(byCode(400)+byCode(500),16800,10), fmt(byCode(400)+byCode(500)));
ok('code 800 Finishes reconciles to $20,750', near(byCode(800),20750,10), fmt(byCode(800)));

// The substantiation test (PRD 02 success criteria) as an assertion: the two numbers printed
// beside each other on the estimate must multiply out to the total printed next to them.
const offBy = t.lines.filter(l=>l.unitCost!=null).map(l=>({n:l.name,d:Math.abs(l.qty*l.unitCost-l.extended)}));
ok('every line multiplies out: qty × unit cost = extended', offBy.every(x=>x.d<5), offBy.filter(x=>x.d>=5).map(x=>`${x.n} off ${x.d.toFixed(2)}`).join('; '));

// ── Parametric integrity ─────────────────────────────────────────────────────
const excOf = (i) => takeoff(i).lines.find(l=>l.code===200);
const smallSpa = excOf(WHITAKER);
const bigSpa   = excOf({length:24,width:14,spa:{length:10,width:10,depth:4}});
ok('spa excavation is parametric (10×10 digs more than 6×6)', bigSpa.qty > smallSpa.qty + 5, `${smallSpa.qty} vs ${bigSpa.qty}`);
ok('pool bank ≈ 78 yd³ (ref §200)', near(smallSpa.extra.poolBank,78,1.5), String(smallSpa.extra.poolBank));
const small = poolGeometry({length:24,width:14});
const big   = poolGeometry({length:40,width:20});
ok('steps area scales with pool size', big.stepsArea > small.stepsArea*1.5, `${small.stepsArea.toFixed(1)} vs ${big.stepsArea.toFixed(1)}`);
const a = poolGeometry({length:14,width:24}), b = poolGeometry({length:24,width:14});
ok('dimension order does not change wetted area (14×24 == 24×14)', near(a.wettedArea,b.wettedArea,0.01), `${a.wettedArea.toFixed(2)} vs ${b.wettedArea.toFixed(2)}`);
const c2 = takeoff({length:14,width:24,avgDepth:4.75,spa:{width:6,length:6,depth:3.5}});
ok('two equivalent entries land within 5% on job cost', Math.abs(t.jobCost-c2.jobCost)/t.jobCost < 0.05, `${t.jobCost} vs ${c2.jobCost}`);

// ── Pricing structure ────────────────────────────────────────────────────────
ok('fee charged on allowances (jobCost includes allowances)', t.jobCost > t.takeoffCost + t.directCost);
ok('trueMargin 23.08 at 0.30 fee', near(t.pricing.trueMarginPct,23.08,0.02), String(t.pricing.trueMarginPct));
// Concrete Diamonds is superseded once the deck is taken off — otherwise the same decorative
// concrete is billed as both an allowance and a takeoff line.
ok('allowances net to 12,000 after supersession', t.allowanceTotal===12000, String(t.allowanceTotal));
ok('Concrete Diamonds superseded by the deck takeoff', t.supersededAllowances.length===1 && t.supersededAllowances[0].supersededBy===1000);
ok('supersession raises an explanatory flag', t.flags.some(f=>f.msg.includes('bill the same work twice')));
ok('no supersession when the deck is not taken off', takeoff({...WHITAKER, deckBorderFt:0, deckSqFt:0}).allowanceTotal===17000);

// ── Derived build calendar (Foundation §8) ───────────────────────────────────
ok('build weeks DERIVED, lands in ref 6–8 wk window', t.schedule.buildWeeks>=6 && t.schedule.buildWeeks<=8, String(t.schedule.buildWeeks));
ok('explicit buildWeeks still overrides (7×3×1.5=31.5)', takeoff({...WHITAKER,buildWeeks:7}).hours.supervisionHours===31.5);
const bigJob = takeoff({length:40,width:20,spa:{}});
ok('supervision is duration-driven, NOT proportional to cost', (bigJob.hours.supervisionHours/t.hours.supervisionHours) < (bigJob.jobCost/t.jobCost), `sup ×${(bigJob.hours.supervisionHours/t.hours.supervisionHours).toFixed(2)} vs cost ×${(bigJob.jobCost/t.jobCost).toFixed(2)}`);

// ── Lever B: quantified, still gated (Foundation §3.1) ───────────────────────
const lb = t.leverB;
ok('missing costs gated OFF by default', t.missingCosts.length===0);
ok('missing costs appear when included', takeoff({...WHITAKER,includeMissing:true}).missingCosts.length>0);
ok('Lever B tier 1 quantified (> $0)', lb.tier1Total>0, String(lb.tier1Total));
ok('Lever B tier 2 = supervision hrs × rate', near(lb.tier2Total, t.hours.supervisionHours*58, 1), String(lb.tier2Total));
ok('Lever B tier 3 carries NO dollars (never in the base)', lb.tier3.every(l=>l.extended==null));
ok('Lever B billable = tier1 + tier2 only', near(lb.billableTotal, lb.tier1Total+lb.tier2Total, 0.5));
ok('Lever B uplift = billable × (1 + fee)', near(lb.revenueUplift, lb.billableTotal*1.3, 1), String(lb.revenueUplift));
ok('Lever B still flagged gated', lb.gated===true && lb.warnings.length>=3);
ok('Permits unquantified until entered', lb.unquantified.includes('Permits'));
ok('caliche exposure computed (fraction of dig below 27in)', t.caliche.fractionOfDig>0.4 && t.caliche.fractionOfDig<0.7, String(t.caliche.fractionOfDig));
ok('caliche is a RANGE, not a point cost', t.caliche.contingencyHigh > t.caliche.contingencyLow);

// ── Coverage + back-test (PRD 02 Milestone 4) ────────────────────────────────
ok('budget by code produced', t.budgetByCode.length>0);
const bt = takeoff({...WHITAKER, actualJobCost:T.jobCost});
ok('back-test measures against ACTUAL job cost', bt.coverage.basis==='actual job cost');
ok('back-test exposes the unmodelled remainder', bt.backTest.unmodelled>0 && !bt.backTest.withinGate, `${bt.backTest.variancePct}%`);
ok('coverage flags every unpriced direct line', bt.coverage.unpricedDirectLines.length===8, String(bt.coverage.unpricedDirectLines.length));

// ── Back-solved residual: sizes the unknown, but makes the gate circular ─────
const withEq = takeoff({...WHITAKER, actualJobCost:T.jobCost, backSolveResidual:true,
  directLines: [{code:300,name:'Pool Equipment',extended:10000,confidence:'direct',basis:'entered'}]});
ok('residual forces job cost to the actual total', near(withEq.jobCost,T.jobCost,1), String(withEq.jobCost));
ok('residual back-test is flagged CIRCULAR', withEq.backTest.circular===true && withEq.backTest.variancePct===0);
ok('residual is excluded from substantiated direct cost', withEq.coverage.direct===10000, String(withEq.coverage.direct));
ok('residual counted as unsubstantiated, not coverage', withEq.coverage.residual>0 && withEq.coverage.unsubstantiatedPct>40, `${withEq.coverage.unsubstantiatedPct}%`);
ok('residual raises a warn flag', withEq.flags.some(f=>f.level==='warn'&&f.msg.includes('BACK-SOLVED RESIDUAL')));
ok('no residual line when back-solve is off', !takeoff({...WHITAKER,actualJobCost:T.jobCost}).directLines.some(l=>l.code===9999));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail?1:0);
