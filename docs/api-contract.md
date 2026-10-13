# Team formation API

Base `/api/v1`. JSON requests/responses. Mutations require `Content-Type:
application/json`; strict fields and single JSON document, body limit 32 KiB.
Cookie `compmate_session` is opaque; never read by frontend JavaScript.
Errors `{ "error": "message" }`: 400 validation, 401 login/session, 403 permission,
404 missing/hidden object, 409 domain/duplicate conflict, 429 auth throttling,
500 safe error. Successful commands return `{ "ok": true }` unless noted below.
Request IDs in `X-Request-ID`. Private responses `Cache-Control: no-store`.

| Method/path | Access | Input / response |
| --- | --- | --- |
| POST `/signup` | Public, throttled | `email,password,name` → own profile + cookie |
| POST `/login` | Public, throttled | `email,password` → own profile + cookie |
| POST `/logout` | Any | `{}` → revoke current session |
| GET `/me` | Signed in | Own profile + `id,email,admin` |
| PUT `/profile` | Signed in | `name,campus,skills,availability,about,contact,share_contact,presentation?` → own profile |
| GET `/catalog` | Public | Public profiles + display metadata; no canonical email/contact |
| GET `/preferences` | Signed in | Own saved competitions and connection statuses |
| PUT / DELETE `/saved/:id` | Signed in | `{}` → save/unsave |
| POST / DELETE `/connections/:id` | Signed in | `{}` → request/remove connection |
| POST `/connections/:id/accept` | Recipient | `{}` → accept incoming request |
| GET `/invitations` | Signed in | Own incoming invitations + leader outgoing invitations |
| POST `/teams/:id/invitations` | Leader | `user_id,role_id` → `id`; latest eligibility checked |
| POST `/invitations/:id/accept` | Recipient | `share_contact` → atomic application/membership after recheck |
| POST `/invitations/:id/decline` | Recipient | `{}` → decline |
| POST `/notifications/:id/read` | Owner | `{}` → mark one alert read |
| GET `/competitions` | Public | Published competitions; admin also sees unpublished |
| POST `/competitions` | Admin | Competition fields below → `id` |
| PUT `/competitions/:id` | Admin | Same fields; cannot invalidate existing team sizes |
| GET `/teams?competition=:id` | Public | Teams with roles, public names/roster, `eligible` |
| POST `/teams` | Signed in | Team fields below → `id` |
| GET `/teams/:id` | Public/member/admin | Public team; hidden/unpublished visible to members/admin only |
| PATCH `/teams/:id` | Leader | Optional `name,about,capacity,recruiting,presentation` |
| DELETE `/teams/:id` | Leader | `{}` → cascade roles/applications/memberships/alerts/reports |
| POST `/teams/:id/applications` | Eligible nonmember | `role_id,message,share_contact` → `id` |
| POST `/applications/:id/withdraw` | Applicant | `{}`; pending only, repeated withdrawal idempotent |
| POST `/applications/:id/accept` | Team leader | `{}`; pending + latest eligibility, repeated acceptance idempotent |
| POST `/applications/:id/decline` | Team leader | `{}`; pending only, repeated decline idempotent |
| GET `/dashboard` | Signed in | `teams,applications,inbox,notifications` |
| GET `/teams/:id/contacts` | Current member | `[{id,name,contact}]`; contact null unless both consents enabled |
| POST `/teams/:id/connected` | Member, team has ≥2 members | `{}`; record member outcome confirmation |
| POST `/notifications/read` | Signed in | `{}`; own alerts only |
| POST `/reports` | Signed in | `team_id,reason` |
| GET `/admin/reports` | Admin | Reports with team names, resolution, visibility |
| POST `/admin/reports/:id/resolve` | Admin | `hide_team` boolean; resolve and hide/restore |
| GET `/admin/metrics` | Admin | Formation counts, response time, acceptance rate, funnel |
| GET `/account/export` | Signed in | Own account/profile/applications/memberships/teams/reports/alerts/saved/connections/invitations; no password/session hashes |
| DELETE `/account` | Signed in + password | `password`; must delete owned teams first |
| POST `/client-errors` | Public | `code: "render_failure"`; generic structured error log |

Competition fields: `title,organizer,description,official_url,deadline` (RFC3339),
`min_members,max_members,campus,published`. Official URL must be HTTPS. Campus
blank = unrestricted; otherwise exact campus profile match. Size 2–20 students.

Team fields: `competition_id,name,about,capacity,share_contact,roles,presentation?`.
Role: `name,skills,capacity`. Sum role quantities = capacity − 1. Leader occupies
one seat. Skills are comma-separated labels used for explainable exact matches.

Contact is free-text email/phone/handle, rendered as text. Profile sharing is
global revocation switch. Team consent captured when creating/applying; false
consent cannot silently become true. No guest/applicant/leader-only exception to
membership-based contact access. Applicant contact remains hidden until accepted.

Eligibility implemented once in PostgreSQL `recruitment_eligible` function,
used in projections and mutations. Competition/team locks prevent deadline or
recruitment edits racing acceptance. `statement_timestamp()` evaluates deadline
after lock wait. Applicant row lock serializes membership decisions across teams in same competition;
acceptance withdraws other pending applications for that competition. Team lock serializes seat allocation; DB trigger also enforces
team/role seat limits for other writers. Application status and role occupancy
are derived from same transaction/records. Failed commands roll back alerts,
events and membership updates too.

In-app alerts only; no email notification claim. No password reset, email
verification, chat or automated scraping workflow in this MVP. Invitations use
recipient acceptance and same eligibility/contact rules as applications.
Pilot onboarding must provide operator support for account recovery.
