# CompMate

**CompMate — Competition Teammate.** Find competitions and build your team: every
competition has its own team board, teams list the exact roles they need, and
recommendations explain why they fit.

Polyglot monorepo: React/Vite web prototype + Go API foundation + PostgreSQL local stack. Core product data still lives in frontend fixtures/localStorage; API currently provides health/readiness only.

```sh
npm ci
npm run dev        # local dev server
npm test           # data and matching rules
npm run lint
npm run typecheck
npm run build      # production build in apps/web/dist/
```

## Routes

| Route | Screen |
| --- | --- |
| `/` | Discover (logged out). Signed-in users go to For you |
| `/for-you` | For you: actions first, then recommendations |
| `/competitions` | Explore (`?q=` search, `?cat=` category) |
| `/competitions/:id` | Competition detail with the "Find your team" board |
| `/teams/:id` | Team detail |
| `/teams/vertex/manage` | Team management for Vertex, the team the sample user leads |
| `/people` | Discover people (`?rank=vertex` ranks for Vertex's open roles) |
| `/u/:id` | Profile (`/u/me` for the sample user) |
| `/saved` | Saved competitions |
| `/board` | Design board for presentations (not linked from the app) |

## How the prototype works

- All data is fictional sample data in `apps/web/src/data/seed.ts`, pinned to 6 October 2026
  so deadlines and countdowns stay stable.
- There is no backend. Sign-in is simulated, and app state (saved competitions,
  applications, connections, the Vertex roster) is kept in the browser's
  `localStorage` under `compmate-v2`.
- The **Prototype** pill at the bottom left signs the sample user in or out,
  resets the demo, and on wide screens previews the app in a 390px phone frame.
- Screens switch to their mobile layout below 1024px.

## Structure

```text
apps/web/       React, TypeScript, Vite; own package/configs
apps/api/       Go module; cmd/api + internal/config + internal/httpapi
compose.yaml    Local PostgreSQL + API container
Makefile        Cross-language dev/check commands
docs/           Architecture + high-impact audit
```

npm workspace manages web dependencies; Go manages API dependencies separately. Root npm commands still work. No shared runtime or frontend framework migration.

## Local stack

Requires Node/npm, Go 1.26+, Docker Engine + Compose, Make for convenience.

```sh
cp .env.example .env
make stack                     # PostgreSQL + built API container
npm run dev                    # separate terminal; Vite proxies /api to API
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/ready
```

Docker must be running. Compose loads root `.env`; credentials are local dev defaults. Keep DB credentials and both connection URLs in sync. Percent-encode credentials in URLs. PostgreSQL binds localhost:55432 (container stays on 5432); API binds localhost:8080. `make stack` waits for DB health + API process startup; check `/api/ready` to verify API DB connectivity.

For native Go iteration, run DB only, then load local env in API terminal:

```sh
make db
set -a
. ./.env
set +a
make api                       # Ctrl+C stops API; restart after Go edits
```

Choose native API or API container on port 8080. Stop container first with `docker compose stop api` when switching. If changing API port, update `HTTP_ADDR` and `API_PROXY_TARGET` accordingly. Compose sets container HTTP address independently.

`GET /api/health` → 200 while process runs. `GET /api/ready` → 200 after DB ping, 503 if unavailable. Responses omit DB connection details. Frontend needs no DB credentials; Vite proxy is dev-only.

```sh
make check                     # web lint/test/build + Go vet/race tests/build
make down                      # stop containers; DB volume survives
```

Go binary: `apps/api/bin/api`. DB schema/domain migrations belong in API once first domain slice lands. No schema or migrations yet; readiness proves connectivity only. After changing DB user/password in `.env`, existing initialized DB volume keeps old credentials; update DB credentials explicitly or use a separate Compose project/volume for fresh disposable data.

See [architecture](docs/architecture.md) and [high-impact audit](docs/high-impact-audit.md).

## Deployment

Web deployment uses Vercel static Vite build; root `vercel.json` sets `apps/web/dist` output. `vercel.json` rewrites every path to
`index.html` so deep links and refreshes on nested routes work.

Go API needs separate container hosting and a same-origin `/api` gateway before production integration. Current Vercel rewrite serves web SPA only; it does not route to Go.
