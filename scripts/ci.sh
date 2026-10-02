#!/usr/bin/env bash
# Local CI for the Apex operating system.
#
# This script is the verification entry point. Do not add a GitHub Actions
# workflow for it. Hosting is Cloudflare; this script does not deploy.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

log() {
  printf '\n== %s\n' "$1"
}

fail() {
  printf 'ci: %s\n' "$1" >&2
  exit 1
}

log "install"
corepack enable
corepack prepare pnpm@11.18.0 --activate
pnpm install --frozen-lockfile
# Designer's typecheck and tests use its own npm tree. Install it before
# typecheck, and not at the same time as another install into that directory.
( cd apps/designer && npm ci --ignore-scripts )

log "typecheck"
pnpm typecheck
( cd apps/designer && npm run typecheck )

log "builds"
pnpm --filter @apex/os build
( cd apps/designer && npm run build )
# The production guard has to run before the successful website build so a
# failed production attempt is not what `dist/` is left holding. Astro throws
# while loading site config, before it writes pages, but keep the order anyway.
log "website production build without a lead webhook (must fail)"
if (
  cd apps/website
  env -u PUBLIC_LEAD_WEBHOOK_URL PUBLIC_ENV=production pnpm exec astro build
); then
  fail "production website build succeeded without PUBLIC_LEAD_WEBHOOK_URL"
fi
printf 'production build refused to ship without PUBLIC_LEAD_WEBHOOK_URL\n'

WEBHOOK_TEST="${PUBLIC_LEAD_WEBHOOK_URL_TEST:-https://lead-webhook.example/webhook-test/apex-lead-intake}"
log "website check and build"
(
  cd apps/website
  PUBLIC_ENV=development PUBLIC_LEAD_WEBHOOK_URL_TEST="$WEBHOOK_TEST" pnpm exec astro check
  PUBLIC_ENV=development PUBLIC_LEAD_WEBHOOK_URL_TEST="$WEBHOOK_TEST" pnpm exec astro build
)

log "unit tests (core)"
# Designer engine tests also match the root vitest include. They run once,
# under the Designer suite below, so this filter stays on the workspace packages
# and the staff app.
pnpm exec vitest run --maxWorkers=1 --no-file-parallelism \
  packages apps/gate-api apps/apex-os

log "unit tests (designer)"
( cd apps/designer && npm test )

log "unit tests (legacy proposal engine)"
(
  cd archive/proposal-engine
  node engine.test.mjs
  node whitaker-evidence.test.mjs
  node approved-takeoff.test.mjs
  node browser-graph.test.mjs
  node quantity-ownership.test.mjs
)

log "website Playwright"
(
  cd apps/website
  pnpm exec playwright install chromium
  # Astro 7 backgrounds `astro dev` when it sees an agent environment variable,
  # and Playwright then reports that the web server exited. Clearing them is
  # what a human terminal already does by not having them.
  env -u CLAUDECODE -u CURSOR_TRACE_ID -u GEMINI_CLI \
    PUBLIC_ENV=development \
    PUBLIC_LEAD_WEBHOOK_URL_TEST="$WEBHOOK_TEST" \
    pnpm exec playwright test
)

missing=""
for var in DATABASE_URL S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    missing="${missing} ${var}"
  fi
done

if [ -n "$missing" ]; then
  printf '\n== SKIP integration tests\n'
  printf '   Postgres and S3 are not configured, so the integration suite was not run.\n'
  printf '   Missing:%s\n' "$missing"
  printf '   This skip is not a pass of the Postgres adapter or evidence storage tests.\n'
  printf '   Provide DATABASE_URL, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and\n'
  printf '   S3_SECRET_ACCESS_KEY, then run scripts/ci.sh again.\n'
else
  log "integration tests"
  pnpm exec vitest run --config integration-tests/vitest.config.ts \
    --maxWorkers=1 --no-file-parallelism
fi

printf '\n== ci.sh finished\n'
