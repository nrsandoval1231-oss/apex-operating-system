# Forensic repository audit

Baseline: main `f6d5252f76a3b103b8849ae74c00fd9f9b07c022`, retrieved 2026-10-24. Scope: existing APEX only. See [architecture](ARCHITECTURE.md), [cleanup log](CLEANUP_LOG.md), [remaining risks](REMAINING_RISKS.md) and [readiness](APEX_2_READINESS.md).

## Method and coverage

Inventoried tracked files, workspace and independent manifests, application entry points, route table, SQL/migrations, runtime selectors, deployment paths, tests and archives. Read implementations rather than relying on previous audits. Followed commands from HTTP boundary into services, domain decisions, transaction writes and projections. Compared source ownership with imported and dynamic entry points. Ran Knip as a candidate generator; rejected its false positives for CSS fonts, dynamic Designer imports, CLI tools, deployment Worker, archival engines and operational scripts. No scanner result alone authorized deletion.

The initial inventory contains 624 tracked files, 4 applications, 6 shared packages and 36 migrations. The major-directory classification below covers the whole repository, but is not a claim that every execution path, external system or historical document was verified dynamically.

## Subsystem classification

| Subsystem | Class | Evidence and action | Dependencies / risk |
| --- | --- | --- | --- |
| Staff app/routes | KEEP | `App.tsx` routes, contract-checked resource hooks; preserve UI | API, contracts, domain, embedded Designer; global invalidation may overfetch |
| Staff session | KEEP | PKCE + cross-tab token tests; correct stale auth documentation | localStorage is a known exposure; cookie architecture DEFER |
| Website | RETIRE (obsolete content only); KEEP runtime | `router-tiles.ts` and old `hero` export have no rendered consumer; current homepage uses `home/*` and `home-v2.ts` | Review route/config/script/test references before removal; preserve imagery and consent |
| Designer engine/UI | KEEP | Pure engine, code checks, CLI/Tauri/embedded entry points and workbook tests | Quantities are safety/financial evidence; no aesthetic rewrite |
| Designer installation | CONSOLIDATE | Both pnpm workspace and npm lock install same app in CI/Docker | One dependency tree must pass standalone and embedded builds |
| API server | SIMPLIFY | 1,785-line route module; repeated price-input schemas | Keep auth boundaries; large router extraction deferred |
| Contracts | KEEP | Canonical IDs, strict DTOs, digest and schemas | Consumers include browser and server; do not replace with duplicate DTOs |
| Domain rules | KEEP | Pure decisions with regression tests | Historical countersign behavior retained despite inactive templates |
| GateService | REPAIR | 2,533-line baseline orchestration module; stale pre-lock decisions and duplicated canonical JSON helper | Repair locked decision boundary with real race tests; share pure helper |
| Proposals/pricing | KEEP | Typed pricing authority, versioned payloads, acceptance binds Job | Preserve explicit prices and acceptance requirements; concurrent command risks reviewed separately |
| Leads/follow-ups | KEEP | Canonical operational lead + pre-contract follow-ups | External intake IDs are separate integration identifiers |
| Procurement | KEEP | Job lock, revision checks, approved digest, scoped FK and history | Run PostgreSQL retry/race tests; no rule changes |
| Inspections/scheduling | KEEP | Inspection blockers, calendar conflict policy, batched inspections | No speculative indexes without measured workload |
| Draws/handover/closure | KEEP | Final phase, gates, inspections, invoices, history protections | No accounting redesign or change to closure gates |
| Customer pages | KEEP | Hashed links, revocation, photo visibility and access audit | Public capability must remain separate from staff session |
| Database adapter | REPAIR | Actual pg Client parsing overrides explicit TLS settings | Credential verification and private CA must survive URL parsing |
| SQL/migrations | KEEP | Ordered operational chain, advisory lock, uniqueness/FKs | Preserve all historical migrations, including retired RLS and storage migration |
| Local storage | REPAIR | Stale `.upload` prevents retry; check/rename is not atomic no-clobber | Use unique temporary file and atomic no-replace publication |
| S3 storage/configuration | REPAIR | Non-404 HEAD failures currently fall through to PUT; missing endpoint can silently select local disk | Fail closed; retain conditional PUT and isolated integration checks |
| Dependencies | REPAIR | Baseline pnpm audit reports vulnerabilities in tooling and runtime Zod | Compatible targeted upgrades; report residuals rather than force major overrides |
| CI/development scripts | SIMPLIFY | Two Designer installs; closeout browser harness omitted from main CI | Consolidate installation; retain explicit missing-infrastructure reporting |
| Docker | REPAIR | Pricing manifest absent from manifest-cache layer; prune failure swallowed | Build image locally; no deployment or infrastructure edits |
| Cloudflare adapter | REPAIR (toolchain); KEEP runtime | Thin container front door; separate lock/config; patched Wrangler/Undici advisories | Live Access/R2/Neon acceptance remains out of local scope |
| n8n workflows | DEFER | External SDK sources, Airtable holding store, blocked decisions | No deployed workflow or live messages touched |
| Archives/evidence | KEEP | Legacy proposal regression suites and quantity-chain tests import archive | Historical PDFs, JSON, CSV and engineering evidence retained |
| Deck tools | KEEP runtime; REPAIR deferred dependency | Explicit CLI scripts and README; high image-size advisory remains without established compatible upstream fix | Independent offline package; not production runtime; avoid untrusted images; no visual work |
| Documentation/agent evidence | KEEP | Root plans, ADRs, runbooks, `.agent`, `.hermes`, `.claude`, archive | Preserve historical statements; add current authoritative audit rather than rewrite history |

## Confirmed initial findings

1. **TLS policy overridden (high):** `PostgresDatabase.create` passes both connectionString and ssl. `pg.Client` merges parsed URL options afterward. A URL with `sslmode=no-verify` yields `{rejectUnauthorized:false}`; other modes discard the configured CA. Existing tests only called `resolveSsl`, missing the actual driver boundary. Five new characterization tests fail on baseline.
2. **Interrupted local upload blocks recovery:** fixed `<key>.upload` filename causes an abandoned file to reject every retry as existing evidence although the published key is absent. A regression reproduces this. `rename` also permits replacement after a stale existence check; publication must enforce no replacement atomically.
3. **Partial S3 configuration:** startup validates missing credentials only when endpoint is set; setting credentials/bucket without endpoint silently uses local filesystem despite the stated fail-closed contract.
4. **S3 error handling:** HEAD 403/5xx does not establish absence yet currently permits PUT. Preserve prior evidence by accepting only 404 as absence.
5. **Competing dependency authority:** Designer's npm CI replaces its pnpm workspace links, has a second lockfile and resolves different tooling. Root and standalone tests can exercise different trees.
6. **Docker dependency layer incomplete:** `packages/pricing-engine/package.json` is omitted before frozen workspace install, although API/service/staff packages reference it. Runtime pruning uses `|| true`, hiding failure. Restrictive checkout permissions are preserved by COPY and prevent non-root reads. Final image uses a production workspace install, readable root-owned code, and a non-root import check. The missing pricing manifest is corrected for dependency-layer consistency; it was not established as the observed startup failure.
7. **Verified obsolete website content:** prior router content and hero export remain after the existing homepage replacement. Current route imports, static build configuration and acceptance tests establish the replacement; no content loader enumerates these modules.
8. **Duplication:** takeoff and proposal paths implement the same recursive JSON key canonicalization. Preserve byte-for-byte behavior with characterization tests before sharing it.
9. **Validation boundary gaps:** root `verify` alone does not run Designer TSX tests, website checks/browser tests or closeout browser acceptance. `scripts/ci.sh` is broader but omits closeout and can explicitly skip infrastructure integration. No configured lint script exists.

Findings discovered during repair and independent review, final measurements and actual validation outcomes are recorded in the accompanying documents. A suspected risk is not classified as a proven exploitable production defect.

## Additional confirmed result and withdrawn hypothesis

**Gate race (high, repaired):** `GateService.execute` computed requirements/inspection decisions before its transaction acquired the job lock. A competing failure could commit during this interval and release still succeeded. Three deterministic PostgreSQL cases reproduce stale requirement, stale inspection and duplicate-release failures on baseline. The repaired path re-reads/re-decides and checks retries using the locked transaction. See `integration-tests/audit-races.test.ts` and retained red/green logs.

A signed-estimate corruption hypothesis was **withdrawn** after executable testing: migration 0032 prevents superseding the current job-bound revision and rolls the operation back. The regression preserves that evidence. Do not classify it as demonstrated corruption.

## Dependency graph and security scan limits

Workspace direction is contracts → domain/pricing → services → API, with database/storage adapters beneath services. The two Designer cycles reported by Madge traverse type-only imports back to `engine/index.ts` (`approvedTakeoff`/`apexSubmission`); they are not demonstrated runtime initialization cycles. No shared-package runtime cycle was found by inspection. Alias/dynamic entry points limit what static scans alone prove.

Targeted tracked-text credential patterns matched no private-key blocks, GitHub tokens or AWS access-key literals. This is limited evidence, not certification of Git history, deployments or all credential formats. Workspace dependency findings and the independent Worker audit are recorded separately in validation.
