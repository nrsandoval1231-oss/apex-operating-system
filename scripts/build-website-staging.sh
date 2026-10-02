#!/usr/bin/env bash
# Build the marketing site for Cloudflare Pages staging.
# Non-production: robots.txt disallows everything, and the quote form uses the test webhook.
# Does not deploy.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT/apps/website"

: "${PUBLIC_SITE_URL:?Set PUBLIC_SITE_URL to the pages.dev origin, for example https://apex-website-staging.pages.dev}"
: "${PUBLIC_LEAD_WEBHOOK_URL_TEST:?Set PUBLIC_LEAD_WEBHOOK_URL_TEST to the non-production intake URL}"

case "$PUBLIC_SITE_URL" in
  https://*.pages.dev) ;;
  *)
    printf 'staging build: PUBLIC_SITE_URL must be an https://*.pages.dev origin\n' >&2
    exit 1
    ;;
esac

if printf '%s' "$PUBLIC_LEAD_WEBHOOK_URL_TEST" | grep -q 'webhook-test'; then
  :
else
  printf 'staging build: PUBLIC_LEAD_WEBHOOK_URL_TEST must contain webhook-test\n' >&2
  exit 1
fi

PUBLIC_ENV=staging \
  PUBLIC_SITE_URL="$PUBLIC_SITE_URL" \
  PUBLIC_LEAD_WEBHOOK_URL_TEST="$PUBLIC_LEAD_WEBHOOK_URL_TEST" \
  pnpm exec astro build

# Pages applies this file to the uploaded dist. It is not committed under public/,
# so a later production build does not inherit a staging noindex header.
cat > dist/_headers <<'EOF'
/*
  X-Robots-Tag: noindex, nofollow, noarchive
EOF

printf 'staging website build wrote %s\n' "$ROOT/apps/website/dist"
