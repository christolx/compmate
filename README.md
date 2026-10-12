# CompMate

Find competitions, form teams, connect. React/TypeScript + Go + PostgreSQL.
Product routes use real accounts and server records. Historical sample design
board remains available only in Vite development at `/board`.

## Run locally

Requires Node.js 24+, Go 1.26+, PostgreSQL 18 (or Docker Compose).

```sh
npm ci
cp .env.example .env
make db
set -a
. ./.env
set +a
make api
```

For existing native PostgreSQL, skip `make db` and set `DATABASE_URL` to that
DB before `make api`. Keep `PUBLIC_ORIGIN=http://127.0.0.1:5173` for this frontend.

Current local verification also supports a persistent native PostgreSQL cluster
at `.local/postgres` (ignored by Git). If using that cluster after a restart:

```sh
pg_ctl -D .local/postgres -l .local/postgres.log -o "-h 127.0.0.1 -k $PWD/.local -p 55432" start
set -a
. ./.env
set +a
make api
```

Stop native DB with `pg_ctl -D .local/postgres stop` before switching to Docker
on the same DB port. Both options use PostgreSQL and the same Go API/migrations.

In another terminal:

```sh
npm run dev --workspace @compmate/web -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to Go on port 8080.
`PUBLIC_ORIGIN` must match browser origin; `.env.example` uses this address.
Migrations run transactionally at API startup, protected by a DB advisory lock.
DB credentials stay server-side. No competition fixtures ship as real events.

Sign up first, then promote a trusted curator with supported operator CLI:

```sh
cd apps/api
# With DATABASE_URL loaded:
go run ./cmd/api -promote-admin curator@your-campus.edu
```

Refresh browser. Admin can add competitions with verified official HTTPS links,
real deadlines, campus restrictions and team-size limits. Nobody gets admin
permissions from claiming an email address alone.

## Complete journey

1. Two students sign up separately, fill profiles and private contacts.
2. Leader creates team under a competition, sets capacity and open roles.
   Role seats must equal team capacity minus leader's seat.
3. Applicant selects role, sends message, optionally consents to contact sharing.
4. Leader accepts/declines through dashboard inbox. Applicant can withdraw while
   pending. One application per team; withdrawal/decline are final.
5. Accepted user joins roster. Both dashboards derive from same DB records.
6. Contacts appear only to team members when **both** profile sharing and
   team-specific consent are enabled. Revoking profile sharing blocks future reads.
7. Both members confirm “We connected” to record actual formation outcome.

Recruitment can be closed/reopened. Closed/full/expired/unpublished/hidden teams
or filled roles reject application/acceptance. Campus eligibility uses exact
profile campus. Accepted memberships cannot withdraw; account deletion or team
deletion removes membership. Account deletion requires password, blocked while
leading teams. Leader can explicitly delete team after typing its name.

Applications are atomic: competition lock → team lock → application lock →
latest eligibility → membership + decision + alert → commit. Unique application
and membership constraints plus DB seat trigger protect duplicates/capacity.
Repeated same decision is idempotent. Other transitions reject with `409`.

## Routes and API

| Route | Screen |
| --- | --- |
| `/`, `/competitions` | Curated competition discovery/search |
| `/competitions/:id` | Details, eligibility-first skill recommendations, teams |
| `/signup`, `/login` | Real signup/login |
| `/for-you` | Teams, applications, leader inbox, in-app alerts |
| `/teams/new` | Create team with role quantities |
| `/teams/:id`, `/teams/:id/manage` | Roster, application, recruitment, contacts/report |
| `/u/me` | Edit profile, revoke consent, export/delete account |
| `/admin` | Competition curation, reporting/moderation, pilot metrics |
| `/privacy` | Data visibility and deletion policy |

See [API contract](docs/api-contract.md). Sessions: random opaque cookie,
server stores hash, seven-day expiry, HttpOnly, SameSite=Lax; Secure in production.
Passwords use bcrypt. JSON-only mutations + Origin checks prevent browser CSRF.
Login/signup are limited to 20 attempts per remote IP per minute in each process.
Behind Caddy, limit applies to proxy IP; increase/replace with trusted edge rate
limiting before expanding pilot. Forwarded headers are not trusted automatically.

Alerts refresh every 30s, or immediately after action/manual refresh. Application
messages visible only to applicant and leader. Public teams expose no contacts
or account emails. Contacts already viewed can be retained by recipients.

## Verify

```sh
make check                   # Web lint/tests/build; Go vet/race tests/build
# Real PostgreSQL integration (isolated schemas, cleaned automatically):
TEST_DATABASE_URL="$DATABASE_URL" make check
agent-browser install        # Install browser after installing agent-browser 0.27.0
# Keep API/web running; use disposable DB:
npm run test:e2e
```

E2E requires `agent-browser` on PATH (`npm install -g agent-browser@0.27.0`).
It creates disposable curator/student accounts and competitions through UI,
promotes curator through operator CLI using `DATABASE_URL`, exercises desktop
and 390px mobile journeys, revocation, network failure, logout/login, keyboard
focus and layout. Outputs screenshots/snapshots to `e2e-results/`.
For staging, provide `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` for a
preconfigured test admin; no automatic remote privilege bootstrap. Tests create
visible fixtures; run only on designated test deployments.

CI runs `make check` with PostgreSQL, E2E, backup restoration; uploads browser
artifacts. Go integration tests skip explicitly if `TEST_DATABASE_URL` absent.

## Production

Intended deployment: **backend only on the production server; frontend deployed
separately via Vercel**. Production Compose runs PostgreSQL, Go API and an API-only
Caddy HTTPS proxy. No frontend source, npm dependencies or static build is copied
or built by the backend deploy script. Non-API paths on the backend return 404.

Point backend DNS at the server; allow ports 80/443. API/DB direct ports remain
loopback-only. Configure server `~/compmate/.env` with:

```dotenv
APP_HOST=api.your-campus.example
PUBLIC_ORIGIN=https://compmate.vercel.app
```

`APP_HOST` is the backend hostname. `PUBLIC_ORIGIN` must exactly match the frontend
browser origin (scheme + hostname, no path or trailing slash), including when
using a custom Vercel domain. Production sets Secure cookies.

```sh
bash scripts/deploy-backend.sh omen
```

First run initializes private DB credentials, then stops until operator sets
`APP_HOST` and `PUBLIC_ORIGIN`. Later runs preserve credentials and DB volume.
Existing DB deployments must use credentials matching their initialized DB.
The script removes obsolete Compose containers, including the former frontend
`web` service, without deleting DB volumes. It verifies certificate, HTTPS/HTTP
redirect, API JSON routing, readiness, security headers and frontend exclusion:

```sh
bash scripts/verify-deployment.sh your-backend-hostname
```

Deploy the frontend separately on Vercel. With repository root selected, root
`vercel.json` builds via `npm run build` and outputs `apps/web/dist`. With
`apps/web` selected, its config outputs `dist`. In whichever config Vercel uses,
add this rewrite **before** the existing SPA fallback, replacing the hostname
with the actual backend HTTPS domain:

```json
{ "source": "/api/:path*", "destination": "https://api.your-campus.example/api/:path*" }
```

Frontend requests keep using `/api`; Vercel proxies them to the backend so auth
cookies remain on the frontend origin. Vite's `API_PROXY_TARGET` only applies in
development. Verify frontend deep links and login through the Vercel domain.
Two-account desktop/mobile browser E2E on that frontend remains a separate release
gate. Do not delete database volume. Back up before deployment/migrations.
After curator signup through the frontend, promote on the backend server:

```sh
docker compose -f compose.yaml -f compose.production.yaml exec api /api -promote-admin curator@your-campus.edu
```

## Backups and monitoring

```sh
DATABASE_URL='…' BACKUP_DIR=/secure/backups bash scripts/backup-db.sh
# New empty DB only; refuses any existing user tables:
RESTORE_DATABASE_URL='…' bash scripts/restore-db.sh /secure/backups/compmate-….dump
```

Requires Python 3 and matching PostgreSQL client version. Backups use private files; restore
runs transactionally. Store encrypted/off-host copies with defined retention,
exclude backups from Git. [Pilot runbook](docs/pilot-runbook.md) covers restore drill.

`/api/health` reports liveness; `/api/ready` pings DB. API emits structured JSON
logs for server/client render failures with request IDs, route pattern and status.
No request bodies, cookies, email or contacts are logged. Connect health probes
and error logs to hosting alert system before live pilot; no external monitoring
account is bundled.

Live pilot, official competition validation, production DNS/HTTPS smoke test and
real-student outcomes remain operator release gates. See runbook for proposed
numeric targets, onboarding and outcome review.
