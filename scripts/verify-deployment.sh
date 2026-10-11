#!/usr/bin/env bash
# Read-only production smoke check. Browser E2E remains a separate release gate.
set -euo pipefail
app_host="${1:?Usage: verify-deployment.sh production.hostname}"
case "$app_host" in
  ''|*[!a-zA-Z0-9.-]*|.*|*.) echo 'Supply a DNS hostname without scheme, path or port.' >&2; exit 1 ;;
esac
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
origin="https://$app_host"
request() {
  curl --silent --show-error --max-time 15 --retry 3 --retry-delay 2 \
    --dump-header "$scratch/headers" --output "$scratch/body" --write-out '%{http_code}' "$1"
}
require_type() {
  if ! grep -Eqi "^content-type: $1" "$scratch/headers"; then
    echo "Unexpected response content type for $2" >&2; exit 1
  fi
}
for probe in health ready; do
  code="$(request "$origin/api/$probe")"
  [ "$code" = 200 ] || { echo "HTTPS /api/$probe failed: $code" >&2; exit 1; }
  require_type 'application/json' "/api/$probe"
  if [ "$probe" = ready ]; then
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"' "$scratch/body" || { echo 'Database not ready' >&2; exit 1; }
  fi
done
code="$(request "$origin/api/v1/me")"
[ "$code" = 401 ] || { echo "Guest identity endpoint expected 401, received $code" >&2; exit 1; }
require_type 'application/json' '/api/v1/me'
grep -Eqi '^strict-transport-security:' "$scratch/headers" || { echo 'HSTS header missing' >&2; exit 1; }
grep -Eqi '^content-security-policy:' "$scratch/headers" || { echo 'CSP header missing' >&2; exit 1; }
for path in / /teams/release-gate/manage; do
  code="$(request "$origin$path")"
  [ "$code" = 404 ] || { echo "Backend must not serve frontend at $path: $code" >&2; exit 1; }
done
code="$(request "http://$app_host/")"
case "$code" in 301|302|307|308) ;; *) echo "HTTP must redirect to HTTPS: $code" >&2; exit 1 ;; esac
grep -Fqi "location: $origin/" "$scratch/headers" || { echo 'HTTP redirect targets wrong origin' >&2; exit 1; }
printf 'PASS HTTPS certificate, health/DB readiness, API JSON routing, frontend exclusion, security headers, HTTP redirect.\n'
printf 'Next release gate: two-account desktop/mobile browser E2E on separately deployed Vercel frontend.\n'
