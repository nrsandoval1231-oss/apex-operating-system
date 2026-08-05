# Apex OS — handoff

**As of:** 2026-08-05, CI green on `main` — and now genuinely checking the
Designer contract, which it had never done before.

Deliberately short. `docs/status.md` is the source of truth for status and this
does not restate it — what follows is the state of play, what is in flight, and
the things a newcomer would not guess.

---

## Branches — all landed, 2026-08-05

Nothing is unmerged. Verified by diffing each branch against `origin/main`, not
by reading the branch list: the work was rebased onto `main` under new SHAs, so
the branches survive as content-identical duplicates that `git branch --merged`
does not recognise.

| Repo | Stale branch | Diff vs `origin/main` |
|---|---|---|
| `apex-designer` | `feat/builder-design-tool` | empty — same tree, 11 rebased commits |
| `apex-proposal-engine` | `fix/builder-runs-in-a-browser` | empty |
| `apex-operating-system` | `docs/deploy-key-installed` | empty |
| `apex-operating-system` | `dev/designer-launch-config` | strictly behind `main` |

All four can be deleted from their remotes. Until they are, the branch list
implies open work that does not exist.

**Apex Designer was the 2026-08-04 session's main work** and is a change in kind, not
degree. It was a calculator that printed a plan; it is now something a builder
draws in. Three preset sizes (12×24, 15×30, 20×40 — roughly 90% of Lubbock
work), drag to move and resize, a draggable section for depth, add/remove for
every object, saved designs, and an order list. 380 tests, up from 318.

Two properties worth preserving. **Placement never affects quantities** — moving
a bench changes the drawing and nothing in the takeoff, which is what let all of
this land without touching the approved-quantity digest. And **the spa's own
suction and return went on the presets, not `STANDARD_MODEL`**, deliberately:
developed run length is one of the seventeen signed quantities and
`STANDARD_MODEL` is the fixture the digest is pinned against. The Designer
contract test was run with `APEX_REQUIRE_DESIGNER_CONTRACT=1` to confirm the
digest did not move.

**The proposal builder fix matters more than its size.** Every field on the page
read "—" and no button did anything, for two stacked reasons: `node:crypto` in
the module graph killed evaluation before any handler attached, and the page
called the production takeoff path, which refuses without an approved Designer
revision. Nothing tested that page; `browser-graph.test.mjs` now does.

**Not built, and asked for:** a rotate tool. Two approaches, both real — a view
transform (drags map through the inverse; dimension text inverts at 180°) or a
model change (redefines what "shallow wall" means for every placed object).
Worth choosing deliberately.

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

Nothing is blocked on code, and as of 2026-08-05 only one thing is blocked on a
person: **a domain has not been chosen or registered.**

Auth0 is the confirmed identity provider. Render, Cloudflare R2 and the identity
tenant are all downstream of the domain, so the order below is not a preference.
`docs/runbooks/deployment.md` §1–2 is the procedure.

Next four actions, in order:

1. **Register a domain.** Deliberately its own, not the canonical marketing
   domain — that one is entangled in the Monsoon access transfer and a
   three-way naming choice, and Apex OS should not wait on either. Cloudflare,
   on an Apex-owned email, since the same account is needed for R2. Register
   only; the DNS record needs a Render service that does not exist yet.
2. Create the Render blueprint, the R2 bucket, and the Auth0 tenant. **Allowed
   Web Origins** is the one that silently breaks sign-in if missed.
3. Fill the nine `sync: false` variables in the Render dashboard.
4. Deploy, then `curl -s https://<domain>/ready` and read the four startup
   lines. Those lines are what the process actually resolved; the dashboard only
   says what it was told.

**Issue no real customer link until the domain is final.** A link's origin is
fixed when it is issued and only the token hash is stored, so a link sent
against a host you later move off cannot be recovered — only reissued.

## Seven things that are not obvious

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
7. **One test failed once and has not reproduced.** A `duplicate key on
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
