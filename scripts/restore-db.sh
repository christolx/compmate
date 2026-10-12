#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a new empty database}"
backup_file="${1:?Usage: restore-db.sh path/to/backup.dump}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
existing_tables="$(python3 "$script_dir/postgres-tool.py" RESTORE_DATABASE_URL psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
if [ "$existing_tables" != 0 ]; then
  echo 'Refusing restoration into nonempty database.' >&2
  exit 1
fi
python3 "$script_dir/postgres-tool.py" RESTORE_DATABASE_URL pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname="" "$backup_file"
python3 "$script_dir/postgres-tool.py" RESTORE_DATABASE_URL psql -X -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS users FROM users; SELECT count(*) AS applications FROM applications; SELECT count(*) AS memberships FROM memberships;'
