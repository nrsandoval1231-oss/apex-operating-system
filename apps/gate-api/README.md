# Gate API and Apex OS

`@apex/gate-api` is the authenticated HTTP boundary for the non-Website Apex lifecycle. It serves Apex OS at `/app`, customer-safe token pages at `/c/:token`, retained evidence, health/readiness endpoints, and the authoritative mutation routes.

## Supported lifecycle

```text
Opportunity intake
→ approved takeoff / Finish estimate
→ Proposal draft, issue, list, get, sign
→ Job + Project
→ Gates, inspections, schedules, draws, customer updates
→ close/archive
→ read-only History
```

All staff mutations require authenticated roles and idempotency where the command can be retried. The API delegates business authority to `@apex/gate-service`; it does not create browser-only workflow state.

## Local environment

- `PORT` — optional; defaults to `4100`.
- `HOST` — optional; defaults to `127.0.0.1`.
- `GATE_DATA_DIRECTORY` — embedded PostgreSQL directory; defaults under `var/`.
- `GATE_EVIDENCE_DIRECTORY` — private local evidence directory.
- `GATE_LOCAL_USER` — optional canonical local user for loopback-only development. It cannot coexist with OIDC or a non-loopback bind.

Production/staging uses managed PostgreSQL, OIDC, and S3-compatible storage. See [`../../docs/runbooks/deployment.md`](../../docs/runbooks/deployment.md) for the complete variable list and safety checks.

Run from the root after building:

```bash
pnpm run typecheck
pnpm --filter @apex/os build
pnpm --filter @apex/gate-api start
```

Then open `http://127.0.0.1:4100/app`.

## Safety

- `GATE_LOCAL_USER` is a local bypass and startup refuses it outside loopback.
- Missing authoritative prices remain Proposal blockers.
- Issued/signed Proposal versions and approved takeoffs are immutable.
- A Job is created only after explicit acceptance of an issued Proposal.
- Closed Jobs retain reads but mutation routes return a domain refusal.
- `/ready` checks both database and evidence storage; do not continue a deployment while it reports degraded.
