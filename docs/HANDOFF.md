# Apex OS — handoff

**As of:** 2026-08-06, end of day. CI green on `main` and genuinely checking the
Designer contract. All seven repositories are pushed; nothing lives only on one
machine. **The stack is now deployed and live** at
`https://apex-os-nqlx.onrender.com` — see "First deploy, end to end" in
`docs/status.md` for the three fixes and the verification that got it there.

Deliberately short. `docs/status.md` is the source of truth for status and this
does not restate it — what follows is the state of play, what is in flight, and
the things a newcomer would not guess.

---

## Branches — all landed

Nothing is unmerged anywhere. Verified by diffing each branch against
`origin/main`, not by reading the branch list: the 2026-08-04 work was rebased
onto `main` under new SHAs, so four branches survive as content-identical
duplicates that `git branch --merged` does not recognise —
`feat/builder-design-tool`, `fix/builder-runs-in-a-browser`,
`docs/deploy-key-installed`, and `dev/designer-launch-config` which is strictly
behind. All four can be deleted from their remotes; until they are, the branch
list implies open work that does not exist.

**All seven repositories are pushed.** `apex-website` was carrying twelve
commits from 2026-07-28/29 that had never left the machine — a week of the
website workstream living on one disk. Pushed 2026-08-05.

## What Apex Designer became

Two sessions, and it is a change in kind rather than degree: it was a calculator
that printed a plan, and it is now something a builder draws in with the takeoff
running underneath.

**The 2026-08-05 session is recorded in `docs/status.md`.** Rotation of both
drawings from one control, free grid placement with objects snapping flush to
each other, corner-drag resizing, six presets, and a Tauri desktop shell that is
scaffolded but unbuilt. The rotate tool that the previous handoff listed as *not
built, and asked for* is built: a **view transform**, not a model change, because
shallow and deep are physical facts that a sheet rotation must not redefine.

Three properties worth carrying forward, and one that was given up.

**Kept: the spa's own suction and return live on the presets, not on
`STANDARD_MODEL`.** Developed run length is one of the seventeen signed
quantities and `STANDARD_MODEL` is the fixture the digest is pinned against.

**Kept: the engine has no UI imports.** That is what made the desktop shell a
window rather than a rewrite, and it is worth defending the next time something
looks easier to put in a component.

**Kept: refuse rather than approximate.** A deck drawn through the water is
refused with coordinates; presets state no pump and no gas load rather than
carrying placeholders that pass.

**Given up, deliberately: "placement never affects quantities."** That property
is what let the whole drag-and-drop layer land without touching the digest, and
it is gone as of quantity model v4. Moving a bench from the shallow end to the
deep end now changes the takeoff — because it genuinely displaces more water, and
the tool was only silent about it while the floor depth was a number typed once
and never revisited. **Laying out a design is now an act that changes what gets
ordered.**

## Where it stands

**The product is built.** Apex OS v1 build plan Steps 1–8 are complete, every
MVP item in PRD §19 exists, and Travis approved the inspection list, the gate
checklists, and the customer-facing copy as written on 2026-08-03.

**The deployment work is built too** — all nine planned slices plus a tenth
(staff sign-in) that was found missing partway through. Nothing is blocked on
code.

**Nothing is deployed yet.** No account exists, no data is real, no customer has
ever opened a link.

## In flight right now

Nothing is blocked on code. All 28 decision-register items are decided — Travis
approved the nineteen that were his on 2026-08-05. **What remains is four things
that need a person, and only one of them is a purchase.**

**The domain is the recorded blocker and it is smaller than it looks.** It has
been held back on purpose: Monsoon is expected to hand over the existing domain
(register item 21), and buying a second is waste if that lands. The thing worth
pressing is not the domain, it is *whether Monsoon has actually been asked and
gave a date.* If they have and it is moving, waiting is right. If nobody has
asked, that is the blocker — not the twelve dollars.

**Only the DNS record needs a final hostname.** The Cloudflare account is needed
for R2 regardless, and the R2 bucket, the Auth0 tenant and the Render blueprint
do not care what the host is called. Render serves a free `*.onrender.com`, which
is enough to prove the whole stack end to end and convert "built but never run"
into "running". `docs/runbooks/deployment.md` §1–2 is the procedure.

The four actions, in the order that unblocks the most:

1. **Ask Monsoon**, if nobody has. Ten minutes, and it settles the domain either
   way — a committed date means wait, silence for a week means buy one.
2. **Stand up Cloudflare + R2, the Auth0 tenant, and the Render blueprint, and
   deploy to the free host.** No domain needed. **Allowed Web Origins** is the
   setting that silently breaks sign-in if missed. Then `curl -s
   https://<host>/ready` and read the four startup lines — those are what the
   process actually resolved, where the dashboard only says what it was told.
3. **Get Travis to name the three-to-five pilot jobs** (PRD FINAL §20.12). Five
   minutes, and the Definition of Done cannot begin without it.
4. **Start the contract amendment**, and pair it with the SMS consent question
   (D-14) — one lawyer conversation answers both. Item 1's approval does not
   discharge its own precondition: nothing in PRD 03 §5 may be billed until the
   agreement is amended.

**Issue no real customer link until the hostname is final.** A link's origin is
fixed when it is issued and only the token hash is stored, so a link sent
against a host you later move off cannot be recovered — only reissued. This is
what makes a free-host deployment safe to do now: prove the stack, issue nothing.

**The thing none of the above is.** No real Apex project exists in this system.
Not one. Every screen renders seeded test data, and that has been true since the
2026-07-31 audit said so. Steps 1 and 3 are what change it.

**Expected 2026-08-06: a second completed pool.** PRD 03 and PRD 04 are both
written and neither can run until one job has been carried end to end. The exact
collection list is `apex-prds/decision-register.md` §7.1 — and the half that
matters is the half Whitaker never had, because Whitaker holds dollars and no
measured quantities. A completed job proves the arithmetic; it cannot prove the
gates, the evidence or the draws, which is why §7.2 asks separately for the name
of a pool that is about to start.

## Eight things that are not obvious

1. **The restore procedure has never been run.** It is written
   (runbook §5) and untested. An untested backup is a belief, not a control —
   exercise it before the pilot carries real money.
2. **A customer link's origin is baked in when it is issued.** The database
   stores only the token hash. Issue no real link until the domain is final, or
   those links will point at a host you have moved off.
3. **Row-level security is deliberately retired** (migration `0019`). The API is
   the single enforcement point. The policies are kept but inactive, and
   `pg_tables.rowsecurity` is false so the schema does not claim otherwise.
   Revisit before multi-user SQL access.
4. **The Designer contract test is the only one that reaches across
   repositories**, and as of 2026-08-05 it finally runs in CI. `Apex Designer/`
   is a separate private repository, so CI checks it out with a read-only deploy
   key; without one the test skips, which for most of this project's life it
   silently did. What makes the signal trustworthy is
   `APEX_REQUIRE_DESIGNER_CONTRACT=1`: where the key is present, a missing
   engine fails the run instead of reverting to a skip. Rotating the key means
   adding the new public half **before** removing the old one, or CI goes red in
   between.
5. **The staff token lives in `sessionStorage` and there are no refresh
   tokens.** Tab-scoped, gone on browser close, readable by any script on the
   origin — which the `script-src 'self'` CSP is what makes acceptable. An
   expired token returns the sign-in screen.
6. **Inspection lead times are conservative placeholders**, not measurements —
   two business days routine, three for finals, rounded up so a deadline fires
   early rather than late. Tighten them once real inspections have been observed;
   it is one number per row and only sharpens the warnings.
7. **Placement now affects quantities, as of quantity model v4.** For most of
   this project's life it did not, and that invariant is quoted in several
   places that predate 2026-08-05. Step and seat floor depth is derived from
   where the object sits, so moving one changes its displacement and every
   volume downstream. A revision approved under v2 or v3 does not mean the same
   thing as one approved under v4; that is what the version string is for, and
   the database deliberately keeps the older values on historical rows.
8. **One test failed once and has not reproduced.** A `duplicate key on
   app_users_pkey` during a fresh-clone run, not seen again across many full runs
   or in CI. Unexplained. If it reappears, capture the failing file.

## Where the detail lives

| Document | What it answers |
|---|---|
| `docs/status.md` | Current status, per component. The authority. |
| `docs/plans/apex-os-v1-build-plan.md` | What was built and why, Steps 1–8 |
| `docs/plans/deployment.md` | Why deployment is shaped this way; the ten blockers |
| `docs/runbooks/deployment.md` | What to type, in what order, and what to do when it breaks |
| `docs/decisions/construction-model.md` | Confirmed phases, gates, draws, inspections |
| `docs/inspections-and-gate-checklists-2026-08-03.md` | The approved inspection list and checklists |
| `apex-prds/decision-register.md` | All 28 decisions, who made them, and the three reversals in §4 |
| `apex-prds/03-cost-capture-allocation.md` | How actual GP per job is captured; the gate for the commission engine |
| `Apex Designer/src-tauri/README.md` | Building the desktop shell, and why it is unsigned |

## Running it locally

```bash
pnpm install && pnpm verify
```

`verify` builds the workspace, builds the staff app, and runs 436 tests. It
works from a fresh clone. Postgres, S3, and Designer integration tests skip
without `DATABASE_URL`, `S3_ENDPOINT`, and the Designer repository respectively —
skipping is not passing, and each says so when it skips.

To run the app: `apps/gate-api` needs `GATE_JWT_SECRET` and optionally
`GATE_LOCAL_USER` for a tokenless single-machine session. Neither may exist in a
deployed environment, and the service refuses to start if they do.
