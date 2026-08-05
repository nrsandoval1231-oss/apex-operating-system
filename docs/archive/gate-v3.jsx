import React, { useState, useEffect } from "react";

const C = {
  bg: "#F4F4F1", card: "#FFFFFF", ink: "#15181B", body: "#454B51",
  mute: "#8A9098", rule: "#E2E2DC", deep: "#0081AF", mid: "#00ABE7",
  sand: "#F5E4C8", gold: "#B8842C", gate: "#C81E2A",
};
const sans = "'Space Grotesk', -apple-system, 'Helvetica Neue', sans-serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

/* ── LSI ────────────────────────────────────────────────── */
const TF = [[32,0],[37,.1],[46,.2],[53,.3],[60,.4],[66,.5],[76,.6],[84,.7],[94,.8],[105,.9]];
const CF = [[25,1],[50,1.3],[75,1.5],[100,1.6],[125,1.7],[150,1.8],[200,1.9],[250,2],[300,2.1],[400,2.2],[800,2.5]];
const AF = [[25,1.4],[50,1.7],[75,1.9],[100,2],[125,2.1],[150,2.2],[200,2.3],[250,2.4],[300,2.5],[400,2.6]];

const interp = (t, x) => {
  if (x <= t[0][0]) return t[0][1];
  if (x >= t[t.length-1][0]) return t[t.length-1][1];
  for (let i = 0; i < t.length-1; i++) {
    const [a,av] = t[i], [b,bv] = t[i+1];
    if (x >= a && x <= b) return av + ((x-a)/(b-a))*(bv-av);
  }
  return t[0][1];
};
const invert = (t, y) => {
  if (y <= t[0][1]) return t[0][0];
  if (y >= t[t.length-1][1]) return t[t.length-1][0];
  for (let i = 0; i < t.length-1; i++) {
    const [a,av] = t[i], [b,bv] = t[i+1];
    if (y >= av && y <= bv) return a + ((y-av)/(bv-av))*(b-a);
  }
  return t[0][0];
};
const tdsF = (t) => (t <= 1000 ? 12.1 : t <= 2000 ? 12.2 : t <= 3000 ? 12.3 : 12.4);

function analyze({ pH, ta, ch, cya, temp, tds, gal }) {
  const carbAlk = Math.max(0, ta - cya / 3);
  const cf = interp(CF, ch), af = interp(AF, carbAlk), tf = interp(TF, temp);
  const lsi = pH + tf + cf + af - tdsF(tds);

  const steps = [];
  let verdict, tone;

  if (lsi < -0.3) { verdict = "Aggressive — will etch new plaster"; tone = "bad"; }
  else if (lsi > 0.3) { verdict = "Scaling — will deposit on the finish"; tone = "bad"; }
  else { verdict = "Balanced — hold here"; tone = "ok"; }

  if (lsi < -0.1) {
    let need = -lsi;
    const targetCF = Math.min(cf + need, 2.1);
    const newCH = Math.min(Math.round(invert(CF, targetCF) / 5) * 5, 300);
    const gained = interp(CF, newCH) - cf;
    if (newCH > ch + 4) {
      const lbs = ((newCH - ch) / 10) * 1.25 * (gal / 10000);
      const doses = Math.max(1, Math.ceil(lbs / 10));
      steps.push({
        head: `Add ${lbs.toFixed(0)} lb calcium hardness increaser`,
        body: `Raises calcium from ${ch} to ${newCH} ppm. Split into ${doses} doses of about ${(lbs/doses).toFixed(0)} lb, several hours apart. Dissolve first, broadcast, then brush.`,
      });
    }
    const left = need - gained;
    if (left > 0.06) {
      steps.push({
        head: `Raise pH to ${(pH + left).toFixed(1)}`,
        body: `Aerate, or add soda ash in small increments. Do this after the calcium has dispersed — never in the same hour.`,
      });
    }
  }

  if (lsi > 0.3) {
    steps.push({
      head: `Lower pH to ${(pH - (lsi - 0.1)).toFixed(1)}`,
      body: `Muriatic acid in increments, brushing between. Retest in 4 hours before adding more.`,
    });
  }

  if (carbAlk > 140) {
    steps.push({
      head: "Carbonate alkalinity is high at " + Math.round(carbAlk) + " ppm",
      body: "Typical Lubbock fill. Bring it down slowly with acid over several days — do not chase it in one dose, and never on the same day you add calcium.",
    });
  }

  return { lsi, verdict, tone, carbAlk, steps };
}

/* ── data ───────────────────────────────────────────────── */
const VASQUEZ_CHECKS = [
  ["Rectangle re-verified — widths, lengths, diagonals equal", true],
  ["Depths and spa dimensions match plan", true],
  ["Steel: size, spacing, cover, laps, chairs", true],
  ["Both 2\" lowered sections built — end beam + spa dam", true],
  ["Plumbing pressurized, gauge reading recorded", true],
  ["Electrical: niches bonded, grid at 4+ points", true],
  ["Vault square to sides, level end to end", true],
  ["Hydrostatic relief valve installed", true],
  ["Substrate damp, not muddy", false],
  ["ACI-certified nozzleman confirmed on crew", false],
  ["Mix design and 28-day strength confirmed", false],
];

/* ── shared bits ────────────────────────────────────────── */
function Shell({ accent, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${accent}`, borderRadius: 3, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function Head({ name, addr, action, why, whyColor }) {
  return (
    <div style={{ padding: "20px 20px 0" }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em", color: C.ink }}>{name}</span>
        <span style={{ fontFamily: sans, fontSize: 15, color: C.mute }}>{addr}</span>
      </div>
      <div style={{ fontFamily: sans, fontSize: 19, fontWeight: 500, color: C.ink, marginTop: 12, lineHeight: 1.35 }}>{action}</div>
      <div style={{ fontFamily: sans, fontSize: 16, color: whyColor, marginTop: 5, fontWeight: 500 }}>{why}</div>
    </div>
  );
}

function Btn({ children, onClick, kind = "ghost", disabled, grow }) {
  const s = {
    primary: { background: C.ink, color: "#fff", border: "none" },
    go:      { background: C.deep, color: "#fff", border: "none" },
    ghost:   { background: "transparent", color: C.body, border: `1px solid ${C.rule}` },
    off:     { background: C.rule, color: C.mute, border: "none" },
  }[disabled ? "off" : kind];
  return (
    <button onClick={disabled ? undefined : onClick} className={grow ? "flex-1" : ""}
      style={{ ...s, padding: "15px 18px", borderRadius: 3, fontFamily: sans, fontSize: 16.5, fontWeight: 500 }}>
      {children}
    </button>
  );
}

function PhotoBtn({ onShoot }) {
  return (
    <button onClick={onShoot} className="flex items-center justify-center shrink-0"
      style={{ width: 54, height: 52, border: `1px solid ${C.rule}`, borderRadius: 3, background: "transparent" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.body} strokeWidth="1.8">
        <path d="M3 8h3.5l1.5-2h8l1.5 2H21v12H3z" strokeLinejoin="round" />
        <circle cx="12" cy="13.5" r="3.6" />
      </svg>
    </button>
  );
}

function ShareBtn({ onShare }) {
  return (
    <button onClick={onShare} className="flex items-center justify-center shrink-0"
      style={{ width: 54, height: 52, border: `1px solid ${C.rule}`, borderRadius: 3, background: "transparent" }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={C.body} strokeWidth="1.8" strokeLinecap="round">
        <path d="M10 13.5a4 4 0 006 .5l3-3a4 4 0 00-5.7-5.7l-1.7 1.7" />
        <path d="M14 10.5a4 4 0 00-6-.5l-3 3a4 4 0 005.7 5.7l1.7-1.7" />
      </svg>
    </button>
  );
}

/* ── gate ───────────────────────────────────────────────── */
function GateCard({ onShoot }) {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState(VASQUEZ_CHECKS.map((c) => c[1]));
  const done = checks.filter(Boolean).length, total = checks.length, ready = done === total;

  return (
    <Shell accent={C.gate}>
      <Head name="Vasquez" addr="82nd & Quaker" action="Sign the pre-gunite hold"
        why="Gunite crew arrives Tuesday" whyColor={C.gate} />
      <div style={{ padding: "18px 20px 0" }} className="flex items-center gap-3">
        <div className="flex-1" style={{ height: 8, background: C.rule, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${(done/total)*100}%`, height: "100%", background: ready ? C.deep : C.gate, transition: "width .18s" }} />
        </div>
        <span style={{ fontFamily: mono, fontSize: 14, color: C.body }}>{done}/{total}</span>
      </div>

      {open && (
        <div style={{ padding: "16px 20px 0" }}>
          {VASQUEZ_CHECKS.map((c, i) => (
            <button key={i} onClick={() => setChecks((p) => p.map((v,n) => n===i ? !v : v))}
              className="w-full flex items-start gap-3 text-left"
              style={{ padding: "14px 0", borderBottom: `1px solid ${C.rule}`, background: "transparent" }}>
              <span className="shrink-0 flex items-center justify-center" style={{
                width: 26, height: 26, marginTop: 1, borderRadius: 3,
                border: `2px solid ${checks[i] ? C.deep : C.mute}`, background: checks[i] ? C.deep : "transparent" }}>
                {checks[i] && <svg width="15" height="15" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="square"/></svg>}
              </span>
              <span style={{ fontFamily: sans, fontSize: 16, lineHeight: 1.4, color: checks[i] ? C.mute : C.ink }}>{c[0]}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 20 }} className="flex gap-10">
        {!open ? (
          <>
            <Btn kind="primary" grow onClick={() => setOpen(true)}>Open checklist</Btn>
            <PhotoBtn onShoot={() => onShoot("Vasquez · Pre-Gunite Hold")} />
          </>
        ) : (
          <>
            <Btn onClick={() => setOpen(false)}>Close</Btn>
            <Btn kind="go" grow disabled={!ready}>{ready ? "Sign this gate" : `${total-done} left`}</Btn>
            <PhotoBtn onShoot={() => onShoot("Vasquez · Pre-Gunite Hold")} />
          </>
        )}
      </div>
    </Shell>
  );
}

/* ── inspection ─────────────────────────────────────────── */
function InspectionCard() {
  const [called, setCalled] = useState(false);
  return (
    <Shell accent={C.gold}>
      <div style={{ padding: "16px 20px 0" }}>
        <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: C.gold }}>
          CITY INSPECTION
        </span>
      </div>
      <Head name="Ramirez" addr="Milwaukee Ave"
        action={called ? "Requested — window is Tuesday AM" : "Request the plumbing inspection"}
        why={called ? "Confirmed. Nothing else needed today." : "24-hour lead time — call today or Tuesday's gunite slips"}
        whyColor={called ? C.deep : C.gold} />
      <div style={{ padding: "14px 20px 0", fontFamily: sans, fontSize: 15, color: C.body, lineHeight: 1.55 }}>
        City of Lubbock Building Safety. Lines must be under pressure with the gauge
        visible when the inspector arrives.
      </div>
      <div style={{ padding: 20 }} className="flex gap-10">
        <Btn kind={called ? "ghost" : "primary"} grow disabled={called} onClick={() => setCalled(true)}>
          {called ? "Requested 2:14 PM" : "Mark requested"}
        </Btn>
      </div>
    </Shell>
  );
}

/* ── chemistry ──────────────────────────────────────────── */
function Stepper({ label, value, set, step, unit }) {
  const btn = { width: 46, height: 42, border: `1px solid ${C.rule}`, borderRadius: 3, background: "transparent",
    fontFamily: sans, fontSize: 22, color: C.body, lineHeight: 1 };
  return (
    <div className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: `1px solid ${C.rule}` }}>
      <span style={{ fontFamily: sans, fontSize: 16, color: C.ink }}>{label}</span>
      <div className="flex items-center gap-2">
        <button style={btn} onClick={() => set(+(value - step).toFixed(1))}>–</button>
        <span style={{ fontFamily: mono, fontSize: 17, color: C.ink, minWidth: 58, textAlign: "center" }}>
          {value}<span style={{ fontSize: 12, color: C.mute }}>{unit}</span>
        </span>
        <button style={btn} onClick={() => set(+(value + step).toFixed(1))}>+</button>
      </div>
    </div>
  );
}

function ChemPanel() {
  const [pH, setPH] = useState(7.4);
  const [ta, setTA] = useState(150);
  const [ch, setCH] = useState(70);
  const [cya, setCYA] = useState(30);
  const [temp, setTemp] = useState(76);
  const r = analyze({ pH, ta, ch, cya, temp, tds: 3400, gal: 16000 });
  const barColor = r.tone === "ok" ? C.deep : C.gate;

  return (
    <div style={{ padding: "4px 20px 0" }}>
      <Stepper label="pH" value={pH} set={setPH} step={0.1} unit="" />
      <Stepper label="Total alkalinity" value={ta} set={setTA} step={10} unit=" ppm" />
      <Stepper label="Calcium hardness" value={ch} set={setCH} step={10} unit=" ppm" />
      <Stepper label="Cyanuric acid" value={cya} set={setCYA} step={5} unit=" ppm" />
      <Stepper label="Water temp" value={temp} set={setTemp} step={2} unit="°F" />

      <div style={{ marginTop: 18, padding: 16, background: C.bg, borderRadius: 3, border: `1px solid ${C.rule}` }}>
        <div className="flex items-baseline justify-between">
          <span style={{ fontFamily: sans, fontSize: 15, color: C.body }}>LSI</span>
          <span style={{ fontFamily: mono, fontSize: 28, fontWeight: 500, color: barColor }}>
            {r.lsi > 0 ? "+" : ""}{r.lsi.toFixed(2)}
          </span>
        </div>
        <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 500, color: barColor, marginTop: 2 }}>{r.verdict}</div>
        <div style={{ fontFamily: sans, fontSize: 14, color: C.mute, marginTop: 6 }}>
          Carbonate alkalinity {Math.round(r.carbAlk)} ppm · salt water, TDS 3,400 · 16,000 gal
        </div>
      </div>

      {r.steps.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: C.mute, marginBottom: 8 }}>
            DO THIS, IN THIS ORDER
          </div>
          {r.steps.map((s, i) => (
            <div key={i} className="flex gap-3" style={{ padding: "12px 0", borderTop: `1px solid ${C.rule}` }}>
              <span style={{ fontFamily: mono, fontSize: 14, color: C.deep, marginTop: 2 }}>{i+1}</span>
              <div>
                <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 500, color: C.ink, lineHeight: 1.35 }}>{s.head}</div>
                <div style={{ fontFamily: sans, fontSize: 15, color: C.body, marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── running ────────────────────────────────────────────── */
function RunningCard({ name, addr, status, meta, sub, tone, action, onAction, expand, children, onShoot, onShare }) {
  const [open, setOpen] = useState(false);
  const accent = tone === "park" ? C.gold : C.deep;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 3, marginBottom: 10 }}>
      <div style={{ padding: "16px 18px 0" }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 19, color: C.ink }}>{name}</span>
            <span style={{ fontFamily: sans, fontSize: 14, color: C.mute }}>{addr}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 500, color: accent }}>{status}</span>
            <span style={{ fontFamily: mono, fontSize: 13, color: C.body }}>{meta}</span>
          </div>
        </div>
        <div style={{ fontFamily: sans, fontSize: 14.5, color: C.mute, marginTop: 4 }}>{sub}</div>
      </div>
      {open && children}
      {action && (
        <div style={{ padding: "14px 18px 16px" }} className="flex gap-10">
          <Btn grow onClick={expand ? () => setOpen(!open) : onAction}>{open ? "Close" : action}</Btn>
          <PhotoBtn onShoot={() => onShoot(`${name} · ${status}`)} />
          <ShareBtn onShare={() => onShare(name)} />
        </div>
      )}
    </div>
  );
}

/* ── draws & conflict ───────────────────────────────────── */
function DrawCard() {
  const [sent, setSent] = useState(false);
  return (
    <Shell accent={C.deep}>
      <div style={{ padding: "16px 20px 0" }}>
        <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: C.deep }}>
          READY TO BILL
        </span>
      </div>
      <Head name="Delgado" addr="Kelsey Park"
        action={sent ? "Draw 4 invoiced" : "Draw 4 is billable — $29,500"}
        why={sent ? "Marked sent 2:14 PM" : "Gunite gate signed Thursday"}
        whyColor={sent ? C.mute : C.deep} />
      <div style={{ padding: "14px 20px 0", fontFamily: sans, fontSize: 15, color: C.body, lineHeight: 1.55 }}>
        4 of 6 draws released · $76,300 of $118,000 collected to date
      </div>
      <div style={{ padding: 20 }} className="flex gap-10">
        <Btn kind={sent ? "ghost" : "go"} grow disabled={sent} onClick={() => setSent(true)}>
          {sent ? "Invoiced" : "Mark invoiced"}
        </Btn>
      </div>
    </Shell>
  );
}

const SUBS = ["Excavation", "Gunite", "Electrical", "Gas plumbing", "Cover install"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const START_SCHED = {
  Excavation:      [[], [], [{ job: "Ramirez", phase: "Dig" }], [], [], []],
  Gunite:          [[], [{ job: "Vasquez", phase: "Shoot" }, { job: "Ramirez", phase: "Shoot" }], [], [], [], []],
  Electrical:      [[{ job: "Boyd", phase: "Final" }], [], [], [{ job: "Vasquez", phase: "Rough" }], [], []],
  "Gas plumbing":  [[], [], [], [{ job: "Boyd", phase: "Heater" }], [], []],
  "Cover install": [[], [], [{ job: "Boyd", phase: "Track" }], [], [], [{ job: "Whitaker", phase: "Final" }]],
};

const cloneS = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map((d) => [...d])]));
const findClashes = (s) =>
  SUBS.flatMap((sub) => s[sub].map((slot, d) => (slot.length > 1 ? { sub, day: d } : null)).filter(Boolean));
const countVisits = (s) => SUBS.reduce((n, sub) => n + s[sub].reduce((m, d) => m + d.length, 0), 0);

function WeekCard({ sched, onOpen }) {
  const clashes = findClashes(sched);
  const bad = clashes.length > 0;
  return (
    <div style={{
      background: bad ? C.sand : C.card, border: `1px solid ${bad ? C.gold : C.rule}`,
      borderRadius: 3, padding: "16px 18px",
      marginTop: bad ? 0 : 22, marginBottom: bad ? 14 : 0,
    }}>
      <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 600, color: C.ink }}>
        {bad ? `${clashes[0].sub} crew is booked twice on ${FULL[clashes[0].day]}` : "This week"}
      </div>
      <div style={{ fontFamily: sans, fontSize: 15, color: C.body, marginTop: 5, lineHeight: 1.5 }}>
        {bad
          ? `${sched[clashes[0].sub][clashes[0].day].map((c) => c.job).join(" and ")}. One crew serves all five pools — pick one before Monday.`
          : `${countVisits(sched)} crew visits scheduled. No conflicts.`}
      </div>
      <div style={{ marginTop: 14 }} className="flex gap-10">
        <Btn kind={bad ? "primary" : "ghost"} grow onClick={onOpen}>Open the week</Btn>
      </div>
    </div>
  );
}

function WeekBoard({ sched, setSched, onClose, onToast }) {
  const [held, setHeld] = useState(null);
  const clashes = findClashes(sched);
  const heldCard = held ? sched[held.sub][held.day][held.i] : null;

  const pick = (sub, day, i) => {
    if (held && held.sub === sub && held.day === day && held.i === i) return setHeld(null);
    setHeld({ sub, day, i });
  };
  const drop = (day) => {
    if (!held) return;
    const next = cloneS(sched);
    const [card] = next[held.sub][held.day].splice(held.i, 1);
    next[held.sub][day].push(card);
    setSched(next);
    onToast(`${card.job} moved to ${FULL[day]}`);
    setHeld(null);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: C.bg }}>
      <div className="mx-auto" style={{ maxWidth: 620, padding: "0 14px 110px" }}>
        <div className="flex items-baseline justify-between" style={{ padding: "24px 0 6px" }}>
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 24, letterSpacing: "-.02em", color: C.ink }}>
            This week
          </span>
          <button onClick={onClose} style={{ fontFamily: sans, fontSize: 16, color: C.deep, fontWeight: 500 }}>Done</button>
        </div>

        <div style={{ fontFamily: sans, fontSize: 15.5, fontWeight: 600, color: clashes.length ? C.gate : C.deep, marginBottom: 16 }}>
          {clashes.length
            ? `${clashes.length} conflict — ${clashes[0].sub} booked twice ${DAYS[clashes[0].day]}`
            : "No conflicts. Every crew is single-booked."}
        </div>

        <div className="overflow-x-auto" style={{ marginLeft: -14, marginRight: -14, padding: "0 14px" }}>
          <div style={{ minWidth: 560 }}>
            <div className="flex gap-1" style={{ paddingLeft: 104, marginBottom: 6 }}>
              {DAYS.map((d, i) => (
                <div key={d} className="flex-1 text-center" style={{
                  fontFamily: mono, fontSize: 10.5, letterSpacing: ".1em",
                  color: i === 0 ? C.ink : C.mute, fontWeight: i === 0 ? 700 : 400 }}>{d}</div>
              ))}
            </div>

            {SUBS.map((sub) => (
              <div key={sub} className="flex gap-1 items-stretch" style={{ marginBottom: 6 }}>
                <div style={{ width: 100, flexShrink: 0, fontFamily: sans, fontSize: 14, color: C.ink,
                  display: "flex", alignItems: "center", paddingRight: 4, lineHeight: 1.2 }}>{sub}</div>

                {DAYS.map((_, day) => {
                  const slot = sched[sub][day];
                  const clash = slot.length > 1;
                  const target = held && held.sub === sub;
                  const isSource = held && held.sub === sub && held.day === day;
                  return (
                    <button key={day} onClick={() => target && !isSource && drop(day)} className="flex-1"
                      style={{
                        minHeight: 58, padding: 3, borderRadius: 3,
                        border: `1px ${target && !isSource ? "dashed" : "solid"} ${clash ? C.gate : target && !isSource ? C.deep : C.rule}`,
                        background: clash ? "#FBEBEC" : target && !isSource ? "#EAF6FB" : C.card,
                        display: "flex", flexDirection: "column", gap: 3,
                      }}>
                      {slot.map((c, i) => {
                        const lifted = held && held.sub === sub && held.day === day && held.i === i;
                        return (
                          <div key={i} onClick={(e) => { e.stopPropagation(); pick(sub, day, i); }}
                            style={{
                              background: lifted ? C.ink : clash ? C.gate : C.deep, borderRadius: 2,
                              padding: "5px 4px", cursor: "pointer",
                              boxShadow: lifted ? "0 3px 10px rgba(21,24,27,.35)" : "none",
                              transform: lifted ? "scale(1.04)" : "none", transition: "transform .12s",
                            }}>
                            <div style={{ fontFamily: sans, fontSize: 11.5, fontWeight: 600, color: "#fff", lineHeight: 1.15 }}>{c.job}</div>
                            <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.75)", marginTop: 1 }}>{c.phase}</div>
                          </div>
                        );
                      })}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, padding: 16, background: C.card, border: `1px solid ${C.rule}`,
          borderRadius: 3, fontFamily: sans, fontSize: 15, color: C.body, lineHeight: 1.6 }}>
          Tap a card to pick it up, tap a day to drop it. Only that crew's row accepts it —
          you can't move Vasquez's gunite into the electrician's schedule.
        </div>
      </div>

      {held && (
        <div className="fixed left-0 right-0 flex justify-center px-4" style={{ bottom: 18, zIndex: 50 }}>
          <div className="flex items-center justify-between gap-3" style={{
            background: C.ink, color: "#fff", padding: "13px 16px", borderRadius: 3,
            fontFamily: sans, fontSize: 15, maxWidth: 560, width: "100%" }}>
            <span>Moving <strong>{heldCard?.job}</strong> — tap a day</span>
            <button onClick={() => setHeld(null)} style={{ fontFamily: sans, fontSize: 14, color: "rgba(255,255,255,.7)" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── customer view ──────────────────────────────────────── */
const MILESTONES = ["Design", "Excavation", "Shell", "Finishes", "Water", "Handover"];

const CUSTOMER = {
  Delgado: {
    addr: "Kelsey Park", at: 2,
    status: "The shell is curing",
    plain: "Your pool's concrete shell is in the ground. We keep it wet for at least seven days so it reaches full strength — that's why it looks like nothing is happening. It isn't. This is the most important week of the build.",
    next: "Tile and coping start the week of August 4",
    shots: 6, week: "Day 4 of 7",
  },
  Whitaker: {
    addr: "Bell Farms", at: 4,
    status: "Filling and balancing",
    plain: "Your pool is full and we're balancing the water. New plaster is soft for its first month, so we test daily and brush the surface twice a day. Please hold off on swimming until we give you the all-clear.",
    next: "Cleared to swim around August 12",
    shots: 11, week: "Day 12 of 28",
  },
  Boyd: {
    addr: "Upland & 114th", at: 3,
    status: "Decking this week",
    plain: "Tile and coping are set and the cover tracks are in. We pour the deck Wednesday. After the pour it needs a couple of days before anyone walks on it.",
    next: "Plaster the following week, then fill",
    shots: 9, week: "Pour Wednesday",
  },
};

function CustomerView({ name, onClose }) {
  const d = CUSTOMER[name];
  if (!d) return null;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: "rgba(21,24,27,.45)" }} onClick={onClose}>
      <div className="mx-auto" style={{ maxWidth: 520, padding: "40px 16px" }}>
        <div style={{ fontFamily: sans, fontSize: 13, color: "#fff", letterSpacing: ".06em", marginBottom: 10 }}>
          WHAT YOUR CUSTOMER SEES · TAP ANYWHERE TO CLOSE
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ padding: "22px 22px 18px", borderBottom: `1px solid ${C.rule}` }}>
            <div style={{ fontFamily: sans, fontSize: 13, letterSpacing: ".08em", color: C.mute }}>YOUR POOL</div>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 25, color: C.ink, marginTop: 3 }}>{d.addr}</div>
          </div>

          <div style={{ padding: "20px 22px 0" }}>
            <div className="flex gap-1">
              {MILESTONES.map((m, i) => (
                <div key={m} className="flex-1">
                  <div style={{ height: 6, borderRadius: 2, background: i <= d.at ? C.deep : C.rule }} />
                  <div style={{ fontFamily: sans, fontSize: 10.5, color: i <= d.at ? C.deep : C.mute, marginTop: 6, textAlign: "center" }}>
                    {m}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "22px 22px 0" }}>
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 21, color: C.ink }}>{d.status}</span>
              <span style={{ fontFamily: mono, fontSize: 13, color: C.mute }}>{d.week}</span>
            </div>
            <p style={{ fontFamily: sans, fontSize: 16, color: C.body, lineHeight: 1.6, marginTop: 10 }}>{d.plain}</p>
          </div>

          <div style={{ padding: "20px 22px 0" }}>
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: C.mute, marginBottom: 10 }}>
              THIS WEEK · {d.shots} PHOTOS
            </div>
            <div className="flex gap-2">
              {[0,1,2,3].map((i) => (
                <div key={i} className="flex-1 flex items-center justify-center"
                  style={{ aspectRatio: "1", background: i % 2 ? "#E7EDF0" : "#DDE6EA", borderRadius: 3 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.mute} strokeWidth="1.6">
                    <path d="M3 8h3.5l1.5-2h8l1.5 2H21v12H3z" strokeLinejoin="round" />
                    <circle cx="12" cy="13.5" r="3.4" />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          <div style={{ margin: "22px 22px 0", padding: 16, background: C.bg, borderRadius: 3 }}>
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: C.mute }}>WHAT'S NEXT</div>
            <div style={{ fontFamily: sans, fontSize: 16, color: C.ink, marginTop: 5 }}>{d.next}</div>
          </div>

          <div style={{ padding: "20px 22px 24px", fontFamily: sans, fontSize: 14.5, color: C.mute, lineHeight: 1.6 }}>
            Questions? Text or call anytime. We update this page as we go — no login, same link all the way through.
          </div>
        </div>

        <div style={{ fontFamily: sans, fontSize: 13.5, color: "#fff", opacity: .85, marginTop: 14, lineHeight: 1.6 }}>
          No costs, no sub names, no checklists. 19 build phases collapse to 6 milestones —
          your customer doesn't need to see your QC apparatus.
        </div>
      </div>
    </div>
  );
}

/* ── app ────────────────────────────────────────────────── */
export default function Gate() {
  const [toast, setToast] = useState(null);
  const [watered, setWatered] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [sched, setSched] = useState(START_SCHED);
  const [weekOpen, setWeekOpen] = useState(false);
  const clash = findClashes(sched).length > 0;
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const shoot = (tag) => setToast(`Photo saved · ${tag} · 2:14 PM`);

  return (
    <div className="min-h-screen w-full" style={{ background: C.bg, paddingBottom: 60 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>

      <div className="mx-auto" style={{ maxWidth: 560, padding: "0 16px" }}>
        <div className="flex items-baseline justify-between" style={{ padding: "26px 0 22px" }}>
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", color: C.ink }}>gate</span>
          <span style={{ fontFamily: sans, fontSize: 14, color: C.mute }}>Synced 2 min ago</span>
        </div>

        <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", color: C.gate, marginBottom: 12 }}>
          {clash ? 4 : 3} THINGS NEED YOU
        </div>
        <GateCard onShoot={shoot} />
        <InspectionCard />
        <DrawCard />
        {clash && <WeekCard sched={sched} onOpen={() => setWeekOpen(true)} />}

        <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", color: C.mute, margin: "28px 0 12px" }}>
          RUNNING
        </div>

        <RunningCard
          name="Delgado" addr="Kelsey Park" status="Curing" meta="Day 4 of 7" tone="park"
          sub={watered ? "Watering logged 2:14 PM — next check tonight" : "Last watering logged 6 hours ago"}
          action={watered ? "Logged" : "Log watering"}
          onAction={() => { setWatered(true); setToast("Watering logged · Delgado · day 4 of 7"); }}
          onShoot={shoot} onShare={setCustomer}
        />

        <RunningCard
          name="Whitaker" addr="Bell Farms" status="Startup" meta="Day 12 of 28" tone="park"
          sub="Last reading 18 hours ago — test due this morning"
          action="Log readings" expand onShoot={shoot} onShare={setCustomer}
        >
          <ChemPanel />
        </RunningCard>

        <RunningCard
          name="Boyd" addr="Upland & 114th" status="Decking" meta="Wed pour" tone="go"
          sub="Tracks in, clearance verified — ready for the pour"
          action="Add note" onAction={() => setToast("Note added · Boyd")} onShoot={shoot} onShare={setCustomer}
        />

        {!clash && <WeekCard sched={sched} onOpen={() => setWeekOpen(true)} />}

        <div style={{ fontFamily: sans, fontSize: 13, color: C.mute, marginTop: 26 }}>Mockup · sample data</div>
      </div>

      {toast && (
        <div className="fixed left-0 right-0 flex justify-center px-4" style={{ bottom: 20, zIndex: 30 }}>
          <div style={{ background: C.ink, color: "#fff", padding: "13px 18px", borderRadius: 3,
            fontFamily: sans, fontSize: 15, maxWidth: 520, width: "100%" }}>
            {toast}
          </div>
        </div>
      )}

      {customer && <CustomerView name={customer} onClose={() => setCustomer(null)} />}
      {weekOpen && (
        <WeekBoard sched={sched} setSched={setSched}
          onClose={() => setWeekOpen(false)} onToast={setToast} />
      )}
    </div>
  );
}
