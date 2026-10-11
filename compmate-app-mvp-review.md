**Verdict:** CompMate has substantial prototype UI, but not a working multi-user MVP. Keep the current stack. Prioritize real accounts, shared application records, and reliable team formation - not more screens. [Source][readme]

# CompMate - App & MVP Review

**Scope:** `christolx/compmate`, `master@f5a3831`. Reviewed core screens, routing, state, matching, API, deployment, and tests through GitHub. **Source review only; builds, browser flows, and live deployment were not tested.** [Snapshot][snapshot]

## 1. Current state

| Area | Assessment |
|---|---|
| **Product structure** | Public competition discovery, competition-specific team boards, profiles, and dashboards align with the PRD's core journey. [Source][prd] |
| **Frontend foundation** | Routing, auth-return navigation, explainable matching, and versioned storage recovery are implemented. These are worth retaining. [Routing][routes] / [Matching][matching] / [Storage][persisted] |
| **Backend foundation** | Go exposes only health/readiness endpoints. Real authentication, domain endpoints, and schema migrations remain unimplemented. [Router][router] / [Architecture][architecture] |
| **Main architectural debt** | Product behavior assumes one sample user and special-cases Vertex/Apex. This needs domain-model work, not merely replacing localStorage calls with HTTP requests. [State][state] / [Model][model] |

## 2. Happy-path feasibility

**Intended journey:** discover competition -> find/create team -> apply -> leader accepts -> members connect.

| Step | What currently happens | Verdict |
|---|---|---|
| Discover competitions and teams | Search, filters, details, and recommendations operate on fixtures. | **Demonstrable**, not live discovery. [Source][explore] |
| Register and build a profile | Login uses read-only sample credentials; profile editing shows a toast. | **Blocked for new users.** [Login][overlays] / [Profile][profile] |
| Create a team | The action explicitly says creation belongs to the next round. | **Blocked.** [Source][shell] |
| Submit an application | A local record is created, but the message and sharing preference are omitted. | **Partial simulation.** [Source][apply] |
| Leader reviews and accepts | Vertex reviews a separate seeded inbox; acceptance directly modifies its local roster. | **Not a connected two-user flow.** [Source][manage] |
| Contact members and register | Acceptance promises contact access without delivering it; official registration only displays a toast. | **Handoff remains blocked.** [Acceptance][manage] / [Registration][shell] |

**Conclusion:** Individual interactions demonstrate the concept. Neither the applicant journey nor the team-creator journey currently completes end to end.

## 3. Highest-impact findings

### P0 - Applications and memberships need one authoritative model

Outgoing applications live in `apps[teamId]`; incoming applications live in `vx.apps`. Dashboard membership also contains explicit Vertex/Apex logic. Consequently, submitting an application does not create the record another real user would review. [State][state] / [Dashboard][for-you]

**Fix:** Use generic users, profiles, competitions, teams, roles, applications, and memberships. Store applicant/team/role IDs, message, consent, status, and timestamps. Derive both inboxes, rosters, and dashboards from those records.

### P0 - Capacity and application rules are bypassable

`Team.tsx` calculates `canApply`, but its primary CTA uses different logic that omits full/closed checks. `Manage.tsx` accepts applicants without rechecking capacity or pending status. **Source-derived failure path:** lower Vertex's target to its current roster size, then accept another applicant - the handler still appends that person. [Team][team] / [Management][manage]

**Fix:** Centralize `apply`, `accept`, `decline`, and `withdraw` commands. Acceptance must atomically validate the latest state and update application, membership, and role occupancy. Use transaction-level locking and database constraints; frontend checks alone cannot protect concurrent operations. [PostgreSQL locking documentation][postgres-locking]

### P1 - Eligibility and ranking disagree

Recommendations do not consistently exclude closed/full teams. Competition status has no expired state; deadline filters accept negative days remaining. The demo clock is intentionally fixed at **6 October 2026**. [Matching][matching] / [Model][model] / [Filters][explore] / [Demo behavior][readme]

**Fix:** Share eligibility rules across cards, boards, recommendations, and mutations. Filter eligibility **before** ranking. Introduce explicit deadline states and a live clock outside demo/test mode.

### P1 - Success messages overstate completed actions

Saving promises reminders; sharing says "copied" without clipboard work; registration does not navigate; profile links are spans. Profiles also display "verified student" without a verification-dependent condition. These are acceptable fixture demonstrations, but misleading with real users. [Actions][shell] / [Sharing][team] / [Profiles][profile]

**Fix:** Implement each action or remove its promise. Keep team contact links private to authorized members. Tie verification badges to actual verification status.

### P1 - Existing tests do not establish MVP correctness

Tests cover fixture parity, storage repair, and mocked API health/readiness. Those are useful, but they do not prove real application transitions, authorization, concurrent acceptance, or browser completion. The root also contains no checked-in GitHub Actions directory. [Parity tests][parity-tests] / [Storage tests][storage-tests] / [API tests][api-tests] / [Repository tree][tree]

**Fix:** Preserve existing tests, then add domain, database-integration, authorization, and two-user browser tests. Run the existing `make check` in CI. [Makefile][makefile]

## 4. Smallest useful MVP

The PRD already identifies the right priority: complete **browse -> create/join -> accept** before expanding scope. [Source][prd]

| Ship for the pilot | Defer |
|---|---|
| Real signup/login and editable profiles | Connection graphs and mutual-connection features |
| Admin-curated competitions with valid official links | Automated scraping and organizer portals |
| Generic team creation, roles, capacity, recruitment controls | Sophisticated ranking and skill verification |
| Apply, withdraw, accept/decline, and consistent statuses | Invitations unless their full recipient flow is implemented |
| Member-only contact handoff and basic application alerts | Built-in chat and complex notifications |
| Basic reporting/moderation and account-data controls | AI matching and monetization |

**Matching recommendation:** Retain the explainable rule-based approach. Fix eligibility and collect actual team-formation outcomes before tuning weights.

## 5. Recommended implementation order

| Phase | Deliverable | Completion gate |
|---|---|---|
| **1. Identity and domain foundation** | Auth/session integration, generic schema, migrations, API contracts, and server authorization. | Two accounts have separate identities and cannot act as each other. |
| **2. One complete vertical slice** | Profile -> create team -> apply with message -> accept -> contact access. | Both users see the same application and membership after refresh. |
| **3. Correctness and integration** | Transactional acceptance, role limits, duplicate prevention, deadlines, withdrawal policy, and fixture replacement. | Invalid actions fail without partial writes or false success. |
| **4. Pilot safeguards** | Admin content maintenance, essential alerts, CI, HTTPS routing, backups/restoration, and error monitoring. | The workflow survives deployment, failure, and recovery tests. |

Authorization must be enforced on every relevant server request - not inferred from a client-side route gate. [OWASP authorization guidance][owasp-auth]

**Deployment-specific gap:** The web Vercel config currently sends every route to `index.html`. Add production API routing before that fallback. Existing loopback bindings, generated deployment credentials, and non-root API image are useful foundations. [Vercel config][vercel] / [Compose][compose] / [Deploy script][deploy] / [Dockerfile][dockerfile]

## 6. Release gate

Do not treat the MVP as complete until:

- **Two real users finish the journey:** one creates a team, another applies, the leader accepts, and the member obtains contact access on desktop and mobile.
- **Failure paths hold:** simultaneous acceptance into the last seat, duplicate requests, unauthorized actions, expired/full teams, session expiry, and network failures produce consistent results.
- **Trust and operations hold:** private contact data stays private; success reflects committed actions; backups restore; modal keyboard focus stays contained and returns correctly. [W3C modal-dialog guidance][w3c-dialog]

## 7. Feasibility assessment

**Technical:** Feasible with the existing architecture. The main remaining work is substantial domain implementation - not an architectural rewrite or deployment cleanup.

**Product:** Demand remains unvalidated by the repository. My main concern is recruitment density: students must overlap on competition, role, availability, and deadline.

**Recommended pilot:** Start with one campus cohort and a small set of actively recruiting competitions. Track applications, leader response time, acceptance rate, and teams that actually connect - not registrations alone.

**Next milestone: two real students form a team through CompMate without simulated controls or manual database intervention.**

<!-- Source links are pinned to the reviewed commit where applicable. -->
[readme]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/README.md
[snapshot]: https://github.com/christolx/compmate/commit/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0
[prd]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/CompMate_MVP_PRD.md
[routes]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/app/AppRoutes.tsx
[matching]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/data/matching.ts
[persisted]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/store/persisted.ts
[router]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/api/internal/httpapi/router.go
[architecture]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/docs/architecture.md
[state]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/data/state.ts
[model]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/data/model.ts
[explore]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/screens/Explore.tsx
[overlays]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/app/overlays.tsx
[profile]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/screens/Profile.tsx
[shell]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/app/AppShell.tsx
[apply]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/components/ApplySheet.tsx
[manage]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/screens/Manage.tsx
[for-you]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/screens/ForYou.tsx
[team]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/screens/Team.tsx
[parity-tests]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/data/parity.test.ts
[storage-tests]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/src/store/persisted.test.ts
[api-tests]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/api/internal/httpapi/router_test.go
[tree]: https://github.com/christolx/compmate/tree/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0
[makefile]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/Makefile
[vercel]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/web/vercel.json
[compose]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/compose.yaml
[deploy]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/scripts/deploy-backend.sh
[dockerfile]: https://github.com/christolx/compmate/blob/f5a38315d5160582bfed897ff0c7f64cd9d0e8d0/apps/api/Dockerfile
[postgres-locking]: https://www.postgresql.org/docs/current/explicit-locking.html
[owasp-auth]: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
[w3c-dialog]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
