# Reproducible validation and measurements

Date: 2026-10-24 UTC. Baseline: `f6d5252f76a3b103b8849ae74c00fd9f9b07c022`. Clean application/runtime code: `3a39be4baffe8937ef211b428c7ce5a593621bec`; independent Worker patch `b70907b810197b541d4f3925fc36170969633893` is separately validated by a fresh frozen npm install, audit and Worker-only dry run (exit 0, 3.549 s). Documentation/evidence commits do not change application behavior.

Environment: disposable Linux workspace, Node 24.19.0, pinned pnpm 11.18.0 (an initial bootstrap install used 11.25.0; all CI used Corepack's repository pin), Docker 28.4.0, PostgreSQL 17.11, Moto 5.1.15 S3 emulator, Chromium 151 / Playwright 1.62.0. Container base resolved to Node 24.22.1. All DB users, jobs and storage objects were synthetic. No production service was called.

## Actual validation results

| Command / scope | Baseline result | Clean result |
| --- | --- | --- |
| `bash scripts/ci.sh` | Exit 1 at Astro/Playwright server startup; prior steps below passed. Missing Codex agent-variable clearing reproduced. | Exit 0, 609.103 s, including PostgreSQL/S3 configuration and full closeout harness |
| `pnpm install --frozen-lockfile` | Exit 0; Designer additionally ran `npm ci --ignore-scripts` | Exit 0, single workspace installation |
| `pnpm typecheck` | Exit 0 | Exit 0 |
| Designer `typecheck` | `npm run typecheck`, exit 0 | `pnpm --filter apex-designer typecheck`, exit 0 |
| `pnpm --filter @apex/os build` | Exit 0 | Exit 0 |
| Designer `build` | `npm run build`, exit 0 | `pnpm --filter apex-designer build`, exit 0 |
| Website `astro check` and development `astro build` | Exit 0 | Exit 0 |
| Production website build without webhook | Expected refusal, nonzero exit | Expected refusal, nonzero exit; safeguard retained |
| `pnpm exec vitest run --maxWorkers=1 --no-file-parallelism packages apps/gate-api apps/apex-os` | 43 files; 559 passed, 2 skipped; 437.50 s. The 2 PostgreSQL cases were subsequently run successfully separately. | 47 files; **581 passed, 0 skipped**, 472.73 s |
| Designer suite | 26 files; **585 passed**, 3.23 s | 26 files; **585 passed**, 4.56 s |
| Archive proposal scripts | All 5 scripts exit 0; custom assertion runners, not a Vitest test count | All 5 exit 0 |
| Website `pnpm run test:unit` | **2 passed**, exit 0 | **2 passed**, exit 0 |
| Website `pnpm exec playwright test` | First startup failed; with `CODEX_THREAD_ID` also cleared: **166 passed**, exit 0, 51.4 s | **166 passed**, exit 0, 58.5 s |
| Website `pnpm run test:production` | **10 passed**, exit 0, 11.7 s | **10 passed**, exit 0, 10.2 s |
| `node apps/apex-os/tests/estimate-navigation.e2e.mjs` | Exit 0 | Exit 0: fees, reused route identity, handoff and delayed request isolation |
| `pnpm exec vitest run --config integration-tests/vitest.config.ts --maxWorkers=1 --no-file-parallelism` | 8 files; **35 passed, 2 skipped**, exit 0, 6.56 s | 9 files; **39 passed, 2 skipped**, exit 0, 6.02 s |
| `node apps/apex-os/tests/closeout-acceptance.e2e.mjs` | Exit 0 | Exit 0: exact proposal acceptance, one Job/Project, authorization, 7 inspections, gate release, handover, closure, retained evidence/history, anonymous evidence refusal and no browser errors |
| Website `pnpm run validate` with production build environment below | Exit 0, 14.562 s | Exit 0, 8.748 s; stock-image/OG-image configuration notes remain |
| Workspace `pnpm audit --json` | Exit 1: 50 advisory findings | Exit 1: 1 moderate advisory remains; **not a clean audit exit** |
| Container build + non-root runtime smoke | Image build exited 0 despite swallowed prune failure; runtime import failed under restrictive checkout permissions. Root import succeeded. | Final build exit 0; non-root import passes; `/ready` reports database/evidence true; `/health` and `/app/` return 200; anonymous `/api/jobs` returns 403 |
| Worker dry run | Not executed against live infrastructure | Original dry-run wrapper attempted container build without this environment's proxy CA and failed. Worker-only `wrangler deploy --dry-run --containers-rollout none` passes; container independently built with CA mount. No upload/deploy. |
| Independent Worker `npm audit --json` | 4 high findings in original locked toolchain | Exit 0, zero advisories after Wrangler/Undici patch; Worker-only dry run exit 0 |
| Offline deck dependency audit | No lockfile in repository | Fresh isolated resolution of unchanged manifest reports 1 high image-size finding (exit 1); no compatible upstream fix established; generator not executed |
| Lint | No configured lint command | Not applicable; no lint pass claimed |

The clean automated runners report **1,383 passing test cases**, plus the two standalone staff browser harnesses and five archive scripts. Two integration tests remain skipped: they are failure guards that only run when an in-repository engine is missing. Both engines exist and the actual Designer/quantity/pricing chain tests run. These skips are not counted as passes. The baseline optional PostgreSQL rerun used `-t PostgreSQL`: 2 passed and 12 nonmatching tests reported skipped; those 12 already ran in the baseline core suite.

New characterization evidence: five TLS override cases and stale upload failed on baseline; S3 forbidden HEAD incorrectly allowed PUT; all three gate race cases failed on baseline. Repaired tests pass. The signed-estimate corruption hypothesis passed its protection check on baseline and remains covered after cleanup.

## Reproduction

From the repository root, with isolated local PostgreSQL and S3-compatible service and an existing test bucket:

```bash
corepack pnpm install --frozen-lockfile
export DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex_clean
export S3_ENDPOINT=http://127.0.0.1:59000
export S3_BUCKET=apex-clean
export S3_ACCESS_KEY_ID=apex-test
export S3_SECRET_ACCESS_KEY=apex-disposable-secret
export S3_REGION=us-east-1
export EVIDENCE_DIR=/tmp/apex-audit/clean/closeout
bash scripts/ci.sh
```

These are deliberately synthetic credentials for disposable services, not deployment configuration. The audit ran PostgreSQL in `postgres:17` bound only to loopback and Moto in a temporary Python environment. MinIO pulls from Docker Hub and Quay failed authorization, so S3 validation used Moto. Signing requests and adapter semantics were exercised; real provider signature verification, IAM/TLS and outage behavior remain unverified.

The exact archive commands, in `archive/proposal-engine`, were `node engine.test.mjs`, `node whitaker-evidence.test.mjs`, `node approved-takeoff.test.mjs`, `node browser-graph.test.mjs`, and `node quantity-ownership.test.mjs`.

Production website artifact validation, from `apps/website`:

```bash
PUBLIC_ENV=production \
PUBLIC_LEAD_WEBHOOK_URL=https://lead-webhook.example/webhook/apex-lead-intake \
corepack pnpm run validate
```

Browser tests use intercepted reserved-domain webhooks and no real tracking IDs. Baseline browser recovery command was `env -u CODEX_THREAD_ID -u CLAUDECODE -u CURSOR_TRACE_ID -u GEMINI_CLI corepack pnpm exec playwright test`; cleaned CI incorporates this environment handling.

Docker checks used a temporary copy of the repository Dockerfile adding **only environment-specific proxy CA secret mounts and `NODE_USE_ENV_PROXY=1` to networked RUN steps**. No TLS verification was disabled. Build command:

```bash
docker --host=unix:///var/run/docker.sock build \
  --secret "id=proxy_ca,src=$CODEX_PROXY_CERT" \
  -f /tmp/apex-audit/clean/Dockerfile.validation \
  -t apex-audit-clean:local .
```

The runtime smoke used a private Docker network connecting the synthetic PostgreSQL container, explicit `sslmode=disable` for that isolated test connection, local evidence storage, a synthetic pilot secret and loopback port 54100. Final HTTP outcomes are retained in `evidence/clean/docker-runtime-final.log`. Docker cache briefly exhausted the disposable workspace; a failed build is retained in the session record and the task's build cache was reclaimed before the successful build. This was not classified as a product regression.

## Before/after measurements

`tools/measure.py` counts Git-tracked files in apps/packages and measures emitted JavaScript with deterministic gzip; excludes source maps, CSS/fonts/media. Production-source count excludes tests. `tools/benchmark.mjs` and `tools/query-profile.mjs` require explicitly configured loopback PostgreSQL. Commands were run from each worktree with the same synthetic 43-job dataset; 100 HTTP samples after one warmup per route, sequential baseline/clean after CI finished. This is a small local sample, not a load test.

| Measurement | Baseline | Clean |
| --- | ---: | ---: |
| Workspace direct dependency declarations | 67 | 64 |
| Lock/audit dependency records (includes optional/dev) | 713 | 646 |
| Workspace vulnerability findings | 7 low / 30 moderate / 11 high / 2 critical | 1 moderate (offline deck audit separately retains 1 high) |
| Apps/packages production source lines | 42,623 | 42,554 |
| Apps/packages source lines including tests | 58,651 | 58,693 |
| Designer npm lockfiles | 1 (3,559 lines) | 0 |
| Duplicate canonical serializers | 2 | 1 |
| Staff emitted JS bytes / gzip bytes | 1,622,062 / 471,984 | 1,647,705 / 481,039 |
| Designer emitted JS bytes / gzip bytes | 1,377,511 / 403,436 | 1,377,511 / 403,436 |
| Production website JS bytes / gzip bytes | 203,407 / 64,804 | 203,341 / 64,766 |
| Staff Vite build phase | 5.44 s | 5.89 s |
| Designer Vite build phase | 4.92 s | 4.51 s |
| Website development Astro build | 565 ms | 580 ms |
| Today service DB statements, 43 jobs / 68 cards | 8 | 8 |
| Container image reported size | 713,149,526 bytes | 701,646,910 bytes |

| Local HTTP route | Baseline median / p95 ms | Clean median / p95 ms |
| --- | ---: | ---: |
| `/api/jobs` | 4.31 / 6.31 | 4.58 / 6.48 |
| `/api/today` | 21.39 / 25.63 | 22.47 / 29.25 |
| `/api/calendar` | 10.20 / 11.95 | 10.91 / 13.53 |
| `/api/jobs/<synthetic-job>/project` | 2.31 / 2.73 | 2.44 / 3.08 |

No speed improvement is claimed. Build/test times are single runs with different cache/contention conditions. An earlier overlapping-build HTTP sample was noisier; the final idle comparison above shows modest variation, not an established throughput regression. The staff JS increase (25,643 bytes raw, 9,055 gzip) is an explicit security-tooling/runtime-schema update cost. ExcelJS remains a large lazy chunk; it is functional, not unused. The retained synthetic event-replay EXPLAIN uses a sequential scan; this small dataset does not justify a production index migration. No query performance gain is claimed.

## Evidence and limits

`evidence/` retains failure logs (trailing whitespace normalized), clean CI output, audit JSON, command/commit/exit metadata, measurements and query plans. `tools/run-command.py` records a command, its working directory, HEAD at completion, elapsed seconds and exit code. The baseline worktree kept production source unchanged; new regression files were run separately to demonstrate faults. Full clean CI ran application code unchanged through its execution; subsequent edits were Docker, additional integration characterizations, independent Worker dependencies and documentation, validated in their respective checks.

Native Windows Tauri packaging, live identity/Access configuration, real R2 permissions, deployed n8n workflow behavior, production backup/restore and production-scale performance were not tested. See [remaining risks](REMAINING_RISKS.md). Local test success is not production readiness.
