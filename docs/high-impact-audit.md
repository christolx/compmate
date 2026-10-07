# CompMate — High-impact audit

Short answer: UI discovery sudah kuat. Big returns berikutnya: domain rules, data konsisten, identity nyata, core loop selesai. Register page harus nyambung ke fondasi ini.

Audit: 7 Oct 2026. Scope: seluruh screen/component, routing, store, seed/model/matching, design board, PRD, build config, tests. Source trace + runtime probes; browser interaction belum diuji. Ini audit, belum fix app.

## Data bergerak sekarang

```text
seed.ts: PEOPLE / COMPETITIONS / TEAMS / TODAY / NOTIFICATIONS
  → model.ts: PERSONS + competition cache + team(state)
  → matching.ts: scores / recommendations
  → screens + cards

localStorage[compmate-v2]
  → shallow merge defaultState()
  → createPersistentStore()
  → StoreContext → useSyncExternalStore → screens

click / form
  → useNav() → AppShell switch → auth gate / overlay / store.set()
  → localStorage write + subscriber update
  → team views + recommendations recompute

exception: Manage.tsx langsung store.set(vx)
URL → AppRoutes → screen; search/filter edits mostly local component state
/board → static store + inert navigation; fixture/demo mode
```

**Belum ada API, DB, real session, multi-user sync.** Data publik statis; state browser milik satu sample user. Logout cuma ubah `authed`, data tetap. Fine buat demo; belum cukup buat akun nyata.

| Journey | Hasil nyata sekarang | Putus di mana |
| --- | --- | --- |
| Discover → detail → save | ID masuk `saved`, reload persist | Reminder hanya copy, belum delivery |
| Apply → login → send | Boolean auth; `apps[teamId] = role/status/when` | Message + sharing choice hilang; leader inbox terpisah |
| Leader accept | `vx.apps` status + `vx.added` + `vx.filled` | Capacity tak dicek; withdrawal lintas team/contact/notification belum terjadi |
| Invite → join | `invites[personId] = team/role` | Tak ada recipient accept/decline → membership |
| Register / edit profile / create team / official registration | Login simulasi atau toast | Core onboarding + team creation + external handoff belum selesai |

## Big returns, urutan prioritas

### 1. P0 — Satu jalur command untuk apply/accept/invite

**Evidence:** `AppShell.tsx` case `applied` langsung write tanpa validasi. `ApplyOverlay` tak pass `block`; validasi `ApplySheet` tersedia buat preview, belum terhubung live. `Manage.tsx` accept langsung concat member/filled role. Primary CTA `Team.tsx` bisa tetap aktif ketika full/closed selama roles ada.

**Skenario konkret:** turunkan Vertex target dari 5 → 3. Team sudah complete, dua pending applicants masih bisa di-accept → 5 anggota / target 3. `team()` tetap punya dua open roles saat target 3.

**Fix:** domain commands `apply`, `accept`, `decline`, `invite`; UI cuma request. Cek current state saat commit: actor permission, pending status, role seats, recruitment/deadline, capacity ≤ target ≤ competition max, satu membership per competition. Acceptance atomik → member + assigned role + request status + competing pending requests withdrawn. Server nanti enforce rules sama.

**Done:** full/closed/expired/duplicate action ditolak dengan alasan; double accept tak nambah member; gagal commit tak tampil success.

### 2. P0 — Satukan application, membership, dashboard data

**Evidence:** outgoing `apps` berbeda dari incoming `vx.apps`; payload send tak bawa `msg` / `shareLinkedIn`. `team()` punya special cases Vertex/Apex; `ForYou` hardcode teams/actions Orion/Nadia. `invites` keyed person → invite kedua bisa overwrite invite team lain. Member role ditampilkan dari preferred role, bukan assignment.

**Fix:** collections umum: `profiles`, `teams`, `teamRoles`, `memberships`, `applications`, `invites`, keyed ID. Application simpan applicant/team/role/message/sharing/status/timestamps. Semua inbox/dashboard/counts derive dari records sama; batasi public/private field sesuai permission.

**Done:** apply muncul di applicant dashboard + leader inbox; acceptance muncul di roster + profile + dashboard; pesan/sharing choice survive reload. Tak perlu special case nama team.

### 3. P1 — Real identity + profile onboarding sebelum register dianggap selesai

**Evidence:** `LoginOverlay` input read-only; Continue, email code, Create account semuanya panggil login sama. Identity selalu `PERSONS.me`; profile editing + team creation cuma toast. Semua profile claim “verified student” tanpa verification flow.

**Fix:** auth/session adapter + `currentUserId`; empty state akun baru terpisah demo fixture. Register → minimal profile (roles/skills/interests/availability) → lanjut intended action. Pertahankan team/role tujuan setelah auth. Buat create/edit profile + create team memakai collections dari #2. Verification badge hanya berdasar status nyata.

**Done:** akun baru tidak mewarisi Vertex/Orion/connections Maya; dua user punya data berbeda; refresh/session expiry/logout benar; browse publik tetap tersedia.

### 4. P1 — Shared eligibility selector + clock untuk discovery/matching

**Evidence:** `TODAY` fixed 6 Oct 2026; competition cache + `ALL_COMPETITIONS` dihitung sekali. Expired competition punya status `open`; deadline filters hanya upper bound. `teamsForMe` tak cek full/closed/deadline, semua application status mengecualikan team. `Competition` filter open roles + !closed, tanpa !complete. Counts seed tak mengikuti roster; Explore sort “rec” pakai featured/count, bukan matching.

**Fix:** selector `canApply` / `isRecruiting` / competition status dipakai detail, boards, matching, counts. Inject clock: fixed di demo/test, tanggal bisnis di live. Derive stats dari dataset sama; expose aggregate server bila pagination. Ranking setelah eligibility filter; tetapkan kebijakan reapply untuk declined/withdrawn.

**Done:** closed/full/expired tak direkomendasikan; countdown benar setelah tanggal berubah; board/cards/counts sepakat. Runtime probe: withdrawn Apex sekarang hilang dari recommendations; full Vertex masih punya open roles.

### 5. P1 — Validasi persisted state sebelum render

**Evidence:** store cuma JSON.parse + shallow merge. Runtime probe `vx: {}` → crash `Cannot read properties of undefined (reading 'includes')`; saved ID yang sudah hilang → crash `Cannot read properties of undefined (reading 'deadline')`.

**Fix:** schema version + migration/validation; drop dangling IDs; recover invalid nested state. Guard missing entity di selectors. Per-user persistence; session punya lifecycle sendiri. Tambah render error fallback buat recovery.

**Done:** corrupt JSON, valid JSON wrong shape, removed IDs, old schema → app tetap buka; user dapat reset/recover.

### 6. P1 — Selesaikan handoff, buang false-success copy

**Evidence:** `official` cuma toast, Share team cuma “Team link copied”, profile links berupa spans. Acceptance copy menjanjikan Discord invite/withdrawal/notification yang belum dilakukan. Notifications statis; saved copy menjanjikan reminder.

**Fix:** official URL HTTPS tervalidasi → anchor; share → Clipboard API + error fallback. Simpan contact URL team, hanya tampil ke member berhak. Generate notification dari event nyata, atau label demo/adjust copy sampai feature selesai. Invite harus punya accept/decline bila masuk MVP.

**Done:** user bisa lanjut ke organizer + komunikasi team; success hanya setelah action benar-benar berhasil.

### 7. P1 — Tests untuk core loop, bukan hanya design parity

**Evidence:** 8 tests di `parity.test.ts` pin outputs fixture; tak execute store commands, auth gates, forms, persistence recovery, capacity checks.

**Fix:** pertahankan parity; tambah domain transition tests + satu browser journey dua user: register/profile → create team → apply(message) → leader accept → member/contact/dashboard. Cover full team, duplicate accept, competing requests, expired competition, reload, failed request, auth return target. CI: lint + test + build.

**Done:** perubahan domain gagal CI saat invariant rusak. Browser journey lulus mobile + desktop.

## Development order

1. Domain records + commands (#1–2), invariant tests (#7).
2. State migration + shared eligibility/clock (#4–5).
3. Session + register/profile + create team (#3); lanjut core-loop integration.
4. Official/contact/share handoff (#6); browser journey (#7).

Keep React/Vite + deterministic matching. Framework rewrite, AI matching, visual redesign, social expansion ditunda. PRD stack masih Next.js/Go/Supabase, repo React/Vite; update PRD ke satu keputusan arsitektur sebelum backend work.

## Verification

- `npm test`: **8/8 pass**. `npm run lint`: **pass**. `npm run build`: **pass**, termasuk TypeScript build.
- Runtime probes via Vite SSR: incomplete persisted state crash; dangling saved ID crash; full team masih punya open roles; withdrawn application excluded from recommendations.
- Passing checks membuktikan baseline compile/parity; belum membuktikan core flow benar. Temuan auth/backend adalah batas prototype saat ini.
