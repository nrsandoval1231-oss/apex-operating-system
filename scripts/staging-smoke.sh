#!/usr/bin/env bash
# Smoke-test a Cloudflare staging deploy. Point it at the workers.dev and pages.dev URLs.
# Does not deploy. Does not print secret values.
set -euo pipefail

: "${STAGING_OS_URL:?Set STAGING_OS_URL to the https://<name>.<subdomain>.workers.dev origin}"
: "${STAGING_WEB_URL:?Set STAGING_WEB_URL to the https://<project>.pages.dev origin}"

os="${STAGING_OS_URL%/}"
web="${STAGING_WEB_URL%/}"

case "$os" in
  https://*.workers.dev) ;;
  *) printf 'STAGING_OS_URL must be an https://*.workers.dev origin\n' >&2; exit 1 ;;
esac
case "$web" in
  https://*.pages.dev) ;;
  *) printf 'STAGING_WEB_URL must be an https://*.pages.dev origin\n' >&2; exit 1 ;;
esac

access=()
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] || [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  : "${CF_ACCESS_CLIENT_ID:?Set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET}"
  : "${CF_ACCESS_CLIENT_SECRET:?Set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET}"
  access=(-H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}" -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}")
fi

fail() {
  printf 'smoke: %s\n' "$1" >&2
  exit 1
}

header_value() {
  printf '%s\n' "$1" | tr -d '\r' | awk -F': ' 'tolower($1)==tolower("'"$2"'") { print substr($0, index($0, ": ")+2); exit }'
}

expect_noindex() {
  local headers="$1"
  local label="$2"
  local tag
  tag="$(header_value "$headers" "x-robots-tag")"
  case "$tag" in
    *noindex*) ;;
    *) fail "$label did not send X-Robots-Tag: noindex" ;;
  esac
}

# Paths the runbook tells Access to bypass, so this check works without a PIN.
for path in /health /ready /robots.txt; do
  headers="$(curl -sS -D - -o /tmp/apex-smoke-body --max-time 30 "${access[@]}" "${os}${path}")"
  status="$(printf '%s\n' "$headers" | awk 'NR==1 { print $2 }')"
  [ "$status" = "200" ] || fail "GET ${os}${path} returned ${status}, expected 200. If this is an Access login, add the bypass for ${path}."
  expect_noindex "$headers" "GET ${os}${path}"
done

curl -fsS --max-time 30 "${access[@]}" "${os}/robots.txt" -o /tmp/apex-smoke-robots
grep -q 'Disallow: /' /tmp/apex-smoke-robots || fail "${os}/robots.txt does not disallow everything"

ready_headers="$(curl -sS -D - -o /tmp/apex-smoke-ready --max-time 30 "${access[@]}" "${os}/ready")"
ready_status="$(printf '%s\n' "$ready_headers" | awk 'NR==1 { print $2 }')"
[ "$ready_status" = "200" ] || fail "GET ${os}/ready returned ${ready_status}"
python3 - <<'PY'
import json,sys
doc=json.load(open("/tmp/apex-smoke-ready"))
if doc.get("status")!="ready" or doc.get("database") is not True or doc.get("evidence") is not True:
    sys.exit("ready payload was not {status:ready, database:true, evidence:true}")
PY

# Staff UI stays behind Access. Without a service token it must not return the app.
app_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "${os}/app")"
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ]; then
  app_headers="$(curl -sS -D - -o /dev/null --max-time 30 "${access[@]}" "${os}/app")"
  app_status="$(printf '%s\n' "$app_headers" | awk 'NR==1 { print $2 }')"
  [ "$app_status" = "200" ] || fail "GET ${os}/app with the Access service token returned ${app_status}"
  expect_noindex "$app_headers" "GET ${os}/app"
else
  [ "$app_status" != "200" ] || fail "GET ${os}/app returned 200 without an Access token. The staff UI must require Access."
fi

web_headers="$(curl -sS -D - -o /tmp/apex-smoke-web --max-time 30 "${access[@]}" "${web}/")"
web_status="$(printf '%s\n' "$web_headers" | awk 'NR==1 { print $2 }')"
if [ "$web_status" = "200" ]; then
  expect_noindex "$web_headers" "GET ${web}/"
  web_robots="$(curl -fsS --max-time 30 "${access[@]}" "${web}/robots.txt")"
  printf '%s\n' "$web_robots" | grep -q 'Disallow: /' || fail "${web}/robots.txt does not disallow everything"
elif [ "$web_status" = "302" ] || [ "$web_status" = "401" ] || [ "$web_status" = "403" ]; then
  [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && fail "website returned ${web_status} even with an Access service token"
  printf 'website is behind Access (HTTP %s). Set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET to also check its robots.txt.\n' "$web_status"
else
  fail "GET ${web}/ returned ${web_status}"
fi

printf 'staging smoke passed\n'
printf '  os  %s\n' "$os"
printf '  web %s\n' "$web"
