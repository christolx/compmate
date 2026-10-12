#!/usr/bin/env python3
"""Invoke PostgreSQL client with URL split into libpq env, keeping passwords out of argv."""
import os
import subprocess
import sys
from urllib.parse import parse_qsl, unquote, urlsplit

variable, tool, *args = sys.argv[1:]
if variable not in {"DATABASE_URL", "RESTORE_DATABASE_URL"} or tool not in {"pg_dump", "pg_restore", "psql"}:
    sys.exit("Unsupported PostgreSQL command")
try:
    uri = urlsplit(os.environ[variable])
    if uri.scheme not in {"postgres", "postgresql"} or not uri.hostname or not uri.path.strip("/"):
        raise ValueError("Invalid URL")
    env = dict(os.environ, PGHOST=unquote(uri.hostname), PGPORT=str(uri.port or 5432),
               PGUSER=unquote(uri.username or ""), PGPASSWORD=unquote(uri.password or ""),
               PGDATABASE=unquote(uri.path.lstrip("/")))
    mapping = {"sslmode": "PGSSLMODE", "sslrootcert": "PGSSLROOTCERT", "sslcert": "PGSSLCERT",
               "sslkey": "PGSSLKEY", "connect_timeout": "PGCONNECT_TIMEOUT", "options": "PGOPTIONS",
               "application_name": "PGAPPNAME", "target_session_attrs": "PGTARGETSESSIONATTRS",
               "host": "PGHOST", "port": "PGPORT", "user": "PGUSER", "password": "PGPASSWORD",
               "dbname": "PGDATABASE", "channel_binding": "PGCHANNELBINDING"}
    for key, value in parse_qsl(uri.query, keep_blank_values=True):
        if key not in mapping:
            raise ValueError("Unsupported option")
        env[mapping[key]] = value
except (KeyError, ValueError):
    sys.exit("Invalid PostgreSQL URL or unsupported libpq option")
sys.exit(subprocess.run([tool, *args], env=env, check=False).returncode)
