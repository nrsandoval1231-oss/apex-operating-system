import { takeoff, marginFromFee, feeForMargin, price, poolGeometry, spaGeometry, combinedGeometry } from './engine.mjs';
let pass=0, fail=0;
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const ok=(n,c,extra='')=>{console.log((c?'PASS':'FAIL')+' '+n+(c?'':'  '+extra));c?pass++:fail++;};

// Foundation §1 — markup vs margin (load-bearing)
ok('marginFromFee(0.30)=23.08%', near(marginFromFee(0.30)*100, 23.08, 0.02), (marginFromFee(0.30)*100).toFixed(2));
ok('feeForMargin(0.30)=42.86%', near(feeForMargin(0.30)*100, 42.86, 0.02), (feeForMargin(0.30)*100).toFixed(2));
const wp = price(116955.18, 0.30);
ok('Whitaker revenue ≈ 152,041.73', near(wp.revenue, 152041.73, 0.5), wp.revenue.toFixed(2));
ok('Whitaker fee ≈ 35,086.55', near(wp.fee, 35086.55, 0.5), wp.fee.toFixed(2));
ok('Whitaker true margin ≈ 23.08%', near(wp.trueMargin*100, 23.08, 0.02), (wp.trueMargin*100).toFixed(2));

// Geometry vs reference §2
const pool = poolGeometry({length:14,width:24,avgDepth:4.75});
ok('pool surface 336', pool.surfaceArea===336);
ok('pool perimeter 76', pool.perimeter===76);
ok('pool wetted ≈ 749', near(pool.wettedArea,749,3), pool.wettedArea.toFixed(1));
ok('pool gallons ≈ 11,939', near(pool.gallons,11939,20), pool.gallons.toFixed(0));
const spa = spaGeometry({length:7,width:7,depth:3.5});
ok('spa wetted ≈ 172', near(spa.wettedArea,172,3), spa.wettedArea.toFixed(1));
const geo = combinedGeometry({length:14,width:24,avgDepth:4.75,spa:{length:7,width:7,depth:3.5}});
ok('combined wetted ≈ 921', near(geo.wettedArea,921,4), geo.wettedArea.toFixed(1));
ok('combined perimeter 104', geo.perimeter===104, String(geo.perimeter));
ok('combined gallons ≈ 13,222', near(geo.gallons,13222,30), geo.gallons.toFixed(0));

// Assemblies vs reference checks
const t = takeoff({length:14,width:24,avgDepth:4.75,spa:{length:7,width:7,depth:3.5}});
const gunite = t.lines.find(l=>l.name.includes('Gunite'));
ok('gunite ordered ≈ 28.3 yd³', near(gunite.qty,28.3,0.6), String(gunite.qty));
const plaster = t.lines.find(l=>l.name.includes('Plaster'));
ok('plaster area = 921 sq ft', near(plaster.qty,921,4), String(plaster.qty));
const rebar = t.lines.find(l=>l.name.includes('Rebar'));
ok('rebar steel ~1,084 lb (±20%)', near(rebar.qty,1084,220), String(rebar.qty));

// Pricing structure integrity
ok('fee charged on allowances (jobCost includes allowances)', t.jobCost > t.takeoffCost + t.directCost, `${t.jobCost} vs ${t.takeoffCost}`);
ok('trueMargin 23.08 at 0.30 fee', near(t.pricing.trueMarginPct,23.08,0.02), String(t.pricing.trueMarginPct));
ok('allowances default = 17,000', t.allowanceTotal===17000, String(t.allowanceTotal));
ok('supervision hours duration-driven (7×3×1.5=31.5)', t.hours.supervisionHours===31.5, String(t.hours.supervisionHours));
ok('missing costs gated OFF by default', t.missingCosts.length===0);
ok('missing costs appear when included', takeoff({length:14,width:24,avgDepth:4.75,includeMissing:true}).missingCosts.length>0);
ok('budget by code produced', t.budgetByCode.length>0);

// ── v0.2: parametric fixes ───────────────────────────────────────────────────
// Spa excavation was hardcoded at 11 yd³ — spa dimensions were silently ignored.
const excOf = (i) => takeoff(i).lines.find(l=>l.code===200);
const smallSpa = excOf({length:14,width:24,avgDepth:4.75,spa:{length:7,width:7,depth:3.5}});
const bigSpa   = excOf({length:14,width:24,avgDepth:4.75,spa:{length:10,width:10,depth:4}});
ok('spa excavation is parametric (10×10 digs more than 7×7)', bigSpa.qty > smallSpa.qty + 5, `${smallSpa.qty} vs ${bigSpa.qty}`);
ok('Whitaker spa bank ≈ 11 yd³ (reproduces the old constant)', near(smallSpa.extra.spaBank,11,0.5), String(smallSpa.extra.spaBank));
ok('pool bank ≈ 78 yd³ (ref §200)', near(smallSpa.extra.poolBank,78,1.5), String(smallSpa.extra.poolBank));

// Steps/seat scale with size rather than sitting at a fixed 50/25.
const small = poolGeometry({length:14,width:24,avgDepth:4.75});
const big   = poolGeometry({length:20,width:40,avgDepth:5.5});
ok('steps area scales with pool size', big.stepsArea > small.stepsArea*1.5, `${small.stepsArea.toFixed(1)} vs ${big.stepsArea.toFixed(1)}`);

// Slope run must follow the LONG axis whichever field it lands in.
const a = poolGeometry({length:14,width:24,depthShallow:3.5,depthDeep:6});
const b = poolGeometry({length:24,width:14,depthShallow:3.5,depthDeep:6});
ok('dimension order does not change wetted area (14×24 == 24×14)', near(a.wettedArea,b.wettedArea,0.01), `${a.wettedArea.toFixed(2)} vs ${b.wettedArea.toFixed(2)}`);
ok('depth-profile wetted ≈ 921 (ref §2)', near(a.wettedArea+172,921,1), (a.wettedArea+172).toFixed(2));

// Consistency test (PRD 02 success criteria: two estimators within 5%).
const c1 = takeoff({length:14,width:24,depthShallow:3.5,depthDeep:6,spa:{length:7,width:7,depth:3.5}});
const c2 = takeoff({length:24,width:14,avgDepth:4.75,spa:{width:7,length:7,depth:3.5}});
ok('two equivalent entries land within 5% on job cost', Math.abs(c1.jobCost-c2.jobCost)/c1.jobCost < 0.05, `${c1.jobCost} vs ${c2.jobCost}`);

ok('plaster bags = 44 (ref §800)', c1.lines.find(l=>l.name.includes('Plaster')).extra.bags===44, String(c1.lines.find(l=>l.name.includes('Plaster')).extra.bags));
ok('rebar exposes LF #3 allocation basis', c1.lines.find(l=>l.name.includes('Rebar')).allocationBasis?.metric==='LF #3 bar');

// ── v0.2: derived build calendar (Foundation §8) ─────────────────────────────
ok('build weeks DERIVED, lands in ref 6–8 wk window', c1.schedule.buildWeeks>=6 && c1.schedule.buildWeeks<=8, String(c1.schedule.buildWeeks));
ok('explicit buildWeeks still overrides', takeoff({length:14,width:24,avgDepth:4.75,buildWeeks:10}).hours.supervisionHours===45);
const bigJob = takeoff({length:20,width:40,avgDepth:5.5,spa:{length:8,width:8,depth:3.5}});
ok('supervision is duration-driven, NOT proportional to cost', (bigJob.hours.supervisionHours/c1.hours.supervisionHours) < (bigJob.jobCost/c1.jobCost), `sup ×${(bigJob.hours.supervisionHours/c1.hours.supervisionHours).toFixed(2)} vs cost ×${(bigJob.jobCost/c1.jobCost).toFixed(2)}`);

// ── v0.2: Lever B is QUANTIFIED, still gated (Foundation §3.1) ───────────────
const lb = c1.leverB;
ok('Lever B tier 1 quantified (> $0)', lb.tier1Total>0, String(lb.tier1Total));
ok('Lever B tier 2 = supervision hrs × rate', near(lb.tier2Total, c1.hours.supervisionHours*58, 1), String(lb.tier2Total));
ok('Lever B tier 3 carries NO dollars (never in the base)', lb.tier3.every(l=>l.extended==null));
ok('Lever B billable = tier1 + tier2 only', near(lb.billableTotal, lb.tier1Total+lb.tier2Total, 0.5));
ok('Lever B uplift = billable × (1 + fee)', near(lb.revenueUplift, lb.billableTotal*1.3, 1), String(lb.revenueUplift));
ok('Lever B still flagged gated', lb.gated===true && lb.warnings.length>=3);
ok('Permits unquantified until entered (shows $0.00 on estimate)', lb.unquantified.includes('Permits'));
ok('caliche exposure computed (~57% of dig below 27in)', c1.caliche.fractionOfDig>0.4 && c1.caliche.fractionOfDig<0.7, String(c1.caliche.fractionOfDig));
ok('caliche is a RANGE, not a point cost', c1.caliche.contingencyHigh > c1.caliche.contingencyLow);

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail?1:0);
