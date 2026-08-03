# Apex OS — Deployment Plan

**Written:** 2026-08-03
**Status:** All nine slices complete. Every remaining step needs an account, not code — see `docs/runbooks/deployment.md`. **Both open decisions were made on
2026-08-03** (§6): Render plus a hosted identity provider, and RLS retired
honestly for the pilot. Slices 3, 4, and 6–9 remain; none is blocked.
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
| 1 | ~~Services bind directly to `PGlite`~~ | Done | Yes |
| 2 | ~~No real Postgres adapter; migrations run on boot with no lock~~ | Done | Yes |
| 3 | ~~Evidence is written to the local filesystem~~ | Done | Yes |
| 4 | ~~**RLS policies exist but are inert**~~ — retired, see §4 | Done | Yes |
| 5 | ~~Symmetric HS256 pilot JWT; no JWKS, no rotation~~ | Done | Yes |
| 6 | ~~`GATE_LOCAL_USER` disables authentication entirely~~ | Done | Yes |
| 7 | ~~Customer links are path-only; no public origin configured~~ | Done | Yes |
| 8 | ~~No container, no deploy config, no TLS termination~~ | Done | **No** |
| 9 | ~~No structured logging, shallow health checks, no graceful shutdown~~ | Done | Yes |
| 10 | ~~No backup or restore procedure~~ — documented, **not yet exercised** | Partial | **No** |

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

**Slice 2 — A real Postgres adapter (medium). DONE 2026-08-03.**
`PostgresDatabase` implements the port over a `pg` pool, with the two things
embedded Postgres let us ignore: pooled transactions that release their client on
every path, and a session-level advisory lock around migrations so two instances
starting together cannot race the same `0018`. CI now runs a Postgres 16 service
container and the adapter is tested against it.

Three decisions worth challenging:

1. **`date` is parsed as a string, not a `Date`.** node-postgres turns a bare
   `date` into a JS `Date` at *local* midnight, which moves the calendar day
   backwards in any timezone east of UTC. Every date here is a calendar day with
   no time in it, and the services already accept strings, so overriding the
   parser removes the ambiguity instead of managing it — and makes Postgres
   behave exactly as PGlite does, which is what lets one suite cover both.
   `timestamptz` is deliberately left alone: it carries a real instant.
2. **TLS is on with verification for any non-local host, and there is no option
   to leave it on with verification off.** That combination looks encrypted and
   authenticates nothing. `sslmode=disable` is honoured because it is an
   explicit statement.
3. **The database is chosen by the presence of `DATABASE_URL`,** not a mode
   flag, so there is no way to point at a real database and still be running the
   embedded one.

Also lands the graceful-shutdown half of slice 6: SIGTERM finishes in-flight
requests and closes the pool, so a routine deploy cannot cut an evidence upload
half-written.

**Slice 3 — An evidence storage port (medium). DONE 2026-08-03.**
New `@apex/storage` package: an `EvidenceStorage` port with a local filesystem
adapter and an S3-compatible one. R2, S3, B2, and Spaces all work without further
code change — only the endpoint differs. CI runs MinIO and tests the S3 adapter
against it.

Four decisions worth challenging:

1. **Storage is write-once.** `put` refuses to replace an existing object. The
   key carries a freshly minted evidence ULID, so a collision means a bug
   upstream — and silently overwriting proof that a Gate was released against is
   the worst failure this component could have. The S3 adapter guards twice
   (a HEAD, then `If-None-Match: *`) because a provider that does not support
   conditional writes ignores the header silently.
2. **Keys are validated centrally, by allow-list.** The same key becomes a
   filesystem path in one adapter and a URL path in the other, so `..` is a
   traversal in both. `assertStorageKey` runs before either adapter sees it, and
   the local adapter still re-checks the resolved path — the last line before a
   write lands on a disk is worth being paranoid at.
3. **A missing object is `null`, not a throw.** A row can outlive its bytes if a
   restore was partial, and both the staff and customer routes have to answer
   404 for that rather than 500.
4. **No presigned URLs.** Evidence is served through the API on both paths,
   which is where authorization and the customer access log already live. A
   presigned URL would be an unrevokable, unlogged door onto the one thing this
   system exists to keep trustworthy.

`aws4fetch` over the AWS SDK: four operations, none needing multipart, so a few
kilobytes of signing beats tens of megabytes of client.

Partial S3 configuration is a startup failure rather than a fallback to disk —
evidence quietly landing on an ephemeral container filesystem is exactly what
nobody notices until it is needed.

**Slice 4 — Identity (medium). DONE 2026-08-03.**
Staff tokens are verified against the provider's published JWKS — issuer,
audience, and an asymmetric-only algorithm allow-list — with `jose` handling key
caching and refetch on an unknown `kid`, so provider key rotation is a non-event.
Auth0, Clerk, and WorkOS differ only in configuration values.

Three decisions worth challenging:

1. **The token proves who; the database decides what they may do.** A role claim
   is never read. Verification maps `sub` to `app_users.oidc_subject`
   (migration `0020`) and takes the role from that row. Trusting a claim would
   put Apex's authorization model inside the identity provider, where adding a
   superintendent becomes an IdP configuration change and a mis-set claim
   becomes a privilege escalation. It also means deactivating someone in Apex is
   sufficient — no waiting on the provider to revoke.
2. **Exactly one identity mechanism, enforced in `createGateApi`.** A provider
   and a shared secret together would be a second, unaudited door into every
   staff endpoint, and the deployment would look correctly configured from
   outside. With a provider configured there is no shared secret at all, so
   there is nothing to leak or rotate.
3. **`GATE_LOCAL_USER` cannot coexist with a provider, or with a non-loopback
   bind.** Both are startup failures rather than warnings.

The algorithm allow-list is the load-bearing detail and has its own test: a
token signed HS256 using the *public* key as the shared secret is refused. That
is the classic JWT confusion attack, and without the allow-list it would mint
admin access from public information.

**Slice 5 — RLS retired honestly (small, once decided). DONE 2026-08-03.**
Migration `0019_rls_retired.sql` disables row-level security explicitly, so
`pg_tables.rowsecurity` is false and the schema stops asserting a protection that
was not running. The policy definitions are kept: they are correct as written,
cost nothing while inactive, and re-enabling later is a switch rather than
archaeology. Two tests hold the line — no table claims RLS, and the policies are
still there.

The migration header states the three things that must happen *together* to
activate it, because none works alone: a non-owning role (or FORCE), the
`request.jwt.claims` plumbing, and a decision about the tokenized customer route,
which authenticates nobody by design and would deny everything under these
policies.

**Slice 6 — Operational hygiene (small). DONE 2026-08-03.**
Structured JSON logging, split liveness and readiness probes, and startup
validation. Graceful shutdown landed with slice 2.

Three decisions worth challenging:

1. **Request paths are redacted before they are logged.** A customer link token
   is a bearer credential that lives in the URL path, and a log stream is
   retained, searchable, and visible to anyone with dashboard access. Writing raw
   paths would hand out working links and undo the point of storing only the
   hash. Redaction matches the *token shape* rather than the route, so it also
   covers a mistyped or probing request — which is precisely where a token would
   otherwise leak, because it never reaches a handler that knows to be careful.
2. **`/health` and `/ready` are different things.** Liveness checks nothing but
   the process: a platform restarting the container because the database blipped
   would turn a recoverable outage into a crash loop. Readiness checks the
   database and evidence storage and answers 503, so a load balancer stops
   sending traffic. It returns booleans and no error text — an unauthenticated
   endpoint should not explain *why* something is broken.
3. **Health and readiness are not logged.** A platform probes them every few
   seconds and they would bury everything else.

**Slice 7 — Public origin (small). DONE 2026-08-03.**
`APEX_PUBLIC_ORIGIN` makes an issued customer link a complete URL that can be
texted to a homeowner. Absent, the link stays a path and is flagged
`publiclyReachable: false`, which is what the staff screen uses to warn.

Two decisions worth challenging:

1. **The warning is shown only when it is true.** It used to be hard-coded, and
   would have become a lie the moment a public origin existed. A stale warning
   teaches people to ignore the real ones.
2. **The origin must be https unless it is localhost, and is validated at
   startup.** The token is in the URL, so http would put a live credential on
   the wire in the clear. A trailing path or a bare hostname is rejected too:
   the failure it prevents is silent, and the person who discovers it is a
   homeowner tapping a link that opens nothing.

**Slice 7 — Public origin (small).**
`CustomerService` builds links as `/c/<token>`. It needs an absolute origin so a
link can be texted to a homeowner, and the staff screen needs to stop saying the
link only works on this machine.

**Slice 8 — Container and deploy (medium). DONE 2026-08-03, up to the account.**
Dockerfile, `.dockerignore`, and `render.yaml`, plus the two couplings that made
a container impossible: the bind address was a hard-coded constant, and the built
staff app was reached by a relative path across package boundaries. Both are now
configuration.

**CI builds the image and runs it** against the real Postgres and MinIO, then
asserts readiness reports `database: true` and `evidence: true`, the staff app is
served, and an unknown customer token 404s with `x-robots-tag: noindex`. A
Dockerfile that merely builds proves almost nothing — the failures that matter
are a missing runtime file, a wrong working directory, and a process that exits
on boot. There is a second run that sets `GATE_LOCAL_USER` and asserts the
container **refuses to start**, because the image binds `0.0.0.0`.

`autoDeploy` is off: deploying is a decision, not a consequence of pushing.

Not done and not doable here: creating the Render account, connecting the repo,
and entering the secrets.

**Slice 9 — Runbook (small). DONE 2026-08-03.**
`docs/runbooks/deployment.md` — first deploy, adding and removing staff,
deploying a change, rolling back, backup and restore, and a symptom-to-cause
table for a container that will not start.

Two things it records that are easy to get wrong later:

1. **Rolling back the image does not roll back the database, and that is safe
   only because every migration here is additive.** `0017` adds new *versions*
   of gate definitions rather than editing them. A migration that drops or
   renames a column would break rollback.
2. **Evidence bytes are not in the database.** A bucket restored to an earlier
   point leaves rows pointing at nothing, and readiness still passes because the
   bucket is reachable. The runbook says how to audit for it.

**Slice 9 — Runbook (small).**
Migration and rollback procedure, backup and verified restore, how to issue and
rotate a customer link in production, and what to do when the database is
unreachable. Real draws and real evidence make an untested restore procedure a
liability rather than a formality.

## 6. Decisions — both made 2026-08-03

**A. Render, plus a hosted identity provider.** Least operational surface: TLS,
certificate renewal, and backups are the platform's problem rather than Apex's,
which is the work most likely to go wrong and least related to building pools.

Worth recording because it made the choice smaller than it looked: **the customer
progress page uses unguessable tokens, not accounts**, so the identity provider
only ever covers Apex staff — roughly five to ten people. This is not a
customer-identity purchase.

Auth0 or Clerk is still open, and deliberately does not block slice 4: the code
verifies against a JWKS endpoint with issuer and audience read from
configuration, so it is identical either way. Only the values differ, and those
arrive when the account does.

**B. RLS retired honestly for the pilot.** Built as slice 5 above.

The reasoning changed during the analysis and the change is worth keeping. The
initial lean was to make RLS real. What moved it: the highest-risk surface — the
customer page never leaking internal data — is already protected *structurally*
by `buildCustomerPage`, which constructs the payload from a narrow input rather
than filtering a wide one. A new column cannot reach a customer even if everyone
forgets it exists, which is a stronger guarantee than a runtime policy. What was
left for RLS to defend is staff role boundaries between about eight trusted
employees reaching the database through one API — already enforced in domain code
with tests.

So RLS here defends against a bug in our own API. Real, but bounded, and
activating it carries its own risk of denying something that works today.
Revisit before multi-user access, a second API client, or anyone getting direct
SQL access.

### The original framing, kept

Two, and only the second was urgent — slices 1 through 3 proceeded without either.

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
