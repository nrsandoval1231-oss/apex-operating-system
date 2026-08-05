# Apex OS — handoff

**As of:** 2026-08-04, root at `547a080` on `main`, CI green.

Deliberately short. `docs/status.md` is the source of truth for status and this
does not restate it — what follows is the state of play, what is in flight, and
the things a newcomer would not guess.

---

## Open branches, 2026-08-04

Three repositories carry unmerged work. All are pushed; none has a PR.

| Repo | Branch | What it is |
|---|---|---|
| `apex-designer` | `feat/builder-design-tool` | 11 commits. Designer became a drawing tool. |
| `apex-proposal-engine` | `fix/builder-runs-in-a-browser` | The builder page was completely inert. |
| `apex-operating-system` | `dev/designer-launch-config` | One dev-tooling commit. |

**Apex Designer is the session's main work** and is a change in kind, not
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

Nick is setting up the four accounts: Render, Cloudflare R2, an identity tenant
(Auth0 or Clerk), and a domain. `docs/runbooks/deployment.md` §1–2 is the
procedure.

Next three actions, in order:

1. Domain first — Auth0's callback and web-origin settings need the final URL.
2. Fill the nine `sync: false` variables in the Render dashboard.
3. Deploy, then `curl -s https://apex.<domain>/ready` and read the four startup
   lines. Those lines are what the process actually resolved; the dashboard only
   says what it was told.

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
4. **The Designer contract has a CI signal only once you add a deploy key.**
   `Apex Designer/` is a separate preserved repository. CI now checks it out and
   runs the contract test, but that needs `APEX_DESIGNER_DEPLOY_KEY` — four
   steps in `docs/runbooks/deployment.md` §8, none of which anyone but you can
   do. Until then CI warns and the test skips, as it always has.
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
