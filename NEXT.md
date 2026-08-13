# Apex — Next

## Immediate next milestone: staging acceptance

1. Configure the staging dependencies and secrets in [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md).
2. Deploy the CI-green root commit to staging. Confirm `/ready` reports database and evidence readiness.
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
- Decide whether to configure `APEX_PROPOSAL_DEPLOY_KEY` for the legacy cross-repository chain or retire that legacy CI dependency.
- Obtain and approve the Hayward catalog and excavator dig-sheet reference before implementing those deferred Designer capabilities.

## Verification commands

Root:

```bash
pnpm run typecheck
pnpm --filter @apex/os build
pnpm run test
pnpm audit --prod --audit-level high
git diff --check
```

Designer:

```bash
npm test
npm run build
git diff --check
```

The completed implementation baseline is recorded in [`STATUS.md`](STATUS.md).
