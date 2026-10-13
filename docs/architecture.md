# Architecture

Product: React/TypeScript + Vite, Go HTTP API, PostgreSQL. Server owns identities,
profiles, competitions, teams, roles, applications, memberships, notifications,
reports and outcome events. Browser contains presentation state and an HttpOnly
session cookie; browser localStorage is not authoritative product data.

Original `AppShell`, routes, screens, cards and weighted matching remain product
frontend. `LiveFrontend` supplies API-backed store; `store/apiStore.ts` maps
canonical API records into original view models. Signed-in user aliases to `me`
for UI only; API IDs remain actual identities. No product localStorage/demo data
fallback. New forms use existing typography, colors and responsive shell.
`apps/api/internal/formation` owns versioned API, authorization, migrations,
transactional commands and original catalog default seed. Presentation JSON
preserves original rich metadata alongside canonical DB fields. One-time local
seed never overwrites edited profiles/statuses or resurrects deleted records;
production disables seed. `/board` retains static development design reference.

Migrations embedded into API binary run under advisory transaction lock. Passwords
bcrypt; session token random 192-bit, stored as SHA-256 hash with seven-day expiry.
Admin promotion uses operator CLI against existing account; no public admin signup.

Application uniqueness `(team_id,user_id)`; membership uniqueness same keys.
Composite role/team foreign keys prevent cross-team role selection. Team-row locks
serialize acceptance, DB trigger prevents membership seat overflow. Accept locks applicant before competition/team/application locks, serializing
same-competition membership. Competition locks order before team locks, coordinating eligibility edits. Shared SQL function
supplies eligibility to display and apply/accept. Contacts have separate authorized
projection; never included in public team/dashboard data.

Read/write errors surface without success notices. API structured ERROR logs and
client render-failure reports contain request IDs and generic codes. Time-bounded
DB requests and health/readiness endpoints support hosting probes.

Development: Vite `/api` proxy. Production frontend deploys separately via Vercel,
with SPA fallback and `/api/:path*` HTTPS rewrite to the backend. Backend-only
Compose runs PostgreSQL, Go API and Caddy HTTPS → `/api/*` reverse proxy; all other
paths return 404. PostgreSQL/API direct ports loopback. Backend `PUBLIC_ORIGIN`
matches the Vercel frontend origin so proxied browser mutations pass origin checks.
DB backup/restore scripts and PostgreSQL integration + two-user browser tests are
release checks. See API contract and pilot runbook for operational limits.
