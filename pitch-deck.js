/**
 * pitch.js — Apex, the argument in four slides.
 *
 * The 20-slide deck is a findings document. This is a PITCH: one argument, four beats,
 * built to end in a decision.
 *   1. Your prices are right, your paperwork can't prove it   (credibility, then the problem)
 *   2. Now every figure has a quantity behind it              (the proof)
 *   3. Two findings worth money                               (the value)
 *   4. One thing I need                                       (the ask)
 *
 * Same standing rule as the long deck: the 23.08% margin finding is NOT in here.
 */
const pptxgen = require('pptxgenjs');

const C = {
  char: '1B1C1E', char2: '25272A', steel: '54585E', paper: 'F6F4EF',
  concrete: 'E9E5DE', line: 'D4CFC5', amber: 'E0901B', amberD: '95560A',
  pool: '0E6E7C', ok: '2F8250', low: 'B0472E', white: 'FFFFFF', mute: '9E968B',
};
const HEAD = 'Cambria';
const BODY = 'Calibri';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Apex';
pres.title = 'Apex — the short version';

const M = 0.7;
const W = 11.9;

const kicker = (s, text) => s.addText(text, {
  x: M, y: 0.55, w: W, h: 0.28, fontFace: BODY, fontSize: 11, bold: true,
  color: C.amber, charSpacing: 2.4, margin: 0, valign: 'top',
});
const card = (s, x, y, w, h, fill) => s.addShape(pres.ShapeType.roundRect, {
  x, y, w, h, rectRadius: 0.06, fill: { color: fill || C.white },
  line: { color: C.line, width: 0.75 },
  shadow: { type: 'outer', color: '9C9C9C', blur: 6, offset: 1, angle: 90, opacity: 0.18 },
});
const tick = (s, x, y) => s.addShape(pres.ShapeType.ellipse, {
  x, y, w: 0.2, h: 0.2, fill: { color: C.ok },
});

// ═══════════════ 1 · THE PROBLEM (dark) ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.char };
  s.addShape(pres.ShapeType.ellipse, {
    x: 10.4, y: -1.0, w: 4.4, h: 4.4, fill: { color: C.amber, transparency: 90 },
  });
  kicker(s, 'APEX  ·  WHAT WE FOUND');
  s.addText('Your prices are right.\nYour paperwork can’t prove it.', {
    x: M, y: 1.25, w: 10.6, h: 2.0, fontFace: HEAD, fontSize: 38, bold: true,
    color: C.white, margin: 0, lineSpacing: 48, valign: 'top',
  });

  s.addText('0', {
    x: M, y: 3.5, w: 1.8, h: 1.5, fontFace: HEAD, fontSize: 82, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText('quantities anywhere\non your estimate', {
    x: M, y: 5.02, w: 4.4, h: 0.8, fontFace: BODY, fontSize: 15, bold: true, color: C.white, margin: 0, lineSpacing: 20, valign: 'top',
  });

  const rates = [
    ['Gunite  $439.56 / yd³', 'inside the published $350–600'],
    ['Plaster  $87.21 / bag', 'Diamond Brite range'],
    ['Decking  $13.59 / sq ft', 'inside the published $12–18'],
  ];
  rates.forEach((r, i) => {
    const y = 3.62 + i * 0.78;
    tick(s, 6.3, y + 0.06);
    s.addText(r[0], {
      x: 6.68, y, w: 5.6, h: 0.32, fontFace: BODY, fontSize: 15, bold: true, color: C.white, margin: 0, valign: 'top',
    });
    s.addText(r[1], {
      x: 6.68, y: y + 0.32, w: 5.6, h: 0.3, fontFace: BODY, fontSize: 12, color: C.mute, margin: 0, valign: 'top',
    });
  });

  s.addText('These are cost-plus contracts. “Rebar — $4,000” with nothing behind it is a number you cannot defend.', {
    x: M, y: 6.35, w: 11.6, h: 0.5, fontFace: BODY, fontSize: 14, italic: true, color: C.concrete, margin: 0, valign: 'top',
  });
  s.addNotes('Open on credibility: his rates are good. Then the problem is documentation, not pricing.');
}

// ═══════════════ 2 · THE PROOF ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'WHAT WE BUILT');
  s.addText('Now every figure has a quantity behind it', {
    x: M, y: 0.95, w: W, h: 0.7, fontFace: HEAD, fontSize: 32, bold: true, color: C.char, margin: 0, valign: 'top',
  });

  const flow = [
    ['You type two numbers', '14 × 24 pool, 6 × 6 spa', C.pool],
    ['It derives the quantities', '887 sq ft wetted · 27.3 yd³ gunite\n43 bags plaster · 2,041 LF of #3 bar', C.amber],
    ['It returns your dollars', '$5,500 excavation · $12,000 gunite\n$20,750 finishes', C.ok],
  ];
  // Step 1.34 with h 1.18 leaves a 0.30in gap above the callout at 6.11.
  // At the original 1.42/1.24 the third card's bottom edge landed 0.02in off it.
  flow.forEach((f, i) => {
    const y = 1.95 + i * 1.34;
    card(s, M, y, 5.4, 1.18);
    s.addShape(pres.ShapeType.ellipse, { x: M + 0.28, y: y + 0.22, w: 0.3, h: 0.3, fill: { color: f[2] } });
    s.addText(String(i + 1), {
      x: M + 0.28, y: y + 0.22, w: 0.3, h: 0.3, align: 'center', valign: 'middle', margin: 0,
      fontFace: BODY, fontSize: 12, bold: true, color: C.white,
    });
    s.addText(f[0], {
      x: M + 0.7, y: y + 0.2, w: 4.4, h: 0.32, fontFace: HEAD, fontSize: 14.5, bold: true, color: C.char, margin: 0, valign: 'middle',
    });
    s.addText(f[1], {
      x: M + 0.28, y: y + 0.58, w: 4.9, h: 0.52, fontFace: BODY, fontSize: 11.5, color: C.steel, margin: 0, lineSpacing: 15, valign: 'top',
    });
  });

  const hdr = (t, al) => ({ text: t, options: { fontFace: BODY, fontSize: 10.5, bold: true, color: C.white, fill: { color: C.char }, align: al || 'left', valign: 'middle', margin: 0.07 } });
  const cel = (t, al, bold, col) => ({ text: t, options: { fontFace: BODY, fontSize: 12, bold: !!bold, color: col || C.char, align: al || 'left', valign: 'middle', margin: 0.07 } });
  s.addTable([
    [hdr('Checked against your estimate'), hdr('Model', 'right'), hdr('Yours', 'right'), hdr('', 'right')],
    [cel('200  Excavation'), cel('$7,000', 'right'), cel('$7,000', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('400  Pool shell'), cel('$16,801', 'right'), cel('$16,800', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('800  Pool finishes'), cel('$20,750', 'right'), cel('$20,750', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('1000  Pool deck'), cel('$10,001', 'right'), cel('$10,000', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('Total', 'left', true), cel('$61,552', 'right', true), cel('$61,550', 'right', true), cel('0.0%', 'right', true, C.ok)],
  ], {
    x: 6.5, y: 1.95, w: 6.1, colW: [2.7, 1.15, 1.15, 1.1], rowH: 0.46,
    border: { type: 'solid', color: C.line, pt: 0.75 }, fill: { color: C.white },
  });
  s.addText('Built from the dimensions alone, then compared — not fitted to the answer.', {
    x: 6.5, y: 4.9, w: 6.1, h: 0.5, fontFace: BODY, fontSize: 12, italic: true, color: C.steel, margin: 0, valign: 'top',
  });

  card(s, M, 6.11, W, 0.95, C.concrete);
  s.addText([
    { text: 'Same document, same figures. ', options: { bold: true, color: C.char } },
    { text: 'Your customers see no change and nobody has to be retrained.', options: { color: C.char } },
  ], { x: M + 0.35, y: 6.32, w: W - 0.7, h: 0.5, fontFace: BODY, fontSize: 13.5, margin: 0, valign: 'top' });
}

// ═══════════════ 3 · THE VALUE ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'WHAT IT FOUND');
  s.addText('Two findings worth money', {
    x: M, y: 0.95, w: W, h: 0.7, fontFace: HEAD, fontSize: 32, bold: true, color: C.char, margin: 0, valign: 'top',
  });

  card(s, M, 1.95, 5.8, 3.5, C.char);
  s.addText('~$13,750', {
    x: M + 0.38, y: 2.2, w: 5.0, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText('a pool of standard scope that is not on your estimates', {
    x: M + 0.38, y: 3.1, w: 5.0, h: 0.55, fontFace: BODY, fontSize: 14, bold: true, color: C.white, margin: 0, lineSpacing: 18, valign: 'top',
  });
  s.addText('Permits · geotech report · structural engineering · gas line for the heater · fill and curing water · labour burden · supervision', {
    x: M + 0.38, y: 3.75, w: 5.05, h: 1.0, fontFace: BODY, fontSize: 11.5, color: C.concrete, margin: 0, lineSpacing: 15, valign: 'top',
  });
  s.addText('Work you already do and are not reimbursed for.', {
    x: M + 0.38, y: 4.85, w: 5.05, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, italic: true, color: C.amber, margin: 0, valign: 'top',
  });

  card(s, 6.8, 1.95, 5.8, 3.5);
  s.addText('Three, not five', {
    x: 7.18, y: 2.2, w: 5.0, h: 0.9, fontFace: HEAD, fontSize: 40, bold: true, color: C.char, margin: 0, valign: 'top',
  });
  s.addText('jobs running at once — same pools per year either way', {
    x: 7.18, y: 3.1, w: 5.0, h: 0.55, fontFace: BODY, fontSize: 14, bold: true, color: C.char, margin: 0, lineSpacing: 18, valign: 'top',
  });
  s.addText('You have one crew, and it is fully loaded at three jobs. A fourth and fifth do not produce more pools — they add about five weeks of waiting for every customer, and more supervision time for you.', {
    x: 7.18, y: 3.75, w: 5.05, h: 1.0, fontFace: BODY, fontSize: 11.5, color: C.steel, margin: 0, lineSpacing: 15, valign: 'top',
  });
  s.addText('Free to act on, starting this week.', {
    x: 7.18, y: 4.85, w: 5.05, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, italic: true, color: C.ok, margin: 0, valign: 'top',
  });

  s.addText('The first needs a decision from you. The second just needs you to stop starting a fourth job.', {
    x: M, y: 5.75, w: W, h: 0.5, fontFace: BODY, fontSize: 13.5, italic: true, color: C.steel, margin: 0, valign: 'top',
  });
}

// ═══════════════ 4 · THE ASK (dark) ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.char };
  s.addShape(pres.ShapeType.ellipse, {
    x: 10.2, y: 4.3, w: 4.0, h: 4.0, fill: { color: C.amber, transparency: 90 },
  });
  kicker(s, 'THE ASK');
  s.addText('One thing I need from you', {
    x: M, y: 0.95, w: W, h: 0.7, fontFace: HEAD, fontSize: 32, bold: true, color: C.white, margin: 0, valign: 'top',
  });

  s.addText('Your cost-plus agreement', {
    x: M, y: 2.05, w: 10.4, h: 0.95, fontFace: HEAD, fontSize: 46, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText('So we can see what it defines as reimbursable cost. Every dollar of that $13,750 waits on this one document — expanding what counts as cost beyond what the contract allows is not something to guess at.', {
    x: M, y: 3.2, w: 9.4, h: 1.1, fontFace: BODY, fontSize: 15, color: C.concrete, margin: 0, lineSpacing: 22, valign: 'top',
  });

  s.addText('And two things that cost nothing', {
    x: M, y: 4.6, w: 9.4, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, color: C.mute, charSpacing: 1.4, margin: 0, valign: 'top',
  });
  [
    ['Cap builds at three at a time', 'Same output, five weeks faster for every customer.'],
    ['Log crew days on the next two jobs', 'One number per phase. Turns the capacity picture into fact.'],
  ].forEach((a, i) => {
    const y = 5.05 + i * 0.72;
    s.addShape(pres.ShapeType.ellipse, { x: M, y: y + 0.04, w: 0.34, h: 0.34, fill: { color: C.amber } });
    s.addText(String(i + 1), {
      x: M, y: y + 0.04, w: 0.34, h: 0.34, align: 'center', valign: 'middle', margin: 0,
      fontFace: BODY, fontSize: 12.5, bold: true, color: C.char,
    });
    s.addText(a[0], {
      x: M + 0.52, y, w: 4.6, h: 0.32, fontFace: HEAD, fontSize: 15, bold: true, color: C.white, margin: 0, valign: 'top',
    });
    s.addText(a[1], {
      x: M + 5.2, y: y + 0.02, w: 5.0, h: 0.32, fontFace: BODY, fontSize: 12, color: C.mute, margin: 0, valign: 'top',
    });
  });

  s.addNotes('Close here. One document is the whole ask. The two free actions give him something to say yes to immediately.');
}

const out = process.argv[2] || 'apex-pitch.pptx';
pres.writeFile({ fileName: out }).then(() => console.log('wrote ' + out));
