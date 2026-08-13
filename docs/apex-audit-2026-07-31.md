# Apex Folder Audit — Vision Recapture

> **Historical audit:** This is a point-in-time finding from 2026-07-31, not current status. The assistant/operating workflow described as missing here was subsequently implemented. Use root [`STATUS.md`](../STATUS.md) for current facts.

**Date:** 2026-07-31
**Scope:** `…\Nick-Assistant\Projects\Apex` (full tree, node_modules and git internals excluded)
**Purpose:** Measure what has actually been built against the vision, and find where the two drifted apart.
**Status:** Audit only. Nothing was modified, moved, or deleted.

---

## 1. The headline

**You built the vault. You have not built the assistant.**

The vision opens with one concrete promise: *the owner gets a clear picture of the business every morning.* Seven bullets follow — what needs attention, what's at risk, what's ready to move, what's blocked, what's ready to bill, who needs communication, where money or time is slipping.

**Zero of those seven have code behind them.**

What does exist is 5,278 lines of a genuinely well-engineered trust substrate: canonical IDs, versioned Zod contracts, an append-only event log, row-level authorization, private hashed evidence storage, tamper-evident SHA-256 quantity digests, and an idempotent gate command service. All of it tested — 85 root tests plus an integration test, all passing, zero TODO/FIXME/stub markers, zero hardcoded secrets, fail-closed everywhere.

That is the hard part and it is not wasted. But it is the part that makes the answers *trustworthy*. Nothing in the repo yet produces an answer.

**The honest framing:** three consecutive build cycles went into provenance depth the vision never asked for — digest chains, tamper cases, cross-repo verifiers — while the literal first sentence of the vision has zero lines of code.

---

## 2. Vision → reality scorecard

### "A clear picture of the business every morning"

| Vision item | State | Where it stands |
|---|---|---|
| What needs his attention | **Not built** | Action-card engine (build plan Step 4). Nothing exists. |
| Which projects are at risk | **Not built** | No risk model, no phase model, no target windows. |
| What is ready to move forward | **Partial** | Today feed shows Gate status only — and says so on screen. One gate type. |
| What is blocking progress | **Not built** | No blocker concept outside a single gate's requirement list. |
| What is ready to bill | **Partial** | `draw.eligible` event fires on gate release. No draw schedule, no ready-to-bill card, no QuickBooks. |
| Which customers need communication | **Not built** | `customer_update.published` exists as an event; the message text is hardcoded English for pre-gunite. Customer page is still mock data with a "do not share" banner. |
| Where money or time may be slipping | **Not built** | No schedule authority, no budget-vs-actual in the OS. |

**1 of 7 partially answered. 0 fully.**

### "When a gate is passed, the system should know what happens next"

| Vision item | State |
|---|---|
| Schedule the next phase | **Not built** — no phase model, no schedule authority |
| Prepare a customer update | **Partial** — event exists, content hardcoded for one gate |
| Release the next draw | **Partial** — eligibility only, no draw schedule |
| Record the signoff | **Built** — append-only events, hashed evidence, RLS. This is the strongest thing in the repo. |
| Alert the right people | **Not built** — no notification layer at all |

### The business outcomes

| Outcome | State |
|---|---|
| More consistent customer experience | Not started |
| Protect quality at critical milestones | 1 of 9 gate templates built (pre-gunite) |
| Reduce costly mistakes | Not measurable yet |
| Improve communication with customers and subs | None built |
| Invoice completed work faster | Not built |
| **Build better records for every project** | **Built — and built well** |
| Depend less on the owner remembering | Not built |
| Grow without creating more chaos | Not measurable yet |

**1 of 8.**

---

## 3. The real blocker is not code

**No real Apex project exists in this system.** Not one. Every screen you can look at today renders either seeded local test data or labelled mock data.

PRD §20 lists 12 open decisions. Four of them block real construction work and **only Travis can answer them**:

- **Q3** — Who may pass each gate: field lead, PM, or owner?
- **Q4** — What are Apex's exact construction phases and gate templates?
- **Q5** — Which draw schedules are standard vs contract-specific?
- **Q6** — Which inspections vary by jurisdiction?

Build plan Steps 3, 5, and 6 stall without these. The build plan's own answer was "build against documented defaults and flag each assumption." That is the right call for momentum and the wrong call for a system whose entire premise is that a gate means the work was *actually verified*. A gate template invented in Lubbock ISPSC and not confirmed by the person who builds the pools is a checklist, not a gate.

Add Q12 to that list — *which three to five active projects provide the best pilot coverage* — because the Definition of Done (§21) cannot begin until it's answered.

**Pushback:** the vision says "Apex is the first builder because this should be built around a real person, a real team, and real projects — not hypothetical software requirements." Right now it is being built around hypothetical requirements. That is the single largest gap between the vision and the work.

---

## 4. The vision itself is missing from the repo

There are currently **six** places that claim to say what Apex is:

| Location | Framing |
|---|---|
| `README.md` product thesis | "Capture once, calculate once, approve once…" — data-integrity framing |
| `PRD.md` §2.1 | "Build a calm, focused operating system…" — closest to the vision |
| `PRD.md` §22 | "the daily control system for Apex Designer Pools" — product framing |
| `docs/status.md` executive status | Engineering-readiness framing |
| `apex-handoff.md` | Original client context; marked historical, still in root |
| `SESSION-HANDOFF.md` | Jul 26 build state; marked historical, still in root |

**None of them is the version you just wrote.** The owner-life framing — *he can step away from the phone, he feels less overwhelmed, quality/communication/scheduling/cash flow stop being separate problems* — exists nowhere on disk. Every artifact in the repo restates the vision in the register of whoever wrote it last: engineer, product, or consultant.

That is what "recapture the vision" actually means here. The vision didn't get lost in a bad decision. It got translated, six times, into progressively more technical language, until the surviving version is about digest integrity.

**Recommendation:** write the pasted vision to `docs/vision.md` verbatim as the single upstream source. Make `README.md` and `PRD.md` §2 point *up* at it rather than restating it. Every future build decision gets tested against one question: *does this make the owner's morning quieter?*

---

## 5. Contradictions and drift found

| # | Issue | Detail |
|---|---|---|
| 1 | **Phase disagreement** | `README.md` says "Phase 1 — Shared operational spine." `docs/status.md` says "Program phase: Phase 0 — Preserve and stabilize." Both are current. |
| 2 | **Stale status date** | `status.md` header says "Last updated 2026-07-29" but carries a 2026-07-31 section. |
| 3 | **Wrong source path** | `docs/repositories.md` records the local root as `Desktop\Apex`. Everything actually lives under `Desktop\Nick-Assistant\Projects\Apex`. |
| 4 | **README component table is stale** | It lists `gate-v3.jsx` as the field prototype and never mentions `apps/apex-os`, which was adopted 07-31 and is now the actual UI. |
| 5 | **apex-os tests can never run** | Root `vitest.config.ts` include pattern matches `*.test.ts` only — not `.tsx`. `apps/apex-os` has **zero tests** and the config would not pick them up if written. |
| 6 | **Cross-workspace raw import** | `integration-tests/designer-contract.test.ts` imports `../Apex Designer/src/engine/index.ts` — a relative path into a sibling *independent git repo* outside the pnpm workspace. Invisible to the workspace graph and to `tsc -b`. A Designer refactor breaks root CI with no signal. |
| 7 | **Storage migration never runs in the app** | `packages/database` deliberately excludes `0003_evidence_storage.sql` from `OPERATIONAL_MIGRATIONS` — it's applied by tests only. The evidence bucket policies are tested but not provisioned by `createLocalDatabase`. |
| 8 | **Job status enum mismatch** | `JobSchema` allows 3 statuses; the DB check constraint allows 5. Documented in code as a known disagreement, unresolved. |
| 9 | **Live database in the project folder** | `var/dev-gate-db/` is a running local Postgres cluster (1,088 files, live `postmaster.pid`, written 07-31 18:16) sitting inside the project directory. Gitignored, but it's live state in a source tree. |
| 10 | **Two dirty working trees** | Root repo: `PRD.md`, `package.json`, `.gitignore`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` all modified after the last commit. `apex-proposal-engine`: `engine.mjs` and `engine.test.mjs` modified after its last commit. |
| 11 | **`tmp/` is untracked and not ignored** | Root `.gitignore` covers `*.tmp`, not `tmp/`. 14 scratch n8n files, two of them zero bytes, are one `git add .` away from the history. |

---

## 6. Structural clutter

Seven independent git repos live in this folder, all pointing at private `nrsandoval1231-oss/*` remotes, all deliberately excluded from the root `.gitignore` per the Phase 0 preservation model. That was a sound decision. The side effects have accumulated:

**Self-nested wrapper directories** — three folders contain nothing but a child of the same name:
- `apex-lead-engine/apex-lead-engine/`
- `apex-prds/apex-prds/`
- `apex-website/apex-website/`

Pure path noise. `docs/repositories.md` even records the doubled paths as canonical.

**Duplicate content:**
- `PRD.md` is byte-identical to `.hermes/desktop-attachments/Apex_OS_PRD_v1.md`
- `gate-v3.jsx` has a stray identical copy inside the *website* repo's attachments folder
- `apex-handoff.md` is byte-identical to the copy inside `Apex ideas.zip`
- `Apex ideas.zip` duplicates three repos wholesale as older doc-only snapshots — nothing in it is newer than what's on disk
- `_inbox/Downloads-2026-07-29/apex-strategy-deck.pptx` (305 KB) is an older render of the root deck (509 KB)
- `Apex Lead Engine/` (capital, 2 files) is an orphaned Jul-27 status snapshot of `apex-lead-engine/apex-lead-engine/`

**Dead weight candidates** — *proposed only, nothing touched:*

| Item | Why |
|---|---|
| `Apex ideas.zip` | Fully superseded by live repos |
| `_inbox/Downloads-2026-07-29/` | 5 regenerable exports and superseded copies |
| `tmp/` | Abandoned n8n scratch session, 2 zero-byte files, 5 progressive copies of one workflow |
| `Apex Lead Engine/` (capital) | Orphaned status note, superseded by `SESSION-HANDOFF.md` |
| `.hermes/desktop-attachments/` | Duplicate PRD + 2 PDFs already transcribed into proposal evidence fixtures |
| Root `.pptx` / `.png` artifacts | Regenerable from `apex-decks/` |

**These are recommendations. Nothing has been deleted or moved.** If you want any of it cleaned up, say so and I'll show you the exact plan and what can't be undone first.

---

## 7. What is actually strong

Worth naming, because the audit reads harsh and the engineering does not deserve it:

- **`packages/contracts`** — 11 ULID-prefixed canonical ID kinds, a 24-type discriminated event union, a 17-code canonical quantity vocabulary with a fixed unit map, and a real `superRefine` that checks duplicates, units, Calc-ledger provenance, and recomputes the digest. Dense, no stubs.
- **`packages/domain`** — pure gate aggregate. Office cannot release. Customer cannot evaluate. Evidence attached ≠ requirement passed. Release blocked without an approved takeoff revision. Zero stubs, 285 LOC.
- **`packages/database`** — 1,023 lines of SQL across 9 forward-only migrations, 16 tables, RLS policies, append-only triggers, immutability constraints. Tested against real PGlite.
- **`apps/gate-api`** — no framework, bare `node:http`. JWT with issuer/audience pinning *plus* a DB re-check that the user is still active with the same role. Magic-byte MIME sniffing, path-traversal guard, atomic write-and-rename with rollback. Strict CSP.
- **The refusal discipline** — `calibrate.mjs` exits non-zero rather than emit pricing guidance. The digest migration refuses to invent historical evidence. Wired screens show explicit empty/error states rather than fall back to sample data. Contract totals outside safe-integer range are refused rather than silently floated.

That last one matters most. A system whose purpose is trustworthy field evidence that would rather show nothing than show something invented — that instinct is correct and it is rare.

**Also strong and independently useful:** `Apex Designer` (318 tests, clean, real geometry/takeoff engine) and `apex-proposal-engine` (116 engine checks, hash-pinned Whitaker evidence, the 23.08%-margin finding). Both are further along than Apex OS and neither is mentioned in the PRD.

---

## 8. Where the PRD and the vision disagree

Mostly they don't — PRD §3 (Problem Statement) is a near-perfect restatement of "too much of the business lives in his head, his phone, and his daily presence." Three real gaps:

1. **"Should not force his team to completely change how they work."** The current build direction is a web app the field team must open. PRD §11.1 lists SMS as a pilot integration but no ingress path exists — no way for a field lead to text a photo and have it land as gate evidence. Today the information moves through the owner's phone. The system currently assumes it will move through a browser instead. That's the vision's "additive, not disruptive" principle (§6.4) not yet honored in the architecture.

2. **"Depend less on the owner remembering everything."** Every gate authority rule currently built routes *up* — office can't release, field can't release. A system where only the owner can pass gates concentrates his attention rather than freeing it. PRD §20 Q3 is exactly this question and it's unanswered. Get it wrong and you've built a more rigorous version of the problem.

3. **"Not automation for its own sake."** The Whitaker calibration work, the digest chain, the cross-repo verifier — each individually defensible, collectively a drift toward proving correctness over delivering calm. The vision's success criterion is *the owner feels less overwhelmed*, and nothing in the repo measures that.

---

## 9. What I'd do next

The build plan (`docs/plans/apex-os-v1-build-plan.md`) sequences Steps 2→8 and it is a sound sequence. My disagreement is with the ordering rationale, not the steps.

**Before Step 2:** get Travis in a room. Q3, Q4, Q5, Q6, Q12. That's one conversation and it unblocks four of the seven remaining build steps. Right now the plan proposes to build the 15-phase model into a migration on documented defaults — cementing guessed phases into schema is the most expensive kind of wrong.

**Reorder toward the vision.** The build plan puts the action-card engine at Step 4. It is the vision's first sentence and its only visible outcome. Everything on the Today feed, the daily brief, and every notification in PRD §15 is one derived surface. Consider pulling a thin version of it forward — even three card types over the existing gate + job data would put the first real answer on screen and let Travis react to something instead of a description.

**Set a vision test.** Add one line to `docs/vision.md`: *no work item ships unless it changes what the owner sees on a Tuesday morning.* Then run every open item against it. The digest chain would not have passed. That's the point.

**Pick the pilot job now.** §21 requires 3–5 real projects. Not one exists. Everything downstream of that is theory.

---

## 10. Numbers

| Metric | Value |
|---|---|
| Workspace source (TS/TSX/SQL) | 5,278 LOC |
| Runtime vs test | 2,572 / 1,683 (+1,023 SQL) |
| Test files | 8 |
| Tests passing | 85 root + 1 integration |
| TODO/FIXME/stub markers | 0 |
| Hardcoded secrets | 0 (one test-only literal) |
| Gate templates built | 1 of 9 |
| MVP items (PRD §19) complete | 0 of 9 |
| Definition-of-Done items (§21) met | 0 of 11 |
| Real Apex projects in the system | **0** |
| Independent git repos in folder | 7 |
| Dirty working trees | 2 |
| Open PRD decisions | 12 (4 blocking) |
