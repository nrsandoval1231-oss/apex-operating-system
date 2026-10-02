# Apex OS — deployment runbook

> **Superseded (2026-10-02).** This runbook deploys a Render web service and
> Render Postgres. Hosting is Cloudflare only, and never Vercel or GitHub
> Actions. Do not follow this runbook to deploy. `render.yaml` was removed
> from the tree. Staging is [`cloudflare-staging.md`](cloudflare-staging.md):
> a container on `*.workers.dev`, the website on `*.pages.dev`, Neon through
> Hyperdrive, and evidence on R2. The steps below are historical.

**Written:** 2026-08-03 (deployment plan slice 9)

**Updated:** 2026-09-30. Sections 8 and 8b no longer describe deploy keys.
Designer and the legacy proposal engine are in this repository. The 2026-08-13
note covered the unified opportunity, Proposal, closeout, and History workflow.

**Applies to:** Render web service `apex-os` + Render Postgres `apex-postgres`,
Cloudflare R2 or S3 for evidence, Auth0 or Clerk for staff identity.

This is the operational half. `docs/plans/deployment.md` says why the system is
built this way; this says what to type, in what order, and what to do when it
goes wrong.

---

## 1. Before the first deploy

Four accounts. None of them can be created by anyone but you, and none of the
secrets should ever reach git.

| # | Thing | What you end up with |
|---|---|---|
| 1 | Render account, repo connected | The blueprint in `render.yaml` picked up |
| 2 | Object storage bucket (R2 or S3) | Endpoint, bucket name, key id, secret |
| 3 | Identity tenant (Auth0 or Clerk) | Issuer URL, API audience identifier |
| 4 | A domain, pointed at Render | `https://…` for `APEX_PUBLIC_ORIGIN` |

### The identity tenant is smaller than it looks

It covers **Apex staff only** — roughly five to ten people. Customers never sign
in; the progress page is authorised by an unguessable token. Do not buy or
configure anything for customer identity.

Two objects are needed, and both matter.

**An API** (Auth0) or **JWT template** (Clerk) whose identifier becomes
`APEX_OIDC_AUDIENCE`. Without an audience the tokens are for "the tenant" rather
than for this API, and a token minted for anything else in the same tenant would
be accepted here.

**A Single Page Application client**, whose id becomes `APEX_OIDC_CLIENT_ID`.
It must be a public client — the staff app uses Authorization Code with PKCE and
there is no client secret anywhere in this system, because a browser cannot keep
one. Configure:

| Setting | Value | Why |
|---|---|---|
| Allowed Callback URLs | `https://apex.<domain>/app/callback` | Where the provider returns the browser |
| **Allowed Web Origins** | `https://apex.<domain>` | **Easy to miss.** The PKCE token exchange is a cross-origin POST from the browser to the provider. Without this, CORS blocks it and sign-in silently does nothing |
| Grant types | Authorization Code (+ PKCE) | Implicit and password grants should be off |

The API reads the provider's `.well-known/openid-configuration` at startup and
takes the authorize, token, **and JWKS** endpoints from it, so nothing about
Auth0's or Clerk's URL layout is hard-coded. It also adds the provider's origin
to the staff app's `connect-src` CSP — without that the token exchange is
blocked by the browser rather than by the provider, which looks identical from
the outside.

### Object storage permissions

The application needs `GetObject`, `PutObject`, `DeleteObject`, and
`HeadBucket` — nothing more. **Do not grant `CreateBucket`.** Create the bucket
by hand; the code has no call for it, and a running app that can create buckets
can also be talked into creating one.

Keep versioning **on**. Evidence is write-once in the application, but versioning
is what survives an operator mistake.

---

## 2. First deploy

```bash
# 1. Render → New → Blueprint → select this repo. It reads render.yaml and
#    creates the web service and the database. Do not deploy yet.

# 2. Fill the secrets marked `sync: false` in the Render dashboard:
#      APEX_OIDC_ISSUER            https://<tenant>.us.auth0.com/
#      APEX_OIDC_AUDIENCE          https://api.apex.<domain>
#      APEX_OIDC_CLIENT_ID         <SPA client id>
#      S3_ENDPOINT                 https://<account>.r2.cloudflarestorage.com
#      S3_BUCKET                   apex-evidence
#      S3_ACCESS_KEY_ID            …
#      S3_SECRET_ACCESS_KEY        …
#      APEX_PUBLIC_ORIGIN          https://apex.<domain>
#      APEX_CUSTOMER_CONTACT_PHONE +1806…        (optional)
#
#    DATABASE_URL is the database's EXTERNAL connection string, pasted by hand.
#    Render's blueprint can only wire the private-network URL, and that endpoint
#    is self-signed — see §6, "self-signed certificate on the very first deploy".

# 3. Deploy.
```

**`GATE_JWT_SECRET` and `GATE_LOCAL_USER` must not be set.** The first is a
shared secret beside a real provider — a second, unaudited door; `createGateApi`
refuses to start with both. The second disables authentication entirely; `main.ts`
refuses to start with it on a non-loopback bind, which this service is. Both
refusals are covered by tests, and CI starts the real image with
`GATE_LOCAL_USER` set to prove the container fails rather than serves.

### Migrations run themselves

On boot, under a Postgres advisory lock. Two instances starting together cannot
race: the second blocks, then finds every migration already recorded and applies
none. There is no separate migrate step and no manual command to forget.

### Verify the deploy

```bash
curl -sf https://apex.<domain>/ready
```

Expect `{"status":"ready","database":true,"evidence":true}`. Anything else means
do not proceed — see §6.

Then, in order:

1. `https://apex.<domain>/app` loads and asks you to sign in.
2. Sign in. If it refuses, the account exists at the provider but not in
   `app_users` — see §3.
3. Create a **non-production opportunity**. Confirm Projects/Today do not show a
   fabricated construction Job.
4. In Designer, produce a design (include the 3′–5′–3′ sports profile in staging),
   download the `.xlsx`, and inspect that `Order List` is first.
5. Use **Finish estimate**. Confirm unresolved measured prices/direct scope appear
   as blockers and that no Proposal can be issued until every line has an approved
   amount or an explicit not-applicable decision.
6. Issue the Proposal, save/print it as PDF, and verify copy-email/`mailto:` prepare
   content without recording an email as sent.
7. Record acceptance of the exact issued version. Retry the command and confirm
   exactly one Job and Project exist.
8. Complete a disposable construction/closeout path, archive it, then confirm
   History retains takeoff/Proposal/artifact reads while mutation routes refuse it.
9. Open a customer progress link on a phone, on cellular, with wifi off. This is
   the only test that proves the customer route is reachable outside the operator's
   machine.

---

## 3. Adding a staff member

Two steps, in this order. Neither works alone.

```sql
-- 2. After they have signed in once at the provider, take their subject
--    (Auth0: `auth0|…`; Clerk: `user_…`) and link it.
insert into app_users (user_id, auth_user_id, oidc_subject, role, display_name)
values (
  'user_' || upper(substr(md5(random()::text), 1, 26)),  -- or mint a real ULID
  gen_random_uuid(),
  'auth0|REPLACE-ME',
  'superintendent',        -- admin | office | superintendent | field | customer
  'Name'
);
```

1. Invite them in the provider.
2. Run the insert above.

**The role comes from this table, never from the token.** A claim saying `admin`
grants nothing. That means adding a superintendent is a database change, not an
identity-provider change — deliberately, so authorization stays where it can be
audited.

### Removing someone

```sql
update app_users set active = false where oidc_subject = 'auth0|…';
```

This is sufficient on its own and takes effect on their next request. Do not wait
on the provider to revoke; disabling them there as well is good practice but is
not what stops access.

---

## 4. Deploying a change

`autoDeploy` is off. A push does not deploy; deploying is a decision.

The pricing library is intentionally code-identified as
`manual-approved-pricing-v1`; it is **not** an environment rate card. A deployment
must not add default prices in secrets or configuration. Each estimate must carry
real approved amounts/bases, and missing values must continue to block issue.

1. Confirm CI is green on `main`. It builds and *runs* the container against a
   real Postgres and a real object store, so a green run means the image boots.
2. Render → the service → Manual Deploy → the commit.
3. Watch the log for `Database managed Postgres`, `Evidence S3-compatible…`,
   `Identity https://…`, and `Customer links https://…`. Those four lines are the
   configuration the process actually resolved, not what the dashboard claims.
4. `curl -sf https://apex.<domain>/ready`.

### Rolling back

Render → Deploys → the previous successful deploy → Redeploy.

**Rolling back the image does not roll back the database.** Every migration here
is additive — new tables and columns, plus `0017`'s new *versions* of gate
definitions rather than edits to existing ones — so an older image runs against a
newer schema. That is the property that makes rollback safe, and it is worth
preserving: a migration that drops or renames a column breaks it.

If a deploy has to be rolled back **and** a migration must be undone, write a new
forward migration that reverses it. Do not edit or delete an applied migration.

---

## 5. Backup and restore

Render takes daily automatic backups on paid plans. That is not a restore
procedure — an untested backup is a belief, not a control.

### Test the restore once, before the pilot carries real money

```bash
# 1. Render → Database → Backups → Restore to a NEW database.
# 2. Point a scratch deploy at it:
#      DATABASE_URL=<restored database>
# 3. Check the three things that matter:
```

```sql
-- Gates that released, with their evidence still attached.
select count(*) from gate_instances where status = 'released';
select count(*) from evidence_records;

-- Money.
select draw_code, status, amount_cents from job_draws order by sequence;

-- Customer links: the hashes must survive, because a restore that loses them
-- silently invalidates every link Apex has already sent.
select count(*) from customer_links where revoked_at is null;
```

**Evidence bytes are not in the database.** They are in object storage, which has
its own lifecycle. A database restore to a point before an upload leaves rows
pointing at objects that exist — harmless. A restore of the *bucket* to a point
before an upload leaves rows pointing at nothing: the API answers 404 for those
photos and the readiness check still passes, because the bucket is reachable. If
you ever restore the bucket, audit for it:

```sql
select evidence_id, storage_key from evidence_records order by created_at desc limit 50;
```

and spot-check that `GET /api/evidence/<id>` returns bytes.

---

## 6. When something is wrong

### `/ready` returns 503

The body says which dependency. Booleans only — an unauthenticated endpoint does
not explain itself.

- `"database": false` — Render database down, restarting, or connection limit
  reached. Check Render's database status first. The app reconnects on its own;
  the pool logs an idle-client error rather than crashing.
- `"evidence": false` — bucket unreachable, credentials rotated or revoked, or
  the bucket was deleted. `HeadBucket` is what is failing.

The service stays up while degraded, by design: the platform stops routing to it
rather than restarting it, because restarting does not fix a dependency.

### The container will not start

Read the first lines of the log. Startup validation fails loudly and specifically
rather than failing on the first request:

| Message contains | Cause |
|---|---|
| `not both` | `GATE_JWT_SECRET` set alongside the provider. Remove the secret. |
| `loopback` | `GATE_LOCAL_USER` set. It must not exist here at all. |
| `must use https` | `APEX_PUBLIC_ORIGIN` is http. The link token is in the URL. |
| `must be an origin with no path` | `APEX_PUBLIC_ORIGIN` has a trailing path. |
| `S3_ENDPOINT is set but these are missing` | Partial storage configuration. |
| `must be set together` | Only one of issuer/audience is set. |
| `DEPTH_ZERO_SELF_SIGNED_CERT` | `DATABASE_CA_CERT` is missing. See below. |

### `self-signed certificate` on the very first deploy

The whole log is a stack trace ending in `DEPTH_ZERO_SELF_SIGNED_CERT`, thrown
from `withMigrationLock` before any migration runs.

**Cause.** Render's blueprint can only wire the **private-network** database URL,
and that endpoint presents a **self-signed** certificate. Render publishes no CA
for it. This system offers no way to encrypt without verifying, so the connection
is refused rather than downgraded.

**Fix: use the external connection string.** In the Render dashboard open
**apex-postgres**, copy the **External Database URL**, and set it on the
**apex-os** service as `DATABASE_URL`. Then redeploy.

That endpoint presents a Let's Encrypt certificate which verifies against the
system roots with nothing else configured. Verified rather than assumed:

```bash
openssl s_client -starttls postgres \
  -connect <db>.oregon-postgres.render.com:5432 </dev/null
# depth=0 CN=oregon-postgres.render.com … Verify return code: 0 (ok)
```

**What this costs, stated plainly:** database traffic now leaves the private
network and crosses the internet on every query — TLS-protected and verified, but
slower and no longer private-by-topology. For a pilot that is an acceptable
trade; for a busy production system it is worth closing.

**The tighter arrangement**, when someone has ten minutes: open a shell on the
`apex-os` service, capture the private endpoint's self-signed certificate, paste
it into `DATABASE_CA_CERT`, and point `DATABASE_URL` back at the internal host.
That restores the private network *and* keeps verification, which is what
`DATABASE_CA_CERT` exists for. Setting the certificate alone changes nothing —
the URL has to move too.

This bit on the first real deploy, 2026-08-06. `render.yaml` used
`fromDatabase: connectionString`, which cannot be anything but the private URL,
so the deploy could never have succeeded as written.

### A staff member cannot sign in

Work out *where* it fails first — the two halves look the same to the user.

**The button does nothing, or the browser returns with an error.** That is the
provider half:

- Check the browser console for a CORS error on the token endpoint. If present,
  `Allowed Web Origins` at the provider does not include this origin.
- Check `Allowed Callback URLs` includes `https://apex.<domain>/app/callback`
  exactly, including the `/app` segment.
- `curl -s https://apex.<domain>/api/auth/config` should return `mode: "oidc"`
  with the provider's real authorize and token endpoints. `mode: "pilot"` means
  the identity variables are not set on the service.

**They sign in, come back, and are shown the sign-in screen again.** That is the
Apex half — the token is valid and there is no matching user:

1. Have they signed in at the provider at least once, so a subject exists?
2. Does `app_users.oidc_subject` match it exactly? Case-sensitive, and it
   includes the `auth0|` prefix.
3. Is `active` true?

A valid token for someone with no row is refused. That is authentication
succeeding and authorization correctly declining.

### A customer says their link does not work

```sql
select link_id, issued_at, revoked_at, revoked_reason
from customer_links where job_id = 'job_…' order by issued_at desc;
```

- Revoked → issue a new one. There is no un-revoke, by design.
- Live but they still cannot open it → check the access log. A row with
  `outcome = 'refused-revoked'` means they are holding an older link.

```sql
select a.occurred_at, a.resource, a.outcome, a.ip_prefix
from customer_link_accesses a
join customer_links l on l.link_id = a.link_id
where l.job_id = 'job_…' order by a.occurred_at desc limit 20;
```

No rows at all means the request never reached the server: DNS, TLS, or they
mistyped it.

### Rotating a customer link

Apex OS → project → Customer page → Rotate. The old link stops working
immediately and the new URL is shown **once**. There is no way to recover it
afterwards — only the hash is stored — so send it before leaving the screen.

Rotate when a link has been forwarded outside the household, or when a customer
asks. Revoke without reissuing only when the project is cancelled.

---

## 7. What this deployment deliberately does not have

Stated so nobody assumes otherwise:

- **No horizontal scaling story beyond the migration lock.** Multiple instances
  will not corrupt anything, but nothing has been load-tested.
- **No row-level security.** Retired honestly in migration `0019`; the API is the
  single enforcement point. Revisit before multi-user SQL access. See
  `docs/plans/deployment.md` §4.
- **No automated restore verification.** §5 is a procedure a person runs, and it
  has not been run yet.

---

## 8. Designer contract source

`integration-tests/designer-contract.test.ts` reads the Designer engine at
`apps/designer/src/engine/index.ts`. That tree is part of this repository.
CI does not check out `apex-designer` and does not use a deploy key.

The old procedure (a read-only deploy key, secret `APEX_DESIGNER_DEPLOY_KEY`,
checkout into `Apex Designer/`) is retired. The `apex-designer` GitHub
repository was deleted. Its history lives in this repository's git history.

---

## 8b. Proposal-engine chain source

`integration-tests/takeoff-to-proposal.test.ts` reads Designer at `apps/designer`
and the legacy proposal engine at `archive/proposal-engine/engine.mjs`. Both
are in this repository. CI does not check out `apex-proposal-engine` and does
not use `APEX_PROPOSAL_DEPLOY_KEY`.

The old "add a proposal-engine deploy key" procedure is retired. The
`apex-proposal-engine` GitHub repository was deleted. Its history lives in
this repository's git history, and the legacy calibration copy that the chain
test reads is `archive/proposal-engine`. The production Proposal path is
`packages/pricing-engine`.
