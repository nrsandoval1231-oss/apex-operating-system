# Website public lead intake

The anonymous endpoint is `POST /api/public/v1/leads`. It writes a version 2 website submission into the existing `leads` table, using `intake_source = 'website'`; no schema migration is required. Staff opportunities continue to read the same table and can resolve the submitted customer through `customerName`, `first_name`, `last_name`, `email`, `phone`, and the project city in `accepted_payload`.

The endpoint is off unless `APEX_PUBLIC_LEAD_INTAKE=1` is set. Configure `APEX_PUBLIC_LEAD_ORIGINS` as a comma-separated list of exact HTTPS origins (for example `https://www.example.com`). The API responds to allowed `OPTIONS` requests before the staff authenticator, and emits an origin-specific CORS header. It never uses wildcard CORS. The gateway/Cloudflare Access policy must bypass authentication for this path; keep all other API paths protected.

For the existing Cloudflare Container wrapper, set the optional Worker variables `APEX_PUBLIC_LEAD_INTAKE=1` and `APEX_PUBLIC_LEAD_ORIGINS=<comma-separated origins>` to pass them into the container. The wrapper forwards each only when explicitly configured; with both unset, the API remains disabled by default. The API process validates the flag and every origin at startup. This code wiring does not itself create the Cloudflare Access bypass or configure Worker variables.

Request bodies are JSON and capped at 16 KiB. The existing snake_case lead fields remain required, with `schema_version: 2`, the four exact vertical values, a stable `lead_id` in `apex_<unix-seconds>_<4 lowercase base36>` form, `project` with required type and city, an empty `website` honeypot, and `consent_version: "website-2-20261024"`. Contact requires a valid email or a phone number with at least ten digits; email-only submissions are supported. If SMS consent is true, the submitted consent text must exactly match the disclosure for that vertical. If false, consent text must be empty. The honeypot is not persisted. Text fields are capped at 200 characters except `project.description` at 4,000; feature lists are capped at 30 entries. The stable website `lead_id` alone determines idempotency; any `Idempotency-Key` header is ignored. A replay with identical content returns `duplicate`; changed content for that website ID returns 409. Responses are `no-store` and errors do not expose submitted data.

The built-in limiter allows eight requests per remote socket address per minute. It deliberately ignores forwarded-IP headers. This is a per-process guard only: configure a distributed rate limit at the edge before public launch. Keep the origin allowlist current when domains change. Submission is reported accepted only after the database insert or replay lookup succeeds; persistence uncertainty returns 503.

## Local verification

The API tests create a temporary on-disk PGlite database and remove it after each case. Run:

```powershell
pnpm exec vitest run apps/gate-api/src/publicLeads.test.ts --maxWorkers=1 --no-file-parallelism
pnpm --filter @apex/gate-api build
```

These checks exercise durable insert/replay, changed-content conflicts, concurrent requests, phone-only contact, exact vertical and consent validation, honeypot exclusion, body bounds, exact-origin preflight (including missing Origin), disabled-by-default behavior, persistence failure, and the staff authentication boundary. They do not prove that a hosting gateway bypasses Access for the public route or that a distributed edge limiter is configured; those remain deployment gates.

## Isolated review fixture

The review runner serves only `/api/public/v1/leads` on `127.0.0.1:4411`. Every other path, including health and receipt paths, returns 404. It uses the existing operational migrations and a persistent local database at `var/website-review-db`; this directory is review-only and must not be pointed at production or staging OS data. The provided defaults allow the local website and the dedicated review Pages project. To allow another immutable preview origin, set `WEBSITE_REVIEW_ORIGINS` to a comma-separated complete origin list before startup.

```powershell
pnpm --filter @apex/gate-api build
node tools/website-intake-fixture.mjs start
```

The startup line reports the path, origins, and database directory without lead data. From a second PowerShell window, check that the listener is present:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 4411
```

Stop the runner with Ctrl+C before reading a receipt, so a second process never opens the same PGlite database concurrently. Then query by the website `lead_id`; the receipt contains only IDs and status, never customer fields:

```powershell
node tools/website-intake-fixture.mjs receipt apex_1721925123_a1b9
```

Restart with the `start` command to continue review against the same persistent database. The tunnel is a temporary review ingress, not evidence of a production deployment or durable hosting configuration.
