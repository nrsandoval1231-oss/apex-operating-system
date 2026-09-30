# Apex OS — handoff

**As of:** 2026-08-13 verification baseline. Layout notes corrected 2026-09-30: one repository, no deploy keys. The former GitHub repositories were deleted; their history lives in this repository's git history.

The unified non-Website lifecycle is implemented and CI-green on that baseline. Start with [`STATUS.md`](../STATUS.md) for the verified baseline, [`NEXT.md`](../NEXT.md) for staging acceptance, and [`docs/runbooks/deployment.md`](runbooks/deployment.md) for deployment operations.

## Current authority

```text
Opportunity
→ Apex Designer (`designer-quantity-v5`)
→ ordering Takeoff (.xlsx)
→ Finish estimate
→ durable versioned Proposal
→ accepted Proposal / one Job + Project
→ construction workflow
→ close and archive
→ immutable History
```

Important boundaries:

- Pre-contract intake creates an opportunity, not a fake Job.
- Designer owns geometry and measured quantities.
- Root `packages/pricing-engine`, `packages/gate-service`, database migrations, Gate API, and Apex OS own the production Proposal path.
- `archive/proposal-engine` in this repository is legacy reference/calibration evidence, not production authority.
- Issued/signed Proposals, approved takeoffs, events, and archived records are immutable.
- Closed Jobs reject operational mutations and have no reopen path.

## What shipped

### Designer

- True 3′–5′–3′ sports profile across calculations, views, and exports.
- Ordering-focused `.xlsx` workbook with `Order List` first.
- Soil/excavation assumptions and JSON diagnostics under Advanced.
- Finish Estimate handoff and export blockers.
- 580 tests plus typecheck/build verification.

### Estimate and Proposal

- Typed `manual-approved-pricing-v1` engine.
- Missing prices and unresolved scope fail closed; no inferred rate card exists.
- Idempotent Finish Estimate pinned to opportunity + design digest.
- Optimistic draft revisions; immutable issued/signed versions.
- Print/save-as-PDF, copy-email, and `mailto:` preparation.
- Acceptance of an issued version creates exactly one Job and Project.

### Construction closeout and History

- Eleven phases and nine active Gate definitions.
- One authorized release signature for active Gates; historical countersigns retained.
- Reconciliation-backed idempotent close.
- API/service mutation refusal after close.
- Searchable read-only History and retained takeoff/artifact reads.

## Verification

- Root unit suite: 514 tests passed (2026-08-13 baseline).
- Root CI verifies real PostgreSQL, MinIO/S3, dependency audit, container build/startup, storage warning path, and authentication-bypass refusal.
- GitHub Actions run `31735048854` passed on that baseline.
- Designer source is `apps/designer` in this repository. There is no separate Designer `main` to keep in sync.

The legacy Designer → proposal-engine chain reads `archive/proposal-engine` here. No deploy key. That chain is not the production Proposal path (`packages/pricing-engine`).

## Remaining work

This is now operational, not broad product implementation:

1. Configure staging dependencies and deploy manually.
2. Execute the full staged lifecycle in [`NEXT.md`](../NEXT.md).
3. Run and document a backup restore.
4. Use a final HTTPS origin before issuing real customer links.
5. Supply approved Hayward catalog and excavator dig-sheet references before implementing those deferred Designer features.
6. Do not add a proposal-engine or Designer deploy key. Those checkouts are retired; see `docs/runbooks/deployment.md` §8 and §8b.

## Rules for the next engineer

- Do not edit applied migrations; add a forward migration.
- Do not infer prices, acceptance, email delivery, or reconciliation.
- Do not restore mutation controls to History without a new explicit business decision and migration.
- Do not rewrite the remaining `docs/archive/` artifacts or old `designer-quantity-v4` fixtures to appear current. Duplicate imported-repo copies were removed; that history lives in git, and the old GitHub repositories were deleted.
- Treat `STATUS.md`, `NEXT.md`, and current decision/runbook documents as active guidance; older sections of `docs/status.md` are chronological history.
