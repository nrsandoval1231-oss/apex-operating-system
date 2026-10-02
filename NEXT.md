# Apex — Next

## Immediate next milestone: stand up Cloudflare staging, then acceptance

[`docs/runbooks/cloudflare-staging.md`](docs/runbooks/cloudflare-staging.md) is the staging procedure. [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md) describes Render and is historical. Hosting is Cloudflare only, never Vercel. Do not deploy until Nick runs that runbook from his machine. CI remains `scripts/ci.sh`.

1. Supply the Cloudflare, Neon, R2, and Access values the runbook lists, then deploy to `*.workers.dev` and `*.pages.dev` only.
2. Confirm `/ready` reports database and evidence readiness, and that `scripts/staging-smoke.sh` passes.
3. Run this controlled lifecycle with non-production customer data:

```text
Create opportunity
→ open it in Designer
→ choose Sports Pool 3′–5′–3′
→ resolve design blockers
→ download and inspect Takeoff (.xlsx)
→ Finish estimate
→ enter every approved measured estimate and direct quote/N/A decision
→ issue the exact Proposal version
→ print/save PDF and verify email-copy actions
→ record acceptance
→ verify exactly one Job and Project exist
→ exercise construction mutations
→ satisfy closeout reconciliation
→ close and archive
→ verify read-only History and retained artifacts
```

4. Retry Finish Estimate, issue, sign, and close commands with the same idempotency keys and confirm no duplicate revision, event, Job, Project, or closeout record appears.
5. Attempt closed-job mutations and confirm the API refuses them while History, takeoff, Proposal, and retained evidence reads still work.
6. Complete a staging database restore and evidence spot-check before approving a real pilot.

## Before production

- Use the final HTTPS `APEX_PUBLIC_ORIGIN`; do not issue customer links on a temporary hostname.
- Confirm real staff OIDC identities are mapped to active `app_users` rows and least-privilege roles.
- Verify approved pricing inputs for the pilot estimate. Apex intentionally has no inferred/default customer price authority.
- Confirm object-storage versioning and backup retention.
- Obtain and approve the Hayward catalog and excavator dig-sheet reference before implementing those deferred Designer capabilities.

The legacy takeoff-to-proposal chain reads `apps/designer` and `archive/proposal-engine` in this repository. Do not configure a proposal-engine deploy key.

## Verification commands

```bash
scripts/ci.sh
```

That runs install, typecheck, the Apex OS build, the Designer build, the website production-webhook refusal, the website check and build, core unit tests, Designer unit tests, the legacy proposal-engine scripts, and website Playwright. Integration tests run only when `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` are set. Otherwise the script says it skipped them. That skip is not a pass.

The 2026-10-02 run of that script is recorded in [`STATUS.md`](STATUS.md).
