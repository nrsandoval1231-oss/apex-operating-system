#!/usr/bin/env bash
# Build the marketing site for isolated Cloudflare Pages staging. Does not deploy.
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT/apps/website"
: "${PUBLIC_SITE_URL:?Set PUBLIC_SITE_URL to the dedicated pages.dev origin}"
case "$PUBLIC_SITE_URL" in https://*.pages.dev) ;; *) echo 'PUBLIC_SITE_URL must be an https://*.pages.dev origin' >&2; exit 1;; esac
if [ "${PUBLIC_PREVIEW_INTAKE_DISABLED:-}" = '1' ]; then
  if [ -n "${PUBLIC_LEAD_WEBHOOK_URL:-}" ] || [ -n "${PUBLIC_LEAD_WEBHOOK_URL_TEST:-}" ]; then
    echo 'Call-only preview requires both inquiry endpoints unset' >&2; exit 1
  fi
else
: "${PUBLIC_LEAD_WEBHOOK_URL_TEST:?Set PUBLIC_LEAD_WEBHOOK_URL_TEST to the isolated intake URL}"
node --input-type=module -e '
const u = new URL(process.env.PUBLIC_LEAD_WEBHOOK_URL_TEST); const h = u.hostname;
const isolated = h.endsWith(".trycloudflare.com") || h.endsWith(".workers.dev") || ["localhost","127.0.0.1"].includes(h);
const canonical = isolated && u.pathname === "/api/public/v1/leads";
const legacy = u.pathname.includes("/webhook-test/");
if (u.username || u.password || u.search || u.hash || (!canonical && !legacy) || (u.protocol !== "https:" && !["localhost","127.0.0.1"].includes(h))) throw new Error("Staging intake must use an isolated canonical public API or explicit test webhook.");
'
fi
PUBLIC_ENV=staging PUBLIC_SITE_URL="$PUBLIC_SITE_URL" pnpm exec astro build
cat > dist/_headers <<'EOF'
/*
  X-Robots-Tag: noindex, nofollow, noarchive
EOF
# Emit only site-relative legacy path redirects. Domain rules belong to production DNS cutover.
node --input-type=module -e '
import {readFileSync,writeFileSync} from "node:fs";
const {pages=[]}=JSON.parse(readFileSync("config/redirects.json","utf8"));
const lines=pages.map(({from,to,status=301})=>`${from} ${to} ${status}`);
writeFileSync("dist/_redirects",lines.join("\n")+"\n");
'
printf 'staging website build wrote %s\n' "$ROOT/apps/website/dist"
