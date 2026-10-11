#!/usr/bin/env bash
set -euo pipefail

# Deploy only backend sources/config. Never copy local .env or DB data.
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
server="${1:-omen}"

ssh "$server" 'sh -s' <<'REMOTE'
set -eu
command -v docker >/dev/null || { echo 'Docker missing. Install Docker Engine + Compose first.' >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null
command -v rsync >/dev/null
command -v openssl >/dev/null
command -v curl >/dev/null
mkdir -p "$HOME/compmate/apps"
REMOTE

rsync -az --exclude bin --exclude .env "$repo_dir/apps/api/" "$server:compmate/apps/api/"
rsync -az "$repo_dir/compose.yaml" "$repo_dir/compose.production.yaml" "$server:compmate/"

ssh "$server" 'sh -s' <<'REMOTE'
set -eu
cd "$HOME/compmate"
umask 077
if [ ! -e .env ]; then
  password=$(openssl rand -hex 32)
  # Noclobber prevents concurrent deploys from replacing initial credentials.
  (set -C; cat > .env <<EOF
POSTGRES_DB=compmate
POSTGRES_USER=compmate
POSTGRES_PASSWORD=$password
POSTGRES_PORT=55432
API_PORT=8080
API_DATABASE_URL=postgres://compmate:$password@db:5432/compmate?sslmode=disable
EOF
  )
  unset password
fi
chmod 600 .env
if grep -Eq 'compmate_dev' .env; then
  echo 'Refusing development credentials. Configure production DB credentials in ~/compmate/.env.' >&2
  exit 1
fi
docker compose -f compose.yaml -f compose.production.yaml up -d --build --wait --wait-timeout 120
api_port=$(docker compose -f compose.yaml -f compose.production.yaml port api 8080)
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 --retry-max-time 30 "http://$api_port/api/ready"
printf '\nBackend deployed. API and DB bind to loopback only.\n'
REMOTE
