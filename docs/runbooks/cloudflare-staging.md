# Cloudflare staging

Code and configuration only. Nothing in this repository deploys itself, and this runbook does not attach a custom domain. Staging addresses are `*.workers.dev` and `*.pages.dev`. Run the commands from your own machine after `scripts/ci.sh` has passed. Do not commit the values you type.

The Render procedure in [`deployment.md`](deployment.md) is historical. Do not follow it.

## Why the app is a container

Apex OS is a long-running Node server: `node:http`, node-postgres advisory locks, and the built staff bundle read from disk. The image is the repository [`Dockerfile`](../../Dockerfile). It listens on `0.0.0.0:4100` and answers `/ready`.

A Workers rewrite would replace that process. Staging does not. A thin Worker in [`deploy/cloudflare/apex-os`](../../deploy/cloudflare/apex-os) starts one Cloudflare Container, copies the Neon connection string and the R2 and Access settings into it, and adds `X-Robots-Tag: noindex` to every response, including a failure to start. The Worker is not part of the pnpm workspace, so `scripts/ci.sh` does not install it.

The container starts with outbound internet enabled. Neon and R2 are both on the public internet. Cloudflare Containers cannot reach Hyperdrive, so staging does not use it. The Worker secret `CONTAINER_DATABASE_URL` is the Neon pooled string (`sslmode=require`). The Worker passes that value into the container as `DATABASE_URL`.

The marketing site stays on Cloudflare Pages because the staging URL has to be `*.pages.dev`. The Worker answers the app. Pages answers the website.

## Why staff sign-in is Cloudflare Access

Access is the front door. It is configured in the Cloudflare dashboard, not in this repository. The policy is one-time email PIN. Every person who should open `/app` is an email on that policy and a row in `app_users`.

Inside the app, staging trusts that Access identity and does not also accept the pasted gate token (`GATE_JWT_SECRET`) or an OIDC issuer. The server already refuses to start with two identity mechanisms. The staff UI calls the API with no pasted token and shows sign-in only when the API returns 403. On a request that carries the `CF_Authorization` cookie, Cloudflare adds `Cf-Access-Jwt-Assertion`. The server verifies that JWT against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (signature, issuer, and the application AUD). It lower-cases the `email` claim and loads `app_users` where `email` matches and `active` is true. The role comes from that row. A role claim in the token is ignored. An unknown email, or an email on an inactive row, gets the existing 403 `No active Apex user is linked to this identity.`

`APEX_ACCESS_EMAIL` and `APEX_ACCESS_USER_ID` are a legacy pair for the one row that was inserted before the email column existed. They apply only when no row has that email. Once that row's `email` is set, the pair can be removed. A matching email row always wins over the pair.

Customer pages at `/c/<token>` stay authorized by the unguessable token. They must be an Access bypass, or a homeowner would be asked for Nick's PIN. `/health`, `/ready`, and `/robots.txt` are bypasses so a probe can see readiness. `/app` and `/api` stay behind the PIN.

An Access service token is only for `scripts/staging-smoke.sh`. It gets past Access. It does not become a staff user unless its JWT email matches an active `app_users.email`, which a service token usually does not.

## What you have to supply

None of these belong in git. Placeholders below are the strings to replace.

| Value | Where it goes |
| --- | --- |
| Cloudflare account login | `npx wrangler login` on your machine |
| Account id | The R2 S3 endpoint host |
| `workers.dev` subdomain | Printed by `npx wrangler whoami` and by the first deploy |
| Neon pooled connection string, `sslmode=require` | `wrangler secret put CONTAINER_DATABASE_URL` |
| R2 S3 access key id and secret | `wrangler secret put`, not the file |
| Access team subdomain | `APEX_ACCESS_TEAM` in place of `REPLACE_WITH_ACCESS_TEAM` |
| Access application AUD | `APEX_ACCESS_AUD` in place of `REPLACE_WITH_ACCESS_AUD` |
| Each staff mailbox, confirmed | Access policy Include rule, and `app_users.email`. Placeholders only in git |
| Legacy single mailbox, optional | `APEX_ACCESS_EMAIL` in place of `REPLACE_WITH_NICK_GMAIL`, only until that row has an email |
| Legacy `user_<ULID>`, optional | `APEX_ACCESS_USER_ID` in place of `REPLACE_WITH_USER_ULID`, paired with the email above |
| `APEX_PUBLIC_ORIGIN` | `wrangler secret put` after the workers.dev host is known |
| `PUBLIC_SITE_URL` | `https://*.pages.dev` for the website build |
| `PUBLIC_LEAD_WEBHOOK_URL_TEST` | A non-production intake URL that contains `webhook-test` |
| Optional Access service token | `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` in the shell for the smoke script |
| Optional `APEX_CUSTOMER_CONTACT_PHONE` | E.164, `wrangler secret put` |

The git author address `nrsandoval1231@gmail.com` is a hint for which inbox to confirm. Do not treat it as already allow-listed, and do not commit it. Type each mailbox into the Access policy and into the SQL below. Use `REPLACE_WITH_STAFF_EMAIL` in anything that is committed.

## 1. Neon Postgres

Create a Neon project and database. This is Neon, not Supabase. Do not apply `0033_lead_intake.sql`. That migration is not in this tree; it lives only on `origin/dev` and was left there on purpose.

```bash
export NEON_DATABASE_URL='postgres://REPLACE_WITH_NEON_USER:REPLACE_WITH_NEON_PASSWORD@REPLACE_WITH_NEON_HOST/REPLACE_WITH_NEON_DATABASE?sslmode=require'
psql "$NEON_DATABASE_URL" -c 'select 1'
```

The container applies `applyOperationalMigrations` on boot, under a Postgres advisory lock. You do not run the migration files by hand. The first `/ready` that reports `"database": true` means they have been applied.

## 2. Database secret

From `deploy/cloudflare/apex-os`, with Wrangler logged in. Use the Neon **pooled** host and `sslmode=require`. That is the string the container opens itself. Do not create a Hyperdrive config for this Worker.

```bash
npx wrangler login
npx wrangler whoami
printf '%s' 'postgres://REPLACE_WITH_NEON_USER:REPLACE_WITH_NEON_PASSWORD@REPLACE_WITH_NEON_POOLER_HOST/REPLACE_WITH_NEON_DATABASE?sslmode=require' | npx wrangler secret put CONTAINER_DATABASE_URL
```

The secret stays on the Worker. On each start the Worker copies it into the container as `DATABASE_URL`. Do not put the string in `wrangler.jsonc`. A direct Neon host with `sslmode=require` also works. A Hyperdrive connection string does not: the container cannot reach it, and that string uses `sslmode=disable`.

If the Worker is already deployed, set this secret and run `npx wrangler deploy` again. That deploy drops the Hyperdrive binding. The container is started with `enableInternet: true`, which is what lets it open TLS to the Neon host and to `*.r2.cloudflarestorage.com`.

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

Do not set `DATABASE_URL`, `GATE_JWT_SECRET`, `GATE_LOCAL_USER`, or any `APEX_OIDC_*` variable on the Worker. The database secret is `CONTAINER_DATABASE_URL`. The Worker copies it into the container as `DATABASE_URL`. A second identity mechanism makes the process refuse to start.

## 4. Cloudflare Access

This step is manual. Access is not represented in the repo.

1. Zero Trust → Access → Applications → Add an application → self-hosted.
2. Application domain: the `*.workers.dev` hostname from the deploy below. No custom domain. Leave the path empty.
3. Identity provider: One-time PIN.
4. Policy action Allow. Include rule: Emails. Add each staff mailbox, starting with `REPLACE_WITH_STAFF_EMAIL`. Confirm that inbox first. Add the next person by adding their mailbox to this same rule. Do not put the address in git.
5. Add a Bypass policy for these paths: `/health`, `/ready`, `/robots.txt`, `/c`, and `/c/*`.
6. Add a second self-hosted application for the `*.pages.dev` hostname. Same email allow rule. No bypass. The marketing preview is private.
7. Optional: create an Access service token and add an Include rule for it on both applications, if you want `scripts/staging-smoke.sh` to see `/app` and the website HTML.
8. Copy the team subdomain (the label in `https://<team>.cloudflareaccess.com`) and the workers.dev application's AUD tag.

Edit `deploy/cloudflare/apex-os/wrangler.jsonc` and replace the team and audience. The email and user id vars are the legacy pair. Leave them only while the original row has no `email`. Delete both keys once that column is filled. Do not commit a real address.

```jsonc
"APEX_ACCESS_TEAM": "REPLACE_WITH_ACCESS_TEAM",
"APEX_ACCESS_AUD": "REPLACE_WITH_ACCESS_AUD",
"APEX_ACCESS_EMAIL": "REPLACE_WITH_NICK_GMAIL",
"APEX_ACCESS_USER_ID": "REPLACE_WITH_USER_ULID"
```

`APEX_ACCESS_TEAM` is the subdomain only, for example `apex`, not a URL. `APEX_ACCESS_USER_ID`, when you still set it, must match `user_` plus 26 Crockford characters (no I, L, O, or U). Mint a new id. The shape, which you must not reuse if it is already taken, is `user_01ARZ3NDEKTSV4RRFFQ69G5FAV`.

After the first boot of this version has applied migrations, `app_users.email` exists. Give the original login an email, using the same id already in `APEX_ACCESS_USER_ID` if that pair is still set:

```sql
update app_users
set email = lower('REPLACE_WITH_STAFF_EMAIL')
where user_id = 'REPLACE_WITH_USER_ULID';
```

### Adding a staff member

Do both steps. Access alone is not enough, and a database row alone is not enough.

1. Zero Trust → Access → the workers.dev application → the Allow policy. Add the mailbox to the Emails include rule: `REPLACE_WITH_STAFF_EMAIL`. Add the same mailbox on the pages.dev application. Do not commit the address.
2. Against the Neon database, after migrations have run:

```sql
insert into app_users (user_id, auth_user_id, role, display_name, active, email)
values (
  'user_REPLACE_WITH_26_CROCKFORD',
  gen_random_uuid(),
  'office',
  'REPLACE_WITH_DISPLAY_NAME',
  true,
  lower('REPLACE_WITH_STAFF_EMAIL')
);
```

`role` is one of `admin`, `office`, `superintendent`, or `field`. That value is what the app enforces. The Access token does not carry it. `user_` plus 26 Crockford characters, no I, L, O, or U. The email is stored lower-cased and must be unique. An inactive row (`active = false`) or an unknown email gets 403 even when Access let the browser through.

To stop someone: remove the mailbox from the Access policy, and set `active = false` on the row. Deleting the row is not required.

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

Then open the workers.dev host in a browser, complete the one-time PIN for a mailbox that is on the Access policy and on an active `app_users` row, and confirm `/app` loads. A mailbox that is not on the policy is refused by Access. A mailbox that passes Access but has no active row is refused by the app with 403.

## 8. Demo project

One fictional job, labelled DEMO, for a made-up homeowner in Lubbock. It is not a real customer. Run it from the repository root against the staging database. `pnpm typecheck` first, so `dist` exists for the script to import. Use the Neon string, `sslmode=require`. That string is `DATABASE_URL` in this shell. It is the same value as the Worker secret `CONTAINER_DATABASE_URL`. Do not commit it.

```bash
pnpm typecheck
export DATABASE_URL='postgres://REPLACE_WITH_NEON_USER:REPLACE_WITH_NEON_PASSWORD@REPLACE_WITH_NEON_POOLER_HOST/REPLACE_WITH_NEON_DATABASE?sslmode=require'
export S3_ENDPOINT='https://REPLACE_WITH_ACCOUNT_ID.r2.cloudflarestorage.com'
export S3_BUCKET='apex-evidence-staging'
export S3_ACCESS_KEY_ID='REPLACE_WITH_R2_ACCESS_KEY_ID'
export S3_SECRET_ACCESS_KEY='REPLACE_WITH_R2_SECRET_ACCESS_KEY'
export S3_REGION='auto'
node scripts/seed-demo-project.mjs
```

The S3 values are the same ones stored as Worker secrets. The seed uploads one small placeholder JPEG into that bucket so the customer page can show it. Do not commit them.

A successful run prints:

```text
job id: job_…
customer link: /c/…
```

Open `/app` as staff for Today and the job page. Open the customer path on the workers.dev host. The customer path, `/customer.css`, and `/favicon.svg` are Access bypasses. The stylesheet and icon are the only files the process serves without an Access assertion.

The customer token is random. The seed saves it on the demo lead and prints the same path on a later run. A database that still has the old fixed demo token is given a new random path the first time this version runs, and that new path stays. Running the command again does not insert a second job.

Remove only that demo data:

```bash
node scripts/seed-demo-project.mjs --remove
```

## Crawlers

Every staging response is `X-Robots-Tag: noindex, nofollow, noarchive`. The Worker sets it, including on 503. The container sets it when `APEX_STAGING_NOINDEX=1`, and `GET /robots.txt` is `User-agent: *` / `Disallow: /`. Pages gets the same header from `dist/_headers` and the same robots file from the non-production website build.

## Local development

Leave `APEX_ACCESS_*` and `APEX_STAGING_NOINDEX` unset. The process keeps the pilot secret or OIDC, whichever you already use, and `/health` does not grow a noindex header. `scripts/ci.sh` does not need Cloudflare credentials.
