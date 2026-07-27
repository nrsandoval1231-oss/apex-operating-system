/**
 * Apex strategy deck — findings & decisions.
 *
 * Rebuild of apex-strategy-deck.pptx. The original was a PROPOSAL deck (here is the plan);
 * this is a PROOF deck (here is what we found, what we built, what it revealed, what we need).
 *
 * Held back deliberately, per standing instruction: the 23.08% margin finding. Everything here
 * stands without it — the Lever B argument is "standard scope missing from your estimate", which
 * needs no reveal. Commission language stays at "reconciled profit".
 * No pricing slide.
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
pres.layout = 'LAYOUT_WIDE'; // 13.3 x 7.5 — must be set before any slide
pres.author = 'Apex';
pres.title = 'Apex — Findings & Decisions';

const M = 0.7;   // left margin
const W = 11.9;  // content width
const NOTE_Y = 6.4; // one baseline for every footnote, so bottom margins match across slides

// ── helpers (each returns a FRESH object — pptxgenjs mutates options in place) ──
const title = (s, text, dark) => s.addText(text, {
  x: M, y: 0.48, w: W, h: 0.9, fontFace: HEAD, fontSize: 34, bold: true,
  color: dark ? C.white : C.char, margin: 0, valign: 'top',
});
const kicker = (s, text) => s.addText(text, {
  x: M, y: 0.2, w: W, h: 0.28, fontFace: BODY, fontSize: 10.5, bold: true,
  color: C.amber, charSpacing: 2.2, margin: 0,
});
const card = (s, x, y, w, h, fill) => s.addShape(pres.ShapeType.roundRect, {
  x, y, w, h, rectRadius: 0.06, fill: { color: fill || C.white },
  line: { color: C.line, width: 0.75 },
  shadow: { type: 'outer', color: '9C9C9C', blur: 6, offset: 1, angle: 90, opacity: 0.18 },
});
const numDot = (s, x, y, n, d) => {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: 0.4, h: 0.4, fill: { color: d ? C.amber : C.char } });
  s.addText(String(n), {
    x, y, w: 0.4, h: 0.4, align: 'center', valign: 'middle', margin: 0,
    fontFace: BODY, fontSize: 14, bold: true, color: d ? C.char : C.white,
  });
};
const note = (s, text) => s.addText(text, {
  x: M, y: NOTE_Y, w: W, h: 0.5, fontFace: BODY, fontSize: 12, color: C.steel, italic: true, margin: 0, valign: 'top',
});

// ═══════════════ 1 · TITLE (dark) ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.char };
  s.addShape(pres.ShapeType.ellipse, {
    x: 9.4, y: 1.0, w: 5.2, h: 5.2, fill: { color: C.amber, transparency: 88 }, line: { color: C.amber, width: 1, transparency: 70 },
  });
  s.addText('APEX  ·  LUBBOCK, TEXAS', {
    x: M, y: 1.5, w: 8, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.amber, charSpacing: 2.6, margin: 0,
  });
  s.addText('Operational\nModernization', {
    x: M, y: 2.05, w: 8.4, h: 1.9, fontFace: HEAD, fontSize: 46, bold: true, color: C.white, lineSpacing: 50, margin: 0, valign: 'top',
  });
  s.addText('Findings & Decisions', {
    x: M, y: 4.15, w: 8, h: 0.45, fontFace: HEAD, fontSize: 23, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText('What we found, what we built, and what we need from you.', {
    x: M, y: 4.75, w: 8, h: 0.4, fontFace: BODY, fontSize: 15, color: C.concrete, margin: 0, valign: 'top',
  });
  s.addText('July 2026', {
    x: M, y: 6.55, w: 4, h: 0.3, fontFace: BODY, fontSize: 11.5, color: C.mute, margin: 0, valign: 'top',
  });
  s.addNotes('Reframe deck. Opens on what was asked, pivots to what was found, closes on decisions. The margin finding is deliberately not in here.');
}

// ═══════════════ 2 · WHERE THIS STARTED ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'THE BRIEF');
  title(s, 'Where this started');

  const asks = [
    'Standardize how commissions are calculated and paid',
    'Track costs and know real profit per job',
    'See close rates and conversion by vertical',
    'A CRM that actually holds the pipeline',
    'Project management across all four verticals',
  ];
  asks.forEach((t, i) => {
    const y = 1.9 + i * 0.68;
    numDot(s, M, y, i + 1);
    s.addText(t, {
      x: M + 0.58, y: y - 0.02, w: 5.6, h: 0.45, fontFace: BODY, fontSize: 13.5, color: C.char, margin: 0, valign: 'middle',
    });
  });

  card(s, 7.1, 1.8, 5.5, 3.7, C.char);
  s.addText('This is not an AI problem.', {
    x: 7.45, y: 2.12, w: 4.8, h: 0.4, fontFace: HEAD, fontSize: 19, bold: true, color: C.white, margin: 0, valign: 'top',
  });
  s.addText('It is a data spine problem.', {
    x: 7.45, y: 2.56, w: 4.8, h: 0.4, fontFace: HEAD, fontSize: 19, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText(
    'Every item on that list needs the same thing first: numbers that connect. Today the estimate, ' +
    'the books and the schedule share no common key — so none of those questions can be answered, ' +
    'no matter which software gets bought.\n\nAI layered on disconnected spreadsheets only makes the mess run faster.',
    { x: 7.45, y: 3.15, w: 4.85, h: 2.1, fontFace: BODY, fontSize: 12.5, color: C.concrete, margin: 0, lineSpacing: 17, valign: 'top' },
  );
  note(s, 'So the work started with the one document everything else depends on: the estimate.');
}

// ═══════════════ 3 · THE PROBLEM ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'FINDING 01');
  title(s, 'The estimate is a price list, not a takeoff');

  card(s, M, 1.9, 6.0, 2.7);
  s.addText('FROM YOUR ESTIMATE', {
    x: M + 0.35, y: 2.18, w: 5.3, h: 0.25, fontFace: BODY, fontSize: 9.5, bold: true, color: C.steel, charSpacing: 1.8, margin: 0, valign: 'top',
  });
  // Two boxes per row — space-padding a single string does not align a decimal column.
  [['Rebar / Rebar Labor', '$4,000.00', 2.62], ['Gunite', '$12,000.00', 3.08]].forEach((r) => {
    s.addText(r[0], { x: M + 0.35, y: r[2], w: 3.0, h: 0.4, fontFace: BODY, fontSize: 17, color: C.char, margin: 0, valign: 'middle' });
    s.addText(r[1], { x: M + 3.4, y: r[2], w: 2.25, h: 0.4, fontFace: BODY, fontSize: 17, bold: true, color: C.char, margin: 0, align: 'right', valign: 'middle' });
  });
  s.addText('No quantity. No unit cost. Nothing to check it against.', {
    x: M + 0.35, y: 3.68, w: 5.3, h: 0.4, fontFace: BODY, fontSize: 12.5, italic: true, color: C.low, margin: 0, valign: 'top',
  });

  s.addText('0', {
    x: 7.3, y: 1.75, w: 1.7, h: 1.5, fontFace: HEAD, fontSize: 76, bold: true, color: C.amber, margin: 0, align: 'left', valign: 'top',
  });
  s.addText('quantities anywhere on the document', {
    x: 7.3, y: 3.2, w: 5.2, h: 0.35, fontFace: BODY, fontSize: 13, bold: true, color: C.char, margin: 0, valign: 'top',
  });
  s.addText(
    'These are cost-plus contracts, and cost-plus agreements commonly carry audit rights. ' +
    '$4,000 for rebar with no basis behind it is a number that cannot be defended if a customer ' +
    'ever asks — and it is every line, on every estimate.',
    { x: 7.3, y: 3.68, w: 5.3, h: 1.6, fontFace: BODY, fontSize: 13, color: C.char, margin: 0, lineSpacing: 18, valign: 'top' },
  );
  note(s, 'The pricing is not the problem. The absence of a basis for it is.');
}

// ═══════════════ 4 · WHAT WE BUILT ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'THE BUILD');
  title(s, 'A quantity layer behind your estimate');

  const steps = [
    ['Dimensions in', '14 × 24 pool with a 6 × 6 spa.\nThat is the whole input.', C.pool],
    ['Quantities derived', '887 sq ft wetted surface\n100 LF perimeter · 12,881 gallons\n92.3 bank yd³ · 27.3 yd³ gunite\n2,041 LF of #3 bar · 43 bags plaster', C.amber],
    ['Same dollars out', '$5,500 excavation\n$12,000 gunite\n$4,000 rebar\n$20,750 finishes', C.ok],
  ];
  steps.forEach((st, i) => {
    const x = M + i * 4.03;
    card(s, x, 1.85, 3.75, 2.8);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.32, y: 2.12, w: 0.34, h: 0.34, fill: { color: st[2] } });
    s.addText(String(i + 1), {
      x: x + 0.32, y: 2.12, w: 0.34, h: 0.34, align: 'center', valign: 'middle', margin: 0,
      fontFace: BODY, fontSize: 12.5, bold: true, color: C.white,
    });
    s.addText(st[0], {
      x: x + 0.78, y: 2.12, w: 2.8, h: 0.34, fontFace: HEAD, fontSize: 15, bold: true, color: C.char, margin: 0, valign: 'middle',
    });
    // valign top, or a 2-line card centres its text lower than a 4-line neighbour.
    s.addText(st[1], {
      x: x + 0.32, y: 2.68, w: 3.15, h: 1.8, fontFace: BODY, fontSize: 12, color: C.steel, margin: 0, lineSpacing: 16, valign: 'top',
    });
  });

  card(s, M, 4.95, W, 1.15, C.concrete);
  s.addText([
    { text: 'Your estimate keeps its exact shape. ', options: { bold: true, color: C.char } },
    { text: 'Same sections, same line names, same figures — every one now with a quantity behind it. Nobody retrains, and the customer-facing document does not change.', options: { color: C.char } },
  ], { x: M + 0.35, y: 5.15, w: W - 0.7, h: 0.8, fontFace: BODY, fontSize: 13.5, margin: 0, lineSpacing: 19, valign: 'top' });
}

// ═══════════════ 5 · THE PROOF ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'FINDING 02  ·  THE PROOF');
  title(s, 'It reproduces your estimate exactly');

  const hdr = (t, al) => ({ text: t, options: { fontFace: BODY, fontSize: 11, bold: true, color: C.white, fill: { color: C.char }, align: al || 'left', valign: 'middle', margin: 0.08 } });
  const cel = (t, al, bold, col) => ({ text: t, options: { fontFace: BODY, fontSize: 12.5, bold: !!bold, color: col || C.char, align: al || 'left', valign: 'middle', margin: 0.08 } });

  const rows = [
    [hdr('Cost code'), hdr('Model', 'right'), hdr('Your estimate', 'right'), hdr('Variance', 'right')],
    [cel('200  Excavation'), cel('$7,000', 'right'), cel('$7,000', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('400  Pool Shell Construction'), cel('$16,801', 'right'), cel('$16,800', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('800  Pool Finishes'), cel('$20,750', 'right'), cel('$20,750', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('1000  Pool Deck'), cel('$10,001', 'right'), cel('$10,000', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('1300  Additional Upgrades'), cel('$7,000', 'right'), cel('$7,000', 'right'), cel('exact', 'right', true, C.ok)],
    [cel('Total, modelled codes', 'left', true), cel('$61,552', 'right', true), cel('$61,550', 'right', true), cel('0.0%', 'right', true, C.ok)],
  ];
  s.addTable(rows, {
    x: M, y: 1.85, w: 7.9, colW: [3.4, 1.5, 1.7, 1.3], rowH: 0.46,
    border: { type: 'solid', color: C.line, pt: 0.75 }, fill: { color: C.white },
  });

  card(s, 8.9, 1.85, 3.7, 3.55, C.char);
  s.addText('Whitaker Oasis', {
    x: 9.2, y: 2.12, w: 3.1, h: 0.32, fontFace: HEAD, fontSize: 16, bold: true, color: C.white, margin: 0, valign: 'top',
  });
  s.addText('14 × 24 pool with spa', {
    x: 9.2, y: 2.47, w: 3.1, h: 0.3, fontFace: BODY, fontSize: 12, color: C.mute, margin: 0, valign: 'top',
  });
  s.addText(
    'Built from dimensions alone, then checked against the real estimate line by line.\n\n' +
    'Not fitted to the answer — derived, then compared. Six of your finishes lines, ' +
    'the excavation, the shell and the deck all land on the dollar.',
    { x: 9.2, y: 2.95, w: 3.15, h: 2.2, fontFace: BODY, fontSize: 12, color: C.concrete, margin: 0, lineSpacing: 16, valign: 'top' },
  );
  note(s, 'The same model then priced a 15 × 30 with a spa from nothing but those two dimensions.');
}

// ═══════════════ 6 · YOUR NUMBERS ARE GOOD ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'WHAT THAT PROVES');
  title(s, 'Your pricing instincts are already right');

  const stats = [
    ['$439.56', 'per yd³ of gunite', 'Published range $350–600'],
    ['$87.21', 'per bag of plaster', 'Diamond Brite territory'],
    ['$13.59', 'per sq ft of decking', 'Published range $12–18'],
  ];
  stats.forEach((st, i) => {
    const x = M + i * 4.03;
    card(s, x, 1.85, 3.75, 2.3);
    s.addText(st[0], {
      x: x + 0.32, y: 2.08, w: 3.1, h: 0.8, fontFace: HEAD, fontSize: 40, bold: true, color: C.amber, margin: 0, valign: 'top',
    });
    s.addText(st[1], {
      x: x + 0.32, y: 2.91, w: 3.1, h: 0.3, fontFace: BODY, fontSize: 13.5, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(st[2], {
      x: x + 0.32, y: 3.25, w: 3.1, h: 0.6, fontFace: BODY, fontSize: 11.5, color: C.ok, margin: 0, valign: 'top',
    });
  });

  s.addText('The gap is documentation, not competence.', {
    x: M, y: 4.55, w: W, h: 0.45, fontFace: HEAD, fontSize: 24, bold: true, color: C.char, margin: 0, valign: 'top',
  });
  s.addText(
    'Every rate we back-solved from your estimate lands inside published industry ranges. ' +
    'The numbers in your head are well calibrated — they simply cannot transfer to anyone else, ' +
    'scale past what you personally price, or be shown to a customer who asks.',
    { x: M, y: 5.1, w: 9.6, h: 1.3, fontFace: BODY, fontSize: 14, color: C.steel, margin: 0, lineSpacing: 20, valign: 'top' },
  );
}

// ═══════════════ 7 · WHAT'S MISSING ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'FINDING 03');
  title(s, 'What the estimate leaves out');

  card(s, M, 1.85, 4.0, 2.7, C.char);
  s.addText('~$13,750', {
    x: M + 0.32, y: 2.15, w: 3.4, h: 0.85, fontFace: HEAD, fontSize: 40, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText('per pool', {
    x: M + 0.32, y: 3.02, w: 3.4, h: 0.3, fontFace: BODY, fontSize: 14, bold: true, color: C.white, margin: 0, valign: 'top',
  });
  s.addText('of standard scope that is nowhere on the document', {
    x: M + 0.32, y: 3.4, w: 3.4, h: 0.85, fontFace: BODY, fontSize: 12, color: C.concrete, margin: 0, lineSpacing: 16, valign: 'top',
  });

  const missing = [
    'Permits — a live line showing $0.00',
    'Geotechnical / soil report',
    'Structural engineering',
    'Gas line for the heater',
    'Freeze protection and seasonal work',
    'Water to fill, and water to cure the shell',
    'Startup chemicals',
    'Gunite rebound haul-off',
    'Labour burden',
    'Project management and supervision',
  ];
  s.addText(missing.map((t, i) => ({
    text: t, options: { bullet: { indent: 14 }, breakLine: i !== missing.length - 1 },
  })), {
    x: 5.05, y: 1.88, w: 3.7, h: 3.6, fontFace: BODY, fontSize: 12.5, color: C.char, margin: 0, paraSpaceAfter: 5, valign: 'top',
  });

  card(s, 8.95, 1.85, 3.65, 3.6, C.concrete);
  s.addText('Why it matters', {
    x: 9.25, y: 2.12, w: 3.1, h: 0.3, fontFace: HEAD, fontSize: 15, bold: true, color: C.char, margin: 0, valign: 'top',
  });
  s.addText(
    'These are not upgrades or extras. They are standard scope on every pool you build.\n\n' +
    'Because they are not on the estimate, they are not reimbursed — so they come out of your ' +
    'profit rather than the job.\n\n' +
    'They also surface mid-build as change orders, which is the conversation that costs a referral.',
    { x: 9.25, y: 2.55, w: 3.1, h: 2.75, fontFace: BODY, fontSize: 12, color: C.char, margin: 0, lineSpacing: 16, valign: 'top' },
  );
  note(s, 'Modelled on a Whitaker-sized job. Some items still need a real quote to firm up.');
}

// ═══════════════ 8 · THE GATE (dark) ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.char };
  // Bottom-right, clear of every text block — at bottom-left its hard edge cut through the copy.
  s.addShape(pres.ShapeType.ellipse, {
    x: 10.6, y: 4.1, w: 3.6, h: 3.6, fill: { color: C.amber, transparency: 90 },
  });
  kicker(s, 'THE ONE THING THAT UNLOCKS IT');
  title(s, 'A question only you can answer', true);

  s.addText('What does your cost-plus agreement\ndefine as reimbursable cost?', {
    x: M, y: 2.15, w: 10.0, h: 1.7, fontFace: HEAD, fontSize: 33, bold: true, color: C.amber, margin: 0, lineSpacing: 44, valign: 'top',
  });
  s.addText(
    'Until that is answered, none of the $13,750 can move. Expanding what counts as reimbursable ' +
    'cost beyond what the contract actually allows looks like padding — and cost-plus agreements ' +
    'commonly carry audit rights, so guessing is the one thing we should not do.',
    { x: M, y: 4.25, w: 9.3, h: 1.4, fontFace: BODY, fontSize: 15, color: C.concrete, margin: 0, lineSpacing: 22, valign: 'top' },
  );
  s.addText('It is one question, to one person, worth about $13,750 on every pool you sell.', {
    x: M, y: 5.85, w: 9.3, h: 0.5, fontFace: BODY, fontSize: 14, bold: true, italic: true, color: C.white, margin: 0, valign: 'top',
  });
  s.addNotes('The oldest unanswered question in the project and the highest value one. If only one thing moves, it should be this.');
}

// ═══════════════ 9 · CAPACITY ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'FINDING 04');
  title(s, 'Your crew is the ceiling, not your pipeline');

  s.addChart(pres.ChartType.bar, [{
    name: 'Pools per year',
    labels: ['1 job', '2 jobs', '3 jobs', '4 jobs', '5 jobs'],
    values: [6.7, 13.3, 19, 19, 19],
  }], {
    x: M, y: 1.8, w: 7.0, h: 3.6,
    barDir: 'col', chartColors: [C.pool, C.pool, C.amber, C.steel, C.steel],
    varyColors: true, showLegend: false,
    showTitle: true, title: 'Pools completed per year, by jobs in flight',
    titleFontFace: BODY, titleFontSize: 12, titleColor: C.steel,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontFace: BODY,
    dataLabelFontSize: 11, dataLabelColor: C.char, dataLabelFormatCode: '0.0',
    catAxisLabelColor: C.steel, catAxisLabelFontFace: BODY, catAxisLabelFontSize: 11,
    valAxisLabelColor: C.steel, valAxisLabelFontFace: BODY, valAxisLabelFontSize: 10,
    valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' },
    valAxisMinVal: 0, valAxisMaxVal: 25, valAxisMajorUnit: 5,
  });

  card(s, 8.15, 1.8, 4.45, 3.6, C.char);
  s.addText('13.7', {
    x: 8.45, y: 2.02, w: 3.8, h: 0.7, fontFace: HEAD, fontSize: 36, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText('crew-days per pool', {
    x: 8.45, y: 2.76, w: 3.8, h: 0.3, fontFace: BODY, fontSize: 13, bold: true, color: C.white, margin: 0, valign: 'top',
  });
  s.addText(
    'A pool takes 22 working days, but only 13.7 of them are your in-house crew. The rest is ' +
    'subcontractor work or waiting — and that waiting is exactly what lets one crew carry ' +
    'several builds at once.\n\n' +
    'Which also means the crew, not demand, sets how many pools you finish in a year.',
    { x: 8.45, y: 3.2, w: 3.85, h: 2.1, fontFace: BODY, fontSize: 12, color: C.concrete, margin: 0, lineSpacing: 16, valign: 'top' },
  );
  note(s, 'Subs cover excavation, gunite, electrical and decking. Everything else is your crew.');
}

// ═══════════════ 10 · WIP ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'WHAT THAT COSTS');
  title(s, 'Running five jobs at once buys nothing');

  const cols = [
    ['3 jobs in flight', '8.2 weeks', '19 pools', '100%', C.ok],
    ['5 jobs in flight', '13.7 weeks', '19 pools', '100%', C.low],
  ];
  cols.forEach((cdef, i) => {
    const x = M + i * 6.15;
    card(s, x, 1.8, 5.7, 2.6);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.32, y: 2.05, w: 0.32, h: 0.32, fill: { color: cdef[4] } });
    s.addText(cdef[0], {
      x: x + 0.75, y: 2.03, w: 4.6, h: 0.36, fontFace: HEAD, fontSize: 18, bold: true, color: C.char, margin: 0, valign: 'middle',
    });
    [['Cycle time per job', cdef[1]], ['Finished per year', cdef[2]], ['Crew utilisation', cdef[3]]].forEach((r, j) => {
      const y = 2.58 + j * 0.54;
      s.addText(r[0], { x: x + 0.32, y, w: 2.9, h: 0.34, fontFace: BODY, fontSize: 12.5, color: C.steel, margin: 0, valign: 'middle' });
      s.addText(r[1], { x: x + 3.2, y, w: 2.18, h: 0.34, fontFace: BODY, fontSize: 15, bold: true, color: j === 0 ? cdef[4] : C.char, margin: 0, align: 'right', valign: 'middle' });
    });
  });

  card(s, M, 4.65, W, 1.45, C.char);
  s.addText('Same output. Every customer waits 5.5 weeks longer.', {
    x: M + 0.35, y: 4.87, w: W - 0.7, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
  s.addText(
    'Past three jobs in flight the crew is already fully loaded, so a fourth and fifth add queue rather than output — ' +
    'while a longer calendar spends more supervision time and stretches the window where something can go wrong on a referral.',
    { x: M + 0.35, y: 5.3, w: W - 0.7, h: 0.75, fontFace: BODY, fontSize: 13, color: C.concrete, margin: 0, lineSpacing: 18, valign: 'top' },
  );
  note(s, 'Capping work in progress at three costs nothing and can start this week.');
}

// ═══════════════ 11 · THE SYSTEM ON ONE PAGE (diagram) ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'THE WHOLE THING ON ONE PAGE');
  title(s, 'How it fits together');

  // Six stages across the full content width: 6 boxes at 1.75 + 5 gaps at 0.28 = 11.9 exactly.
  const BW = 1.75, GAP = 0.28, BY = 1.72, BH = 1.08;
  const stages = [
    ['Lead arrives', 'tagged and attributed'],
    ['Answered', 'under five minutes'],
    ['Priced', 'from two dimensions'],
    ['Won', 'job number mints here'],
    ['Built', 'crew and gunite scheduled'],
    ['Reconciled', 'profit final, commission pays'],
  ];
  stages.forEach((st, i) => {
    const x = M + i * (BW + GAP);
    card(s, x, BY, BW, BH, i === 3 ? C.char : C.white);
    s.addText(st[0], {
      x: x + 0.14, y: BY + 0.16, w: BW - 0.28, h: 0.3, fontFace: HEAD, fontSize: 13, bold: true,
      color: i === 3 ? C.amber : C.char, margin: 0, align: 'center', valign: 'top',
    });
    s.addText(st[1], {
      x: x + 0.12, y: BY + 0.5, w: BW - 0.24, h: 0.5, fontFace: BODY, fontSize: 9.5,
      color: i === 3 ? C.concrete : C.steel, margin: 0, align: 'center', valign: 'top', lineSpacing: 12,
    });
    if (i < 5) {
      s.addShape(pres.ShapeType.rightArrow, {
        x: x + BW + 0.05, y: BY + BH / 2 - 0.07, w: 0.18, h: 0.14,
        fill: { color: C.line }, line: { color: C.line, width: 0 },
      });
    }
  });

  // The two keys, drawn as the span of stages each one covers.
  const railX = (i) => M + i * (BW + GAP);
  const railW = (a, b) => railX(b) + BW - railX(a);
  [
    ['Lead number  ·  from the first click through to the finished job', 0, 3, C.pool, 3.02],
    ['Job number  ·  joins your job board to your books', 3, 5, C.amberD, 3.5],
  ].forEach((r) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: railX(r[1]), y: r[4], w: railW(r[1], r[2]), h: 0.36, rectRadius: 0.04,
      fill: { color: r[3] }, line: { color: r[3], width: 0 },
    });
    s.addText(r[0], {
      x: railX(r[1]) + 0.16, y: r[4], w: railW(r[1], r[2]) - 0.32, h: 0.36,
      fontFace: BODY, fontSize: 10.5, bold: true, color: C.white, margin: 0, valign: 'middle',
    });
  });

  s.addText('And four things feed back into the business', {
    x: M, y: 4.22, w: W, h: 0.32, fontFace: HEAD, fontSize: 15, bold: true, color: C.char, margin: 0, valign: 'top',
  });

  const FW = 2.78, FGAP = 0.26;
  const loops = [
    ['Won value → ad spend', 'ads optimise for revenue'],
    ['Actual costs → pricing', 'next quote more accurate'],
    ['Crew days → capacity', 'dates you can promise'],
    ['Reviews → new leads', 'no ad spend behind them'],
  ];
  loops.forEach((l, i) => {
    const x = M + i * (FW + FGAP);
    card(s, x, 4.62, FW, 1.05, C.concrete);
    s.addText(l[0], {
      x: x + 0.2, y: 4.8, w: FW - 0.4, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(l[1], {
      x: x + 0.2, y: 5.12, w: FW - 0.4, h: 0.4, fontFace: BODY, fontSize: 10.5, color: C.steel, margin: 0, valign: 'top',
    });
  });

  s.addShape(pres.ShapeType.leftArrow, {
    x: M, y: 5.95, w: W, h: 0.3, fill: { color: C.char }, line: { color: C.char, width: 0 },
  });
  s.addText('each one makes the next job better than the last', {
    x: M + 0.5, y: 5.95, w: W - 1.0, h: 0.3, fontFace: BODY, fontSize: 11, bold: true,
    color: C.amber, margin: 0, align: 'center', valign: 'middle',
  });
}

// ═══════════════ 12 · HOW IT CONNECTS ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'HOW IT WORKS');
  title(s, 'Three things make all of it possible');

  const keys = [
    ['A lead number', 'Created the second someone fills in a form, and carried all the way through to the finished job.', 'This is what connects a Facebook ad to money in the bank.'],
    ['A job number', 'Created the moment a proposal is accepted, and never changed after that.', 'This is what lets your job board and your books talk about the same job.'],
    ['One list of cost codes', 'The same categories, with the same numbers, in your estimate, your books and your schedule.', 'This is what lets you compare what you budgeted with what you spent.'],
  ];
  keys.forEach((k, i) => {
    const x = M + i * 4.03;
    card(s, x, 1.85, 3.75, 3.15);
    s.addText(k[0], {
      x: x + 0.32, y: 2.1, w: 3.1, h: 0.34, fontFace: HEAD, fontSize: 17, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(k[1], {
      x: x + 0.32, y: 2.56, w: 3.15, h: 1.1, fontFace: BODY, fontSize: 12, color: C.steel, margin: 0, lineSpacing: 16, valign: 'top',
    });
    s.addText(k[2], {
      x: x + 0.32, y: 3.85, w: 3.15, h: 0.95, fontFace: BODY, fontSize: 12, bold: true, color: C.amberD, margin: 0, lineSpacing: 16, valign: 'top',
    });
  });

  card(s, M, 5.3, W, 0.95, C.concrete);
  s.addText('None of this is exotic. It is two numbers and one shared list — and it is exactly what is missing today.', {
    x: M + 0.35, y: 5.5, w: W - 0.7, h: 0.5, fontFace: BODY, fontSize: 13.5, bold: true, color: C.char, margin: 0, valign: 'top',
  });
}

// ═══════════════ 12 · CLICK TO SIGNATURE ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'ONE JOB, START TO FINISH  ·  PART ONE');
  title(s, 'From the first click to a signature');

  const steps = [
    ['Someone clicks an ad and lands on your site', 'Which vertical they came for, which ad, which campaign — all recorded before they type a word.'],
    ['They fill in the form', 'A lead number is created. It stays attached to them for the life of the job.'],
    ['They hear back in under five minutes', 'A text, an email, and an alert to the right inbox. Automatically, day or night, without anyone watching.'],
    ['You price it by typing two numbers', 'Length and width. The estimate that comes out looks exactly like the one you send today.'],
    ['They sign', 'The job number is created. The budget and the build schedule generate themselves — nothing is retyped.'],
  ];
  steps.forEach((st, i) => {
    const y = 1.72 + i * 0.95;
    numDot(s, M, y + 0.02, i + 1);
    s.addText(st[0], {
      x: M + 0.6, y, w: 11.2, h: 0.32, fontFace: HEAD, fontSize: 15.5, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(st[1], {
      x: M + 0.6, y: y + 0.34, w: 10.8, h: 0.5, fontFace: BODY, fontSize: 12.5, color: C.steel, margin: 0, lineSpacing: 16, valign: 'top',
    });
  });
  note(s, 'Nobody changes how they work. The customer sees the same document they always saw.');
}

// ═══════════════ 13 · SIGNATURE TO PAID ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'ONE JOB, START TO FINISH  ·  PART TWO');
  title(s, 'From a signature to everybody paid');

  const steps = [
    ['The build runs off one screen', 'Where the crew is today, what is sitting on a permit or a cure, which gunite dates are booked, and what needs you.'],
    ['Subs get a text, not a login', 'Nobody has to learn new software to be scheduled. Assigning the work sends the message.'],
    ['Costs land as they happen', 'Sub invoices and receipts attach to the job in the same categories as the estimate, so budget and actual sit side by side.'],
    ['The job finishes', 'The customer is asked for a review, pointed at the right listing. The pool becomes a service account and a future remodel lead.'],
    ['Reconciliation releases the money', 'All costs in, allowances trued up, real profit final — and second-stage commission pays against a number both sides can see.'],
  ];
  steps.forEach((st, i) => {
    const y = 1.72 + i * 0.95;
    numDot(s, M, y + 0.02, i + 6);
    s.addText(st[0], {
      x: M + 0.6, y, w: 11.2, h: 0.32, fontFace: HEAD, fontSize: 15.5, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(st[1], {
      x: M + 0.6, y: y + 0.34, w: 10.8, h: 0.5, fontFace: BODY, fontSize: 12.5, color: C.steel, margin: 0, lineSpacing: 16, valign: 'top',
    });
  });
  note(s, 'Commission is paid on the profit quoted at sale. Reconciliation releases it — it does not re-cut it.');
}

// ═══════════════ 14 · IT COMPOUNDS ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'WHY IT GETS BETTER ON ITS OWN');
  title(s, 'Four things that feed back');

  const loops = [
    ['Ads learn what actually makes money', 'Won job values go back to Facebook, so spend moves toward the work that pays rather than the work that produces the most form fills.'],
    ['Every quote gets more accurate', 'What a job really cost updates the pricing library, so the next proposal is built on better numbers than the last one.'],
    ['You know what you can promise', 'Crew days logged on real builds turn a guess about capacity into a date you can stand behind.'],
    ['Reviews bring leads you did not pay for', 'Every finished job asks for a review, which builds the map listing, which produces enquiries with no ad spend behind them.'],
  ];
  loops.forEach((l, i) => {
    const x = M + (i % 2) * 6.15;
    const y = 1.85 + Math.floor(i / 2) * 2.2;
    card(s, x, y, 5.7, 1.95);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.32, y: y + 0.28, w: 0.3, h: 0.3, fill: { color: C.pool } });
    s.addText(l[0], {
      x: x + 0.74, y: y + 0.24, w: 4.7, h: 0.4, fontFace: HEAD, fontSize: 15, bold: true, color: C.char, margin: 0, valign: 'middle',
    });
    s.addText(l[1], {
      x: x + 0.32, y: y + 0.78, w: 5.1, h: 1.0, fontFace: BODY, fontSize: 12, color: C.steel, margin: 0, lineSpacing: 16, valign: 'top',
    });
  });
  note(s, 'None of these need anyone to remember to do them. They are consequences of the system running.');
}

// ═══════════════ 15 · WHAT YOU CAN ANSWER ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'THE POINT OF ALL OF IT');
  title(s, 'Questions you will be able to answer');

  const qs = [
    'Which vertical actually converts, and at what rate',
    'What a won job costs you to win, by vertical',
    'What a service account is worth over its life, not just its first visit',
    'What you really made on a job, line by line',
    'What a salesperson is owed, with the numbers behind it',
    'Whether you can afford to take the next job on',
  ];
  qs.forEach((q, i) => {
    const y = 1.9 + i * 0.62;
    s.addShape(pres.ShapeType.ellipse, { x: M + 0.02, y: y + 0.09, w: 0.22, h: 0.22, fill: { color: C.amber } });
    s.addText(q, {
      x: M + 0.5, y, w: 11.0, h: 0.4, fontFace: BODY, fontSize: 15, color: C.char, margin: 0, valign: 'middle',
    });
  });

  card(s, M, 5.75, W, 1.0, C.char);
  s.addText('Every one of those was on your original list. Not one of them can be answered today.', {
    x: M + 0.35, y: 5.98, w: W - 0.7, h: 0.5, fontFace: HEAD, fontSize: 17, bold: true, color: C.amber, margin: 0, valign: 'top',
  });
}

// ═══════════════ 16 · WHAT'S BUILT ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'STATUS');
  title(s, 'What is built, and what it is waiting on');

  const items = [
    ['Website & lead capture', 'Rebuilt. Every enquiry tagged by vertical with full attribution, so close rate by vertical finally becomes computable.', 'Waiting on account transfer from the current agency', C.amber],
    ['Lead response engine', 'Automatic reply to every new enquiry, routed to the right vertical. Duplicate-proof.', 'Waiting on a text-message provider', C.amber],
    ['Takeoff & proposal engine', 'Reproduces your estimate exactly, and prices a new pool from two dimensions.', 'Usable today', C.ok],
    ['Job status signal', 'Connects a finished job to review requests and ad reporting automatically.', 'Built', C.ok],
  ];
  items.forEach((it, i) => {
    const x = M + (i % 2) * 6.15;
    const y = 1.8 + Math.floor(i / 2) * 2.25;
    card(s, x, y, 5.7, 2.0);
    s.addText(it[0], {
      x: x + 0.32, y: y + 0.22, w: 5.0, h: 0.32, fontFace: HEAD, fontSize: 15.5, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(it[1], {
      x: x + 0.32, y: y + 0.6, w: 5.05, h: 0.85, fontFace: BODY, fontSize: 11.5, color: C.steel, margin: 0, lineSpacing: 15, valign: 'top',
    });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.32, y: y + 1.52, w: 0.2, h: 0.2, fill: { color: it[3] } });
    s.addText(it[2], {
      x: x + 0.62, y: y + 1.45, w: 4.8, h: 0.32, fontFace: BODY, fontSize: 11.5, bold: true, color: it[3] === C.ok ? C.ok : C.amberD, margin: 0, valign: 'middle',
    });
  });
  note(s, 'The build is ahead of the decisions — most of what is finished cannot switch on yet.');
}

// ═══════════════ 12 · WHAT WE NEED ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'THE ASK');
  title(s, 'What we need from you');

  const asks = [
    ['Have the contract reviewed', 'What does your cost-plus agreement define as reimbursable cost?', 'Unlocks ~$13,750 per pool'],
    ['Three QuickBooks questions', 'Is Projects turned on? Are Classes in use? One company file across the businesses, or three?', 'Unlocks cost tracking and commissions'],
    ['Settle the allowance rule', 'When turf comes in at $6,200 against a $5,000 budget, does the fee recalculate on the real number?', 'Defines what reconciled profit means'],
    ['Cap work in progress at three', 'Free, and it can start this week.', 'Five weeks faster per customer'],
    ['Log crew-days on the next two pools', 'One number per phase. A note on a phone is enough.', 'Turns the capacity model into fact'],
  ];
  asks.forEach((a, i) => {
    const y = 1.72 + i * 0.94;
    numDot(s, M, y + 0.02, i + 1);
    s.addText(a[0], {
      x: M + 0.6, y, w: 5.2, h: 0.32, fontFace: HEAD, fontSize: 15, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(a[1], {
      x: M + 0.6, y: y + 0.33, w: 6.4, h: 0.55, fontFace: BODY, fontSize: 11.5, color: C.steel, margin: 0, lineSpacing: 15, valign: 'top',
    });
    s.addText(a[2], {
      x: 9.15, y, w: 3.45, h: 0.32, fontFace: BODY, fontSize: 12, bold: true, color: C.amberD, margin: 0, align: 'right', valign: 'top',
    });
  });
  note(s, 'The first three are decisions. The last two are habits, and both are free.');
}

// ═══════════════ 18 · WHAT WE NEED, IN FULL ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  kicker(s, 'THE ASK, IN FULL');
  title(s, 'Everything we need from you');

  const groups = [
    ['Documents', [
      'The signed cost-plus agreement',
      '5–10 finished pool estimates, with their dimensions',
      'Your gunite crew’s booking terms',
      'Current Facebook ad spend and structure',
    ]],
    ['Decisions', [
      'Stay at 30%, or move the fee',
      'Does the fee recalculate on allowances',
      'Which commission structure',
      'Cap builds at three at once',
      'Who builds estimates',
    ]],
    ['Numbers to start logging', [
      'Crew days on the next two pools',
      'Pools per year',
      'Coating jobs per month',
      'Lead volume and mix today',
      'Who answers the phone today',
    ]],
    ['Access', [
      'QuickBooks setup, or read access',
      'A job-board account on an Apex email',
      'Confirm the four inboxes exist',
      'Does the crew lead get access',
    ]],
  ];
  groups.forEach((g, i) => {
    const x = M + i * 3.02;
    card(s, x, 1.85, 2.78, 3.7);
    s.addText(g[0], {
      x: x + 0.26, y: 2.08, w: 2.3, h: 0.32, fontFace: HEAD, fontSize: 14.5, bold: true, color: C.char, margin: 0, valign: 'top',
    });
    s.addText(g[1].map((t, j) => ({
      text: t, options: { bullet: { indent: 12 }, breakLine: j !== g[1].length - 1 },
    })), {
      x: x + 0.26, y: 2.5, w: 2.32, h: 2.9, fontFace: BODY, fontSize: 11, color: C.steel, margin: 0, paraSpaceAfter: 7, lineSpacing: 14, valign: 'top',
    });
  });

  card(s, M, 5.75, W, 1.0, C.char);
  s.addText([
    { text: 'Start with the contract. ', options: { bold: true, color: C.amber } },
    { text: 'It is one document, to one person, and nothing else on this page is worth as much.', options: { color: C.concrete } },
  ], { x: M + 0.35, y: 5.98, w: W - 0.7, h: 0.5, fontFace: BODY, fontSize: 14.5, margin: 0, valign: 'top' });
}

// ═══════════════ 19 · ROADMAP (dark) ═══════════════
{
  const s = pres.addSlide();
  s.background = { color: C.char };
  kicker(s, 'THE SEQUENCE');
  title(s, 'Four phases, in dependency order', true);

  const phases = [
    ['Capture\n& Convert', 'Every enquiry tagged, answered in minutes, and attributable to the vertical that produced it.'],
    ['Price\n& Prove', 'The takeoff engine live on real proposals, so every figure you bill can be substantiated.'],
    ['Pay\n& Manage', 'Job costing, commissions on reconciled profit, and one crew scheduled against real capacity.'],
    ['Compound', 'Reviews that build the map listing, and ad spend that optimises toward revenue instead of form fills.'],
  ];
  phases.forEach((p, i) => {
    const x = M + i * 3.02;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.85, w: 2.75, h: 3.5, rectRadius: 0.06,
      fill: { color: C.char2 }, line: { color: i === 0 ? C.amber : C.steel, width: i === 0 ? 1.5 : 0.75 },
    });
    numDot(s, x + 0.28, 2.1, i + 1, true);
    // valign top on both — "Compound" is one line where the others are two, and centring
    // dropped it below its neighbours.
    s.addText(p[0], {
      x: x + 0.28, y: 2.7, w: 2.2, h: 0.9, fontFace: HEAD, fontSize: 17, bold: true, color: C.white, margin: 0, lineSpacing: 22, valign: 'top',
    });
    s.addText(p[1], {
      x: x + 0.28, y: 3.68, w: 2.25, h: 1.5, fontFace: BODY, fontSize: 11.5, color: C.concrete, margin: 0, lineSpacing: 15, valign: 'top',
    });
  });

  s.addText('Nothing here is sequenced by preference. Each phase produces the data the next one needs.', {
    x: M, y: 5.7, w: 11.0, h: 0.4, fontFace: BODY, fontSize: 14, italic: true, color: C.mute, margin: 0, valign: 'top',
  });
  s.addText('Apex  ·  July 2026', {
    x: M, y: 6.7, w: 5, h: 0.3, fontFace: BODY, fontSize: 10.5, color: C.steel, charSpacing: 1.6, margin: 0, valign: 'top',
  });
}

const out = process.argv[2] || 'apex-strategy-deck.pptx';
pres.writeFile({ fileName: out }).then(() => console.log('wrote ' + out));
