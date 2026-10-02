# Cloudflare staging

Code and configuration only. Nothing in this repository deploys itself, and this runbook does not attach a custom domain. Staging addresses are `*.workers.dev` and `*.pages.dev`. Run the commands from your own machine after `scripts/ci.sh` has passed. Do not commit the values you type.

The Render procedure in [`deployment.md`](deployment.md) is historical. Do not follow it.

## Why the app is a container

Apex OS is a long-running Node server: `node:http`, node-postgres advisory locks, and the built staff bundle read from disk. The image is the repository [`Dockerfile`](../../Dockerfile). It listens on `0.0.0.0:4100` and answers `/ready`.

A Workers rewrite would replace that process. Staging does not. A thin Worker in [`deploy/cloudflare/apex-os`](../../deploy/cloudflare/apex-os) starts one Cloudflare Container, injects the Hyperdrive connection string and the R2 and Access settings, and adds `X-Robots-Tag: noindex` to every response, including a failure to start. The Worker is not part of the pnpm workspace, so `scripts/ci.sh` does not install it.

The marketing site stays on Cloudflare Pages because the staging URL has to be `*.pages.dev`. The Worker answers the app. Pages answers the website.

## Why staff sign-in is Cloudflare Access

Access is the front door. It is configured in the Cloudflare dashboard, not in this repository. The policy is one-time email PIN, and the only allowed address is Nick's Gmail.

Inside the app, staging trusts that Access identity and does not also accept the pasted gate token (`GATE_JWT_SECRET`) or an OIDC issuer. The server already refuses to start with two identity mechanisms. The staff UI calls the API with no pasted token and shows sign-in only when the API returns 403. On a request that carries the `CF_Authorization` cookie, Cloudflare adds `Cf-Access-Jwt-Assertion`. The server verifies that JWT against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, requires the `email` claim to match `APEX_ACCESS_EMAIL`, and loads the role from `app_users` for `APEX_ACCESS_USER_ID`. A role claim in the token is ignored.

Customer pages at `/c/<token>` stay authorized by the unguessable token. They must be an Access bypass, or a homeowner would be asked for Nick's PIN. `/health`, `/ready`, and `/robots.txt` are bypasses so a probe can see readiness. `/app` and `/api` stay behind the PIN.

An Access service token is only for `scripts/staging-smoke.sh`. It gets past Access. It does not become a staff user unless its JWT email matches `APEX_ACCESS_EMAIL`, which a service token usually does not.

## What you have to supply

None of these belong in git. Placeholders below are the strings to replace.

| Value | Where it goes |
| --- | --- |
| Cloudflare account login | `npx wrangler login` on your machine |
| Account id | The R2 S3 endpoint host |
| `workers.dev` subdomain | Printed by `npx wrangler whoami` and by the first deploy |
| Neon project and connection string | `wrangler hyperdrive create` only. Not the container. |
| Hyperdrive config id | `deploy/cloudflare/apex-os/wrangler.jsonc` in place of `REPLACE_WITH_HYPERDRIVE_ID` |
| R2 S3 access key id and secret | `wrangler secret put`, not the file |
| Access team subdomain | `APEX_ACCESS_TEAM` in place of `REPLACE_WITH_ACCESS_TEAM` |
| Access application AUD | `APEX_ACCESS_AUD` in place of `REPLACE_WITH_ACCESS_AUD` |
| Nick's Gmail, confirmed | `APEX_ACCESS_EMAIL` in place of `REPLACE_WITH_NICK_GMAIL` |
| Minted `user_<ULID>` | `APEX_ACCESS_USER_ID` in place of `REPLACE_WITH_USER_ULID`, and the `app_users` row |
| `APEX_PUBLIC_ORIGIN` | `wrangler secret put` after the workers.dev host is known |
| `PUBLIC_SITE_URL` | `https://*.pages.dev` for the website build |
| `PUBLIC_LEAD_WEBHOOK_URL_TEST` | A non-production intake URL that contains `webhook-test` |
| Optional Access service token | `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` in the shell for the smoke script |
| Optional `APEX_CUSTOMER_CONTACT_PHONE` | E.164, `wrangler secret put` |

The git author address `nrsandoval1231@gmail.com` is a hint for which inbox to confirm. Do not treat it as already allow-listed. Type the mailbox Nick actually reads into `APEX_ACCESS_EMAIL` and into the Access policy.

## 1. Neon Postgres

Create a Neon project and database. This is Neon, not Supabase. Do not apply `0033_lead_intake.sql`. That migration is not in this tree; it lives only on `origin/dev` and was left there on purpose.

```bash
export NEON_DATABASE_URL='postgres://REPLACE_WITH_NEON_USER:REPLACE_WITH_NEON_PASSWORD@REPLACE_WITH_NEON_HOST/REPLACE_WITH_NEON_DATABASE?sslmode=require'
psql "$NEON_DATABASE_URL" -c 'select 1'
```

The container applies `applyOperationalMigrations` on boot, under a Postgres advisory lock. You do not run the migration files by hand. The first `/ready` that reports `"database": true` means they have been applied.

## 2. Hyperdrive

From `deploy/cloudflare/apex-os`, with Wrangler logged in:

```bash
npx wrangler login
npx wrangler whoami
npx wrangler hyperdrive create apex-staging \
  --connection-string "$NEON_DATABASE_URL" \
  --caching-disabled
```

Caching is disabled because this database is the system of record. A cached read of a proposal or a job would be a stale read.

Copy the printed Hyperdrive id over `REPLACE_WITH_HYPERDRIVE_ID` in `wrangler.jsonc`. The container must not receive `NEON_DATABASE_URL`. The Worker passes `env.HYPERDRIVE.connectionString` in as `DATABASE_URL`. That string uses `sslmode=disable` for the hop inside Cloudflare's network. The app honors `sslmode=disable`. TLS to Neon is Hyperdrive's connection, using the string you passed to `hyperdrive create`.

## 3. R2 evidence

The existing S3 adapter already speaks the S3 API, including R2. Staging sets `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION=auto`. Local development and `scripts/ci.sh` keep using whatever `S3_*` they already use. Nothing in the adapter is Cloudflare-specific.

```bash
npx wrangler r2 bucket create apex-evidence-staging
```

In the dashboard, turn on bucket versioning before any real evidence is written. Then create an R2 API token with object read and write on `apex-evidence-staging`.

```text
S3_ENDPOINT=https://REPLACE_WITH_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=REPLACE_WITH_R2_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=REPLACE_WITH_R2_SECRET_ACCESS_KEY
S3_BUCKET=apex-evidence-staging
S3_REGION=auto
```

`S3_BUCKET` and `S3_REGION` are already in `wrangler.jsonc`. The endpoint and keys are secrets:

```bash
cd deploy/cloudflare/apex-os
printf '%s' 'https://REPLACE_WITH_ACCOUNT_ID.r2.cloudflarestorage.com' | npx wrangler secret put S3_ENDPOINT
printf '%s' 'REPLACE_WITH_R2_ACCESS_KEY_ID' | npx wrangler secret put S3_ACCESS_KEY_ID
printf '%s' 'REPLACE_WITH_R2_SECRET_ACCESS_KEY' | npx wrangler secret put S3_SECRET_ACCESS_KEY
```

Do not set `DATABASE_URL`, `GATE_JWT_SECRET`, `GATE_LOCAL_USER`, or any `APEX_OIDC_*` variable. The Worker supplies `DATABASE_URL` from Hyperdrive. A second identity mechanism makes the process refuse to start.

## 4. Cloudflare Access

This step is manual. Access is not represented in the repo.

1. Zero Trust → Access → Applications → Add an application → self-hosted.
2. Application domain: the `*.workers.dev` hostname from the deploy below. No custom domain. Leave the path empty.
3. Identity provider: One-time PIN.
4. Policy action Allow. Include rule: Emails is `REPLACE_WITH_NICK_GMAIL`. Confirm that inbox first.
5. Add a Bypass policy for these paths: `/health`, `/ready`, `/robots.txt`, `/c`, and `/c/*`.
6. Add a second self-hosted application for the `*.pages.dev` hostname. Same email allow rule. No bypass. The marketing preview is private.
7. Optional: create an Access service token and add an Include rule for it on both applications, if you want `scripts/staging-smoke.sh` to see `/app` and the website HTML.
8. Copy the team subdomain (the label in `https://<team>.cloudflareaccess.com`) and the workers.dev application's AUD tag.

Edit `deploy/cloudflare/apex-os/wrangler.jsonc` and replace the four `REPLACE_WITH_*` vars:

```jsonc
"APEX_ACCESS_TEAM": "REPLACE_WITH_ACCESS_TEAM",
"APEX_ACCESS_AUD": "REPLACE_WITH_ACCESS_AUD",
"APEX_ACCESS_EMAIL": "REPLACE_WITH_NICK_GMAIL",
"APEX_ACCESS_USER_ID": "REPLACE_WITH_USER_ULID"
```

`APEX_ACCESS_TEAM` is the subdomain only, for example `apex`, not a URL. `APEX_ACCESS_USER_ID` must match `user_` plus 26 Crockford characters (no I, L, O, or U). Mint a new id. The shape, which you must not reuse if it is already taken, is `user_01ARZ3NDEKTSV4RRFFQ69G5FAV`.

After the first boot has applied migrations, insert the row against Neon:

```sql
insert into app_users (user_id, auth_user_id, role, display_name, active)
values ('REPLACE_WITH_USER_ULID', gen_random_uuid(), 'admin', 'Nick', true);
```

Use the same id you put in `wrangler.jsonc`.

## 5. Deploy Apex OS

Requires Docker. Wrangler builds `Dockerfile` with the repository root as the build context. `workers_dev` is true, `preview_urls` is false, and there is no route and no custom domain.

The first deploy can omit `APEX_PUBLIC_ORIGIN`. Customer links stay relative until you set it.

```bash
cd deploy/cloudflare/apex-os
npx wrangler deploy
```

Note the printed `https://apex-os-staging.<subdomain>.workers.dev` origin. Then:

```bash
printf '%s' 'https://apex-os-staging.REPLACE_WITH_WORKERS_SUBDOMAIN.workers.dev' | npx wrangler secret put APEX_PUBLIC_ORIGIN
npx wrangler deploy
```

Optional contact number, E.164:

```bash
printf '%s' '+1REPLACE_WITH_PHONE' | npx wrangler secret put APEX_CUSTOMER_CONTACT_PHONE
npx wrangler deploy
```

`max_instances` is 1. The container sleeps after 10 minutes idle. The next request waits until port 4100 answers, up to 120 seconds.

## 6. Deploy the website

`PUBLIC_ENV` is `staging`, which is not production, so the built `robots.txt` disallows everything and the quote form uses only the test webhook. The build script writes `dist/_headers` so Pages sends `X-Robots-Tag: noindex` on every response. That file is not under `public/`, so a later production build does not inherit it.

```bash
export PUBLIC_SITE_URL='https://apex-website-staging.pages.dev'
export PUBLIC_LEAD_WEBHOOK_URL_TEST='https://REPLACE_WITH_TEST_HOST/webhook-test/apex-lead-intake'
bash scripts/build-website-staging.sh
cd deploy/cloudflare/website
npx wrangler pages project create apex-website-staging --production-branch main
npx wrangler pages deploy ../../../apps/website/dist \
  --project-name apex-website-staging \
  --branch main \
  --commit-dirty
```

If Pages prints a different `*.pages.dev` host, set `PUBLIC_SITE_URL` to that origin, rebuild, and deploy again. Do not add a custom domain.

## 7. Smoke test

`/health`, `/ready`, and `/robots.txt` are the Access bypasses, so they answer without a PIN. `/app` must not return 200 without a service token.

```bash
export STAGING_OS_URL='https://apex-os-staging.REPLACE_WITH_WORKERS_SUBDOMAIN.workers.dev'
export STAGING_WEB_URL='https://apex-website-staging.pages.dev'
# Optional. Set both, or neither.
export CF_ACCESS_CLIENT_ID='REPLACE_WITH_ACCESS_SERVICE_TOKEN_ID'
export CF_ACCESS_CLIENT_SECRET='REPLACE_WITH_ACCESS_SERVICE_TOKEN_SECRET'
bash scripts/staging-smoke.sh
```

A passing run prints `staging smoke passed`. `/ready` must be HTTP 200 with `"status": "ready"`, `"database": true`, and `"evidence": true`. Both origins must send `X-Robots-Tag: noindex`, and both `robots.txt` files must contain `Disallow: /`.

Then open the workers.dev host in a browser, complete the one-time PIN for the allowed Gmail, and confirm `/app` loads. A second Gmail must be refused by Access.

## Crawlers

Every staging response is `X-Robots-Tag: noindex, nofollow, noarchive`. The Worker sets it, including on 503. The container sets it when `APEX_STAGING_NOINDEX=1`, and `GET /robots.txt` is `User-agent: *` / `Disallow: /`. Pages gets the same header from `dist/_headers` and the same robots file from the non-production website build.

## Local development

Leave `APEX_ACCESS_*` and `APEX_STAGING_NOINDEX` unset. The process keeps the pilot secret or OIDC, whichever you already use, and `/health` does not grow a noindex header. `scripts/ci.sh` does not need Cloudflare credentials.
