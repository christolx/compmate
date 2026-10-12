#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
backup_dir="${BACKUP_DIR:-./backups}"
umask 077
mkdir -p "$backup_dir"
backup_file="$backup_dir/compmate-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
# libpq env keeps credentials out of process arguments.
python3 "$script_dir/postgres-tool.py" DATABASE_URL pg_dump --format=custom --no-owner --no-acl --file="$backup_file"
python3 "$script_dir/postgres-tool.py" DATABASE_URL pg_restore --list "$backup_file" >/dev/null
printf '%s\n' "$backup_file"
