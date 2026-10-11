# CompMate MVP Development Plan

**Short answer:** Ship real team formation: signup → create team → apply → accept → contact. Keep current stack. Expand after pilot evidence.

## Goal

Two real students form a team without simulated actions or manual DB changes. Both see consistent application and membership data after refresh.

Basis: [MVP review](compmate-app-mvp-review.md). Confirm current implementation before starting; review covers a specific source snapshot.

## Development phases

| Phase | Scope | Done when |
|---|---|---|
| **1. Identity + shared data** | Real signup/login/logout; editable profiles; migrations for users, profiles, competitions, teams, roles, applications, memberships; API contracts; server authorization | Two accounts retain separate identities. Data persists. Unauthorized reads/writes fail. |
| **2. Complete team flow** | Create team with roles/capacity; recruitment controls; apply with message and contact-sharing consent; withdraw; leader accept/decline; member-only contact access | Two users complete full journey. Applicant dashboard, leader inbox, roster agree after refresh. |
| **3. Reliable behavior** | Shared eligibility rules; live deadlines; atomic acceptance; duplicate prevention; role/capacity limits; explicit withdrawal policy; real success/error feedback | Full/closed/expired teams reject applications. Concurrent acceptance cannot exceed capacity. Failed actions leave consistent data. |
| **4. Pilot readiness** | Admin-curated competitions with official links; basic application alerts; reporting/moderation; account-data controls; production API routing/HTTPS; CI; error monitoring; tested backups | Desktop/mobile journey passes. Private contacts stay private. Deployment and backup restoration verified. |
| **5. Focused pilot** | One campus cohort; small set of actively recruiting competitions; onboarding; outcome tracking | Observe actual team formation, document friction, prioritize next fixes from evidence. |

**Sequence:** 1 → 2 → 3 → 4 → 5. Add core authorization and capacity checks with each feature; phase 3 closes gaps and tests failure paths.

## Implementation rules

- One shared application record drives applicant view and leader inbox.
- Generic teams/users replace Vertex/Apex special cases.
- Server enforces permissions and recruitment rules on every relevant request.
- Acceptance updates application, membership, role occupancy atomically.
- Contact access follows membership and sharing consent.
- Filter eligibility before ranking; retain explainable rule-based matching.
- Success messages reflect committed actions. Remove promises for missing features.

## Validation + release gate

- Preserve existing checks; run `make check` in CI.
- Add domain, DB integration, authorization, two-user browser tests.
- Test duplicate requests, last-seat concurrent acceptance, expired/full teams, withdrawal, session expiry, network failure.
- Verify complete journey on desktop/mobile, modal keyboard behavior, contact privacy, backup restoration.
- Release gate: two real accounts complete signup → create → apply → accept → contact on deployed app.

## Pilot metrics

| Metric | What it reveals |
|---|---|
| Teams with accepted members who actually connect | Core product outcome |
| Applications per recruiting team | Recruitment density |
| Leader response time | Recruitment friction |
| Acceptance rate | Applicant/team fit |
| Journey drop-off | Next highest-impact fix |

Set numeric targets before pilot. Evaluate signup counts alongside formation outcomes.

## Defer

AI matching, built-in chat, automated scraping, organizer portals, connection graphs, skill verification, monetization, invitations without complete recipient flow.

**Next deliverable:** Phases 1–2 as one Team Formation MVP milestone, followed by correctness and pilot release checks.
