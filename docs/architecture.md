# CompMate architecture

Short answer: polyglot monorepo, satu web app + satu Go API + PostgreSQL. Domain correctness jadi slice berikutnya.

## Boundaries

| Location | Owns |
| --- | --- |
| `apps/web` | React UI, routes, view models; prototype fixtures/localStorage sekarang |
| `apps/api/cmd/api` | Process startup, HTTP timeouts, graceful shutdown, DB pool |
| `apps/api/internal/config` | Env config validation |
| `apps/api/internal/httpapi` | HTTP transport; health + DB readiness sekarang |
| Root | npm workspace, Compose, shared dev commands, docs |

Internal feature packages + SQL migrations ditambah saat domain feature masuk. Go module dependencies tetap terpisah dari npm; SQL dimiliki API. API contract versioning + generated web types ditambah bersama endpoint pertama.

## Runtime

```text
Current product data:
web → fixtures/localStorage → selectors/matching → UI

New infra path:
browser /api/* → Vite dev proxy → Go API → pgx pool → PostgreSQL
container API → db:5432
native API → 127.0.0.1:55432

Target domain path:
web command → authenticated API → domain validation → DB transaction
  → response → web state refresh → derived views
```

Go API tidak mengubah fixture state sekarang. `/api/health` cek process; `/api/ready` ping DB dengan timeout. Pool connection failure tidak membunuh HTTP process → readiness gagal sampai DB pulih.

## Decisions

- React/Vite tetap. npm workspace cukup untuk satu JS app; Go module berdiri sendiri.
- Go standard library HTTP + pgx; satu deployable API, modular domain packages saat dibutuhkan.
- PostgreSQL 18 local; named volume mount `/var/lib/postgresql` sesuai [official image docs](https://hub.docker.com/_/postgres).
- Compose local infra; web/native API bisa run di host. Port DB/API bind localhost.
- Root `.env` dibaca Compose. Native API baca process env; `.env.example` + shell export untuk dev. Jangan kirim DB URL ke browser.
- Health endpoints belum menjamin schema/domain siap. Migration runner masuk bersama schema pertama.
- Vercel root build tetap jalan; production `/api` gateway + API hosting belum dikonfigurasi.

## Next slice

1. Define generic profiles/teams/roles/memberships/applications records + API contract.
2. SQL migrations + constraints + domain commands. Acceptance transaction enforce capacity, role seats, satu team/user/competition, competing pending requests withdrawal.
3. Auth/session + authorization tests → register/profile/create/apply/accept end-to-end.
4. Move fixture-backed screens bertahap ke API reads; preserve demo fixtures untuk board/test.

Auth provider masih keputusan terbuka. Infra foundation tidak menetapkan password/session implementation.

## Checks / limits

`make check`: web ESLint/Vitest/TypeScript/Vite build + Go vet/race tests/build. Go tests cover config, DB-independent liveness, DB readiness success/failure.

Verified: `make check` pass; 44 relocated web files byte-identical, web build hashes unchanged. HTTP smoke: deep links/assets 200; Vite → Go health 200, readiness 503 saat DB offline; SIGTERM exit 0. Compose config valid dengan defaults + `.env.example`.

Docker daemon unavailable saat setup (`/var/run/docker.sock` absent). Container build, DB connectivity success, volume persistence, production routing belum diuji. API/domain data tetap belum terhubung.
