# Apex OS — handoff

**As of:** 2026-10-02, verified by `scripts/ci.sh` (exit 0). Layout: one repository, no deploy keys. The former GitHub repositories were deleted; their history lives in this repository's git history.

The unified lifecycle is implemented. Local verification is `scripts/ci.sh`, not GitHub Actions. Start with [`STATUS.md`](../STATUS.md) for the verified baseline and [`NEXT.md`](../NEXT.md) for what comes next. Staging is [`docs/runbooks/cloudflare-staging.md`](runbooks/cloudflare-staging.md). [`docs/runbooks/deployment.md`](runbooks/deployment.md) is a Render procedure and is historical. Do not deploy from it.

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
- Finish Estimate handoff and export blockers. Staff calls send the same bearer token as Apex OS. The first Finish on an existing draft keeps the prices that were entered.
- 585 tests passed on 2026-10-02, plus typecheck and production build.

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

`scripts/ci.sh` on 2026-10-02, Node v22.22.2, pnpm 11.18.0, PostgreSQL 16.15, moto S3. Exit 0.

- Core unit suite: 36 files, 518 tests passed.
- Designer: 26 files, 585 tests passed.
- Website Playwright: 122 passed.
- Integration: 24 passed, 2 skipped. The skips are the missing-engine guards (`APEX_REQUIRE_DESIGNER_CONTRACT`, `APEX_REQUIRE_TAKEOFF_CHAIN`). Postgres, S3, the Designer contract, and the takeoff chain ran.
- `pnpm audit --prod`: critical 0, high 0, one moderate (`uuid` via `exceljs`).

GitHub Actions run `31735048854` is the 2026-08-13 historical run. It is not current CI. Designer source is `apps/designer` in this repository. There is no separate Designer `main` to keep in sync.

The legacy Designer → proposal-engine chain reads `archive/proposal-engine` here. No deploy key. That chain is not the production Proposal path (`packages/pricing-engine`).

## Remaining work

This is now operational, not broad product implementation:

1. Stand up staging from [`docs/runbooks/cloudflare-staging.md`](runbooks/cloudflare-staging.md). Do not use the Render runbook. `render.yaml` and the GitHub Actions workflows have been removed. Nick supplies the Cloudflare, Neon, R2, and Access values. This repository does not deploy itself.
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
