# Apex — Session Handoff

Written 2026-07-26 (second session). Supersedes the previous SESSION-HANDOFF.
Original project context is in `apex-handoff.md`; the PRD set is the source of truth for
decisions. This document is the build state on top of them.

Everything is one brand, four verticals (exact enum, order-sensitive):
`Designer Pools · Concrete Coating · Design & Renovation · Pool Service`.

---

## TL;DR — five repos, all clean

| Project | Location | State |
|---|---|---|
| **Website** (PRD 01 site) | `apex-website/apex-website/` | Phases 1–3 done, Lighthouse 96/100/100/100 |
| **Lead engine** (PRD 01 automation) | `apex-lead-engine/apex-lead-engine/` | Phase 1 intake deployed **inactive**; job-status signal built |
| **Proposal engine** (PRD 02) | `apex-proposal-engine/` | **v0.5 — back-test passes at 0.0%.** 82 tests |
| **PRD set** | `apex-prds/apex-prds/` | 00, 01, 02, 06 written · 03, 04, 05 blocked |
| **Decks** | `apex-decks/` | Generators for both client decks |

Build artifacts at `Apex/` root (not in git): `apex-strategy-deck.pptx` (20 slides),
`apex-pitch.pptx` (4 slides), `apex-system-diagram.png`.

**Nothing is live.** The build is roughly two sessions ahead of the decisions — see
`apex-prds/apex-prds/decision-register.md`, which is the single most useful file for deciding
what to do next.

---

## 1. Travis confirmed three build standards — this changed every number

**A proposal now needs only length × width.** Everything else follows:

| Standard | Value |
|---|---|
| Depth profile | always 3.5 → 6.0 ft |
| Spa | always **6 × 6 × 3.5** |
| Deck | always a **4 ft border** |
| Resourcing | subs do **excavation, gunite, electrical, concrete decking**. One in-house crew (one lead) does everything else. Max five jobs at once |

**The spa correction is load-bearing and easy to get wrong.** The reference takeoff originally
assumed 7×7 and published **921 sq ft / 104 LF / 13,222 gal**. Those figures are **superseded**.
Correct values: **887 sq ft wetted · 100 LF perimeter · 12,881 gallons.**

Because every unit cost is back-solved (his dollars ÷ our quantity), the whole rate library moved
with it — gunite $424 → **$439.56**/yd³, plaster $85 → **$87.21**/bag, coping $75.50 → **$71.23**/LF.
`node calibrate.mjs` re-derives them; re-run it if geometry ever changes again.

---

## 2. Proposal engine — the real estimate arrived, and the back-test passes

Travis supplied the **actual Whitaker Oasis estimate PDF**. Its full line schedule is now captured
in `whitaker-actual.mjs`. All 13 section subtotals and the grand total reconcile to
**$116,955.18**, which is what verifies the read (the PDF used a subset font, so labels were
reconstructed from context but the figures decoded cleanly).

`node backtest.mjs` — **every modelled cost code lands exact:**

| Code | Model | Actual |
|---|---|---|
| 200 Excavation | $7,000 | $7,000 |
| 400 Pool Shell | $16,801 | $16,800 |
| 800 Pool Finishes | $20,750 | $20,750 |
| 1000 Pool Deck | $10,001 | $10,000 |
| 1300 Additional Upgrades | $7,000 | $7,000 |
| **modelled codes** | **$61,552** | **$61,550 → 0.0%** |

Enter his direct-entry lines too and the whole job lands **$116,961 vs $116,955.18**, with 89.8%
of job cost substantiated.

**Four modelling errors the back-test exposed and closed:** tile *labor* (priced material only,
missing $2,500), a $550 Forming line no assembly had, $1,500 of site work separate from the dig,
and a **deck double-count** — the engine billed a deck takeoff *and* kept the Concrete Diamonds
allowance for the same concrete. Allowances now carry `supersededBy`, so taking off a cost code
drops the allowance covering it.

Finishes now bill as separate **Materials + Labor lines**, matching his estimate exactly, because
they have genuinely different drivers (tile material per sq ft of band, tile labor per LF of run).

**Still one job.** The rates reproduce Whitaker because Whitaker calibrated them — that result is
partly circular. **A second completed pool landing within 10% is what turns "method proven" into
"numbers trusted."** Largest remaining unmodelled item is plumbing at $13,100, split across
cost codes 500 and 700.

### Files
`engine.mjs` (pure engine) · `engine.test.mjs` (82 checks) · `backtest.mjs` · `whitaker-actual.mjs`
· `calibrate.mjs` · `crew.mjs` (capacity) · `report.mjs` (CLI takeoff) · `index.html` (builder UI)

```bash
cd apex-proposal-engine
node engine.test.mjs      # 82 pass
node backtest.mjs         # gate: within 10% — passes at 0.0%
node report.mjs 30x15 --spa 6x6 --carry
node crew.mjs
npx serve .               # the builder UI (module imports need a server)
```

---

## 3. The capacity finding — cap WIP at three, not five

`crew.mjs`. A pool is **22.1 elapsed working days but only 13.7 crew-days** — the rest is sub work
or waiting, and that waiting is what lets one crew carry several builds.

Little's Law puts the knee at **3 concurrent jobs**. Past that, annual output is flat at ~19 pools
and only the queue grows: **at five, every customer waits 5.5 weeks longer for the same output.**
Under cost-plus that is pure loss — no extra revenue, more PM time absorbed by GP, longer
referral-risk window.

**Caveat:** crew effort per phase is estimated. Across plausible values (8–17 crew-days) saturation
lands between 3 and 5, so the exact cap is unsettled — the *shape* holds everywhere. Logging actual
crew-days on two pools settles it, which is why PRD 06 §9 makes that the highest-value field in the
system.

---

## 4. PRD 06 written · job-status signal built · D-12 resolved

**`06-project-management.md`** is written (was a placeholder), retitled *Job Execution & Crew
Scheduling*. Key positions:

- Under cost-plus, **PM is not cost control** — overruns pass through. It optimises cycle time,
  substantiation, referral risk. Falsifiable test in the doc: *if the daily screen leads with a
  budget chart, this was implemented wrong.*
- **Gunite is the pivot and a queue** — one crew in Lubbock, freeze season closes it, so slots are
  booked **first** and schedules built backward.
- **Phases are items on a Schedule board, not subitems.** Monday cannot give a cross-job resource
  view from subitems, and that view *is* the product.
- **Three shapes, not four boards:** Project (pools, renovation) · Job (coating) · Route (service —
  not a project at all).

**Phase 1 shipped: the job-status signal.** `apex-lead-engine/workflows/02-job-status.ts`, validated
(10 nodes). The signal is a **contract, not a platform** — `docs/job-status-contract.md`, one POST
per transition to `/apex-job-status`. Idempotency comes from a **derived** `event_id`
(`evt_<job_id>_<to_status>`), which also means a reopened-and-recompleted job earns no second review
request.

It **sends nothing**, so it can go live immediately. **D-12 is resolved** —
Phase 4 now needs only D-11 (SMS), Phase 5 only D-01 (Meta access).

Board spec for the emitting side: `apex-prds/apex-prds/reference/monday-jobs-board-spec.md`.

---

## 5. ⚠ Monday — do not build in the connected account

The Monday MCP is authorised, but against **Nick's own trial CRM account** (`Sandoval Dynamics`,
Pro trial, 1 seat, default Contacts/Deals/Leads boards). Nick's instruction: **do not build there.**

Decisions taken:
- **Apex gets its own account**, created on an **Apex-owned email** with Travis as owner. The reason
  is concrete: the whole project is currently blocked waiting on Monsoon to release the domain, GTM,
  GA4 and Meta — exactly what happens when the agency owns the accounts.
- **Work Management, not CRM.** Phase 2's crew timeline needs Workload and Calendar views across
  items; Monday CRM does not have them. Phase 1 works on either.
- Access should come via the **claude.ai connector**, not a pasted API token.

Also worth knowing: **Monday's native webhook is not the contract** — it sends a compact shape with
no contract value, lead ID or customer details. The spec recommends a thin n8n adapter that queries
the item and maps it, keeping the payload mapping in the repo.

---

## 6. Decision register — the actual bottleneck

`apex-prds/apex-prds/decision-register.md` — **28 open items**, grouped by owner, ranked by what
each unlocks. Travis owns 19, Nick owns 9, one needs counsel.

**Six unblock the rest:** the contract review (~$13,750/pool, oldest and highest value) ·
QuickBooks setup · the allowance mechanic · Monsoon access transfer · the Airtable base (10 min,
Nick) · SMS provider + A2P registration (slow, and now gates **three** systems since subs are
off-platform).

**Three free wins needing no decision:** cap WIP at three · book gunite ahead of the freeze · start
logging crew-days.

Items marked **[MARGIN]** cannot be discussed without the 23.08% finding — flagged at the top of
the register so it cannot leak by accident.

---

## 7. Decks

`apex-decks/` holds the generators. `npm install`, then `node strategy-deck.js ../apex-strategy-deck.pptx`.

- **`apex-strategy-deck.pptx`** — 20 slides. Four findings, the spine, a system diagram (slide 11),
  the end-to-end walkthrough in customer language, and the full ask.
- **`apex-pitch.pptx`** — 4 slides. The same argument as a five-minute pitch: *your prices are right,
  your paperwork can't prove it* → the proof → two findings worth money → one thing I need.

**⚠ The 23.08% margin finding is deliberately in neither deck**, per standing instruction. Both are
written so nothing depends on it — Lever B runs as *"standard scope missing from your estimate."*
Commission language stays at "reconciled profit." Do not add it without checking.

**A Gmail draft exists** with a cover note for Travis (id `r7716411343283017764`). It is addressed to
Nick because the tool requires a recipient — **swap the recipient, attach the deck, then send.** The
connector cannot send, and a 490 KB attachment cannot pass through a tool call as base64.

---

## 8. Environment traps that cost real time

- **PowerShell 5.1 reads files as ANSI.** A `Get-Content -Raw` → `Set-Content` round-trip turns every
  em-dash and `×` into mojibake. It corrupted `strategy-deck.js` once and needed a full rewrite. Use
  the Write/Edit tools, not PowerShell, to edit text files.
- **No LibreOffice, no pip, no python-pptx, no markitdown.** For deck QA, drive PowerPoint over COM —
  `apex-decks/render.ps1`. PowerPoint opening the file is also the best validity check available.
- **pptxgenjs centres text vertically by default.** A two-line card and a four-line card will not
  start at the same height unless `valign: 'top'` is set. This caused three separate defects.
- **Node ESM on Windows** cannot import an absolute `C:\...` path — use a relative import from inside
  the package, or a `file://` URL.
- **PowerShell chokes on `$0:` and bare regex** in double-quoted strings; use a script file instead of
  a long `-e` one-liner.

---

## 9. How to resume

**If you only do one thing:** read `decision-register.md`. The build is ahead of the decisions and
more building widens the gap.

**Highest-value unblocks, in order:**

1. **Airtable base** (Nick, 10 min) — import `Leads.csv`, `Quarantine.csv` and
   `apex-lead-engine/setup/JobEvents.csv` as tables with exactly those names, grant the stored token
   access, send the base ID. **It must be the same Airtable account that owns the token already in
   n8n** — that token is data-only and 403s on schema ops. Then `02-job-status.ts` deploys and
   fixtures A–J run live.
2. **The contract review** (Travis) — one document, gates ~$13,750/pool.
3. **A second completed pool** — turns the takeoff engine from method-proven into trusted.
4. **Apex's own Monday account** — then PRD 06 Phase 1's board can be built from the spec.

**Deliberately not deployed:** `02-job-status.ts` is validated but not pushed to the n8n instance —
it would point at an Airtable base that does not exist yet, and Nick had just drawn a boundary about
writing into his accounts. Deploy is one call once item 1 lands.

**Known open thread:** PRD 03 (cost capture) and PRD 04 (commission) are still stubs, blocked on
QuickBooks setup and the allowance mechanic respectively. PRD 04's formula is already spec'd —
15%/15% staged, both stages on **estimated** GP with reconciliation as a release gate, which is the
fix for the cost-plus perverse incentive (Foundation §7).
