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

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail?1:0);
