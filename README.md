# CompMate

**Competition Teammate.** Find competitions, discover teammates, build your team.
Each competition has its own team board. Teams list open roles; recommendations
explain why competitions and people fit.

CompMate is a monorepo with a React/TypeScript web prototype, a Go API foundation,
and a local PostgreSQL stack. Product flows use sample data and browser storage.
The API currently exposes health and readiness endpoints only.

## Quick start

Requires Node.js and npm. Run commands from the repository root.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The web prototype runs independently of the
API and database.

Use the **Prototype** control at the bottom left to sign the sample user in or
out, reset demo state, or preview a 390px phone frame on wider screens.

## Prototype behavior

- Fictional sample data lives in `apps/web/src/data/seed.ts`. The demo date is
  fixed at **6 October 2026** to keep deadlines and countdowns stable.
- Sign-in is simulated. Saved competitions, applications, connections, and the
  Vertex roster persist in browser `localStorage` under `compmate-v2`.
- Saved state is versioned and checked on load; entries that no longer match
  the sample data are dropped. If a page still fails to render, a recovery
  screen offers **Reset demo data**.
- Screens use the mobile layout below 1024px.
- Vertex is the team led by the sample user. Team management and role-based
  people rankings use this team.

## Routes

| Route | Screen |
| --- | --- |
| `/` | Discover; signed-in users redirect to For you |
| `/for-you` | For you: actions, then recommendations |
| `/competitions` | Explore; `?q=` searches, `?cat=` filters by category |
| `/competitions/:id` | Competition detail and Find your team board |
| `/teams/:id` | Team detail |
| `/teams/vertex/manage` | Manage Vertex |
| `/people` | Discover people; `?rank=vertex` ranks for Vertex's open roles |
| `/u/:id` | Profile; `/u/me` shows the sample user |
| `/saved` | Saved competitions |
| `/board` | Presentation design board; unlinked from the app |

For you, team management, people, profiles, and saved competitions require
simulated sign-in.

## Repository structure

```text
apps/web/       React, TypeScript, Vite; web package and configs
apps/api/       Go module; cmd/api, internal/config, internal/httpapi
compose.yaml    Local PostgreSQL and API containers
Makefile        Web and Go development/check commands
docs/           Architecture and high-impact audit
```

npm workspaces manage web dependencies. Go manages API dependencies separately.
Root npm scripts target `apps/web`.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run web data and matching tests |
| `npm run lint` | Lint web code |
| `npm run typecheck` | Check TypeScript |
| `npm run build` | Type-check and build the web app into `apps/web/dist/` |
| `npm run preview` | Preview the built web app locally |
| `make check` | Run web lint/tests/build and Go vet/race tests/build |

`make check` requires Go 1.26+ and Make in addition to Node.js and npm. The Go
build outputs `apps/api/bin/api`.

## Local API and database

Requires Docker Engine with Compose. Keep Docker running. Make provides
convenience commands; native API development also requires Go 1.26+.

### Container stack

```sh
cp .env.example .env
make stack
```

In a separate terminal, start the web app:

```sh
npm run dev
```

Vite proxies `/api` requests to the Go API during development. Check endpoints:

```sh
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/ready
```

| Endpoint | Result |
| --- | --- |
| `GET /api/health` | `200` while the API process runs |
| `GET /api/ready` | `200` after a successful DB ping; `503` when DB is unavailable |

`make stack` waits for database health and API container startup. Use
`/api/ready` to confirm the API can reach PostgreSQL. Responses omit DB
connection details. No domain schema or migrations exist yet; readiness checks
connectivity only.

### Native Go development

Start PostgreSQL, load the local environment, then run the API:

```sh
make db
set -a
. ./.env
set +a
make api
```

Stop with Ctrl+C; restart after Go edits. Run either the native API or the API
container on port 8080. When switching from the container, stop it first:

```sh
docker compose stop api
```

### Configuration and cleanup

- Compose reads the root `.env`. Defaults are for local development.
- PostgreSQL binds to `127.0.0.1:55432`; its container port is `5432`. The API
  binds to `127.0.0.1:8080` by default.
- Keep DB credentials, `API_DATABASE_URL` (container), and `DATABASE_URL`
  (native API) in sync. Percent-encode credentials in connection URLs.
- If changing the API port, update `API_PROXY_TARGET` and the relevant setting:
  `API_PORT` for Compose, `HTTP_ADDR` for the native API. Compose sets its
  internal HTTP address independently.
- Frontend code needs no DB credentials. The Vite proxy applies only in dev.

```sh
make down   # Stop containers; preserve the database volume
```

Changing DB credentials in `.env` does not change credentials in an initialized
PostgreSQL volume. Update existing DB credentials explicitly, or use a separate
Compose project/volume for fresh disposable data.

## Deployment

The web app uses a static Vite build on Vercel. Root `vercel.json` runs
`npm run build`, serves `apps/web/dist`, and rewrites all paths to `index.html`
so nested routes support direct links and refreshes.

The Go API requires separate container hosting and a same-origin `/api` gateway
before production integration. The current Vercel configuration serves the web
SPA only; it does not route requests to Go.

## Further reading

- [Architecture](docs/architecture.md)
- [High-impact audit](docs/high-impact-audit.md)
- [MVP product requirements](CompMate_MVP_PRD.md)
