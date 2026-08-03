# Apex OS — Deployment Plan

**Written:** 2026-08-03
**Status:** Slice 1 in progress. Slices 2–9 sequenced below; two decisions needed
before slice 4.
**Why now:** every feature in the v1 build plan is complete and all content is
approved. Deployment is the only remaining workstream between this and a pilot.

---

## 1. What "deployed" has to mean

Not "production" in the general sense. Specifically, PRD §21's pilot:

- Three to five real Apex projects, with real money and real evidence in them.
- A **live customer link** — a homeowner opening `https://…/c/<token>` on their
  phone, from their house, on cellular. This is the only part of the system that
  a person outside the company touches, and it is what makes deployment
  unavoidable rather than a nicety.
- Field use on a phone at a jobsite, meaning TLS is not optional: evidence
  photographs and a bearer token cross a cellular network.

Everything below is scoped to that. Multi-tenant, autoscaling, and disaster
recovery are not in this plan.

## 2. What I cannot do, and you will have to

Being explicit up front so nothing waits on the wrong person:

- **Creating accounts** with a host, a database provider, or an identity
  provider.
- **Entering payment details**, or any credential, anywhere.
- **Provisioning infrastructure** or holding secrets.

I can write every line of code, the container definition, the deploy
configuration, the migration and rollback runbook, and the smoke test. I cannot
run the parts that require your accounts. Where a slice needs a value only you
can produce — a connection string, a JWKS URL, a bucket name — it is written to
read from configuration and documented in the runbook.

## 3. The blockers, honestly counted

Ordered by what blocks what, not by size. "Independent" means the work does not
change based on which host or provider you pick.

| # | Blocker | Cost | Independent |
|---|---|---|---|
| 1 | Services bind directly to `PGlite` | Small | Yes |
| 2 | No real Postgres adapter; migrations run on boot with no lock | Medium | Yes |
| 3 | Evidence is written to the local filesystem | Medium | Yes |
| 4 | **RLS policies exist but are inert** — see §4 | Medium–large | Yes |
| 5 | Symmetric HS256 pilot JWT; no JWKS, no rotation | Medium | Mostly |
| 6 | `GATE_LOCAL_USER` disables authentication entirely | Small | Yes |
| 7 | Customer links are path-only; no public origin configured | Small | Yes |
| 8 | No container, no deploy config, no TLS termination | Medium | **No** |
| 9 | No structured logging, health checks are shallow, no graceful shutdown | Small | Yes |
| 10 | No backup or restore procedure for a database holding real draws | Medium | **No** |

Seven of ten are provider-independent, which is why the sequence below starts
with them: real progress is available before any account exists.

## 4. The finding that matters most: RLS is currently decoration

`0002_rls.sql` and every migration since define row-level security policies —
admin/office/field/customer separation, `can_access_job`, staff-only reads on
inspections, customers never seeing subcontractor names. It reads like a second
line of defence behind the API.

**It is not currently enforcing anything.** Two facts, both verified:

1. Nothing anywhere in the codebase sets `request.jwt.claims`. Every policy
   predicate is built on `current_app_role()`, which reads that setting, so on a
   real connection every policy would evaluate against an empty role.
2. Everything runs as the PGlite owner, and **a table's owner bypasses RLS**
   unless the table is set to `FORCE ROW LEVEL SECURITY`. So the policies are
   skipped rather than failing.

The consequence is that the API is the *only* access control in the system
today. That is defensible for a loopback pilot. It is worth naming plainly
because moving to managed Postgres forces the question either way:

- Connect as the **owner** → policies stay bypassed, and the RLS layer remains
  decoration that reads like protection. Actively misleading to the next person.
- Connect as a **non-owner role** → policies activate, `current_app_role()`
  returns empty, and nearly every query denies. The app breaks loudly.

Neither is acceptable as an accident. §6 makes it a decision.

One wrinkle worth naming now: **the customer progress page has no identity at
all.** It is authorised by an unguessable token, not by a role, so under active
RLS it needs either a dedicated narrow role with its own policies or a
deliberately trusted connection. The token check would remain the real control
in both cases.

## 5. Sequence

Each slice ends green — `pnpm verify` passing — and none requires an account
until slice 8.

**Slice 1 — A database port (small). IN PROGRESS.**
`GateService`, `CustomerService`, and `InspectionService` take `PGlite` directly.
Introduce a narrow `Database` interface in `@apex/database` covering exactly what
the services use, and depend on that instead. PGlite satisfies it structurally,
so every existing test keeps passing unchanged and nothing is rewritten twice.

**Slice 2 — A real Postgres adapter (medium).**
A `pg`-backed implementation of the port, plus the two things embedded Postgres
let us ignore: a connection pool, and an advisory lock around migrations so two
instances starting at once cannot race the same `0018`. Integration tests run
against a real Postgres in CI.

**Slice 3 — An evidence storage port (medium).**
Four call sites in `server.ts` do filesystem I/O. Behind a `Storage` port with a
local adapter (unchanged for dev) and an S3-compatible adapter. Any of R2, S3, or
Spaces then works without further code change. Evidence is private and served
through the API, which already enforces both staff and customer paths, so no
public bucket and no signed-URL scheme is needed for the pilot.

**Slice 4 — Identity (medium). NEEDS A DECISION.**
Replace the symmetric HS256 pilot secret with asymmetric verification against a
JWKS endpoint, keyed by issuer and audience from configuration, with key caching
and rotation handled by the library. Also delete `GATE_LOCAL_USER` from any
non-loopback path — today it is guarded by a loopback check and a bind address,
which is sound for a laptop and not something that should exist in a deployed
image at all.

**Slice 5 — Decide and act on RLS (medium–large). NEEDS A DECISION.**
See §4 and §6.

**Slice 6 — Operational hygiene (small).**
Structured JSON logging with a request id; a health check that actually tests the
database and storage rather than returning `{status:'ok'}` unconditionally;
graceful shutdown so an in-flight evidence upload is not cut off; and startup
validation that refuses to boot on missing or malformed configuration rather than
failing on the first request.

**Slice 7 — Public origin (small).**
`CustomerService` builds links as `/c/<token>`. It needs an absolute origin so a
link can be texted to a homeowner, and the staff screen needs to stop saying the
link only works on this machine.

**Slice 8 — Container and deploy (medium). NEEDS A HOST.**
Dockerfile, health/readiness wiring, TLS termination, environment and secret
configuration, and a deploy pipeline extending the existing
`.github/workflows/non-website-ci.yml`.

**Slice 9 — Runbook (small).**
Migration and rollback procedure, backup and verified restore, how to issue and
rotate a customer link in production, and what to do when the database is
unreachable. Real draws and real evidence make an untested restore procedure a
liability rather than a formality.

## 6. Decisions needed

Two, and only the second is urgent — slices 1 through 3 proceed without either.

**A. Where does it run, and what issues identity?**

These travel together. The realistic shapes:

| Option | Host + database | Identity | Notes |
|---|---|---|---|
| Managed PaaS | Fly.io or Render + their Postgres | Auth0, Clerk, or WorkOS | Least operational surface; TLS and certificates handled |
| Split | Vercel or Render + Neon or Supabase Postgres | Supabase Auth | One fewer vendor if Supabase does both |
| Self-managed | A VPS with Docker Compose | Self-hosted Keycloak | Cheapest, most ops; you own TLS renewal and backups |

For a three-to-five project pilot my recommendation is the first: the operational
burden is the thing most likely to go wrong, and it is the thing least related to
what Apex is actually good at.

**B. Does RLS become real, or does it get honestly retired?**

- **Make it real.** The app connects as a non-owner role and every request sets
  `request.jwt.claims` inside its transaction. A genuine second layer, which is
  worth more than usual here because a customer-facing surface exists. Costs the
  most of any slice and every query path has to be exercised against it.
- **Retire it honestly.** Keep the API as the single enforcement point and mark
  the policies as inactive, with a migration that says so. Cheap, and truthful,
  which is better than a layer that reads like protection and is not.

I lean toward making it real, but it is genuinely a judgment about how much
belt-and-braces a five-project pilot warrants, and the honest retirement is a
respectable answer.

## 7. What is not in this plan

Deferred per §19's own cut list and unchanged by deployment: the full sales
pipeline, lead/n8n sync, AI summaries and change-order detection, QuickBooks
sync, and chemistry/LSI. Multi-tenancy, autoscaling, and disaster recovery beyond
a verified restore are out of scope for a pilot.
