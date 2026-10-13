# CompMate — High-Impact Audit Resolutions & Progress Summary

**Branch:** `dev/tofle`  
**Date:** October 2026  
**Status:** All P0 and P1 audit priorities implemented, tested (75 unit tests passing), verified in browser, and committed locally to `dev/tofle`.

---

## 1. Executive Summary

This document summarizes the engineering fixes completed in response to the audit findings documented in [`docs/high-impact-audit.md`](file:///Users/darrisfelicio/Documents/CompMate/compmate/docs/high-impact-audit.md).

All changes maintain full compatibility with the existing React + TypeScript + Vite architecture, deterministic matching algorithm, and design parity fixtures, while resolving critical runtime crashes, race conditions, false-success handoffs, and domain rule violations.

### Verification Matrix
| Command | Before | After | Result |
| :--- | :--- | :--- | :--- |
| `npm run lint` | 0 errors | 0 errors | ✅ Strict ESLint pass |
| `npm test` | 35 tests (4 suites) | 75 tests (6 suites) | ✅ All 75 tests passing |
| `npm run build` | Passed | Passed | ✅ `tsc -b && vite build` clean |
| `cd apps/api && go vet ./... && go build ./cmd/api` | Passed | Passed | ✅ Go API builds cleanly |
| Local Dev (`npm run dev`) | "API unavailable" red banner when backend offline | Seamless offline fallback to persistent store | ✅ Clean render & interactive |

---

## 2. Item-by-Item Implementation Details

### Priority P0-1: Unified Domain Command Path & Commit-Time Validations
- **Problem:** UI components wrote directly to state without server/commit-time invariant checks. Duplicate accepts increased member counts beyond capacity targets; full teams could still accept applicants; double-accepts duplicated members; and conflicting pending applications across the same competition were not cleaned up.
- **Solution:**
  - Implemented unified command pipeline in [`apps/web/src/data/commands.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/commands.ts):
    - `executeApply`: Validates authentication, minimum message length ($\ge 10$ chars), competition registration deadlines, team recruitment status, open capacity, and duplicate application prevention.
    - `executeDecision`: Atomic transaction handling `accept`, `decline`, and `withdraw`.
      - **Double-Accept Idempotency:** Repeat accept calls return existing state without duplicate additions.
      - **Capacity Enforcement:** Blocks accept if $t.\text{filled} \ge t.\text{target}$ or if the competition deadline passed.
      - **Atomic Conflicting Request Withdrawal:** Upon accepting a candidate, any other pending applications the candidate has for teams in the *same competition* are atomically marked as `withdrawn`.
    - `executeInvite` & `executeAnswerInvite`: Implemented invite lifecycle with unique invitation IDs (`inv_...`) so multiple teams can invite the same user without overwriting records.
  - Added 17 unit tests in [`apps/web/src/data/commands.test.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/commands.test.ts).

### Priority P0-2: Unified Records & Deduplication
- **Problem:** Data structures were fragmented between incoming (`vx.apps`) and outgoing (`st.apps`), messages and contact-sharing choices were lost across reloads, and `model.ts` hardcoded team names (`Vertex`, `Apex`, `Orion`, `Nadia`).
- **Solution:**
  - Extended `Application` and `VertexApplication` types in [`apps/web/src/data/state.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/state.ts) to store `msg?: string` and `shareContact?: boolean`.
  - Generalized [`apps/web/src/data/model.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/model.ts) so `team(id, st)` derives membership and managed state dynamically from `st.managed[id]` and `st.apps[id]` instead of checking `id === 'apex'` or `id === 'vertex'`.

### Priority P1-5: Persisted State Resilience & Defensiveness
- **Problem:** Corrupt or partially saved `localStorage` data could crash the UI. Probe `vx: {}` threw `Cannot read properties of undefined (reading 'includes')`; deleting a saved competition caused a crash on `c.deadline`.
- **Solution:**
  - Guarded missing entities in [`apps/web/src/data/model.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/model.ts):
    - `comp(id)` returns a safe fallback competition view if the competition ID is missing from catalog.
    - `team(id)` returns a safe fallback team view.
    - `avatar(id)` and `PERSONS[id]` return safe fallback identity records for unknown member IDs.
    - `Array.isArray(m.added)` and `Array.isArray(m.filled)` guard against malformed objects.
  - Guarded `st.saved` in [`apps/web/src/screens/ForYou.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/ForYou.tsx) and [`apps/web/src/store/persisted.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/store/persisted.ts).
  - Added test coverage in [`apps/web/src/store/persisted.test.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/store/persisted.test.ts).

### Priority P1-4: Shared Selectors & Clock Injection
- **Problem:** Competition deadline status and team recruitment states were computed with inconsistent ad-hoc logic. Expired competitions remained marked `open`; deadline filters only had upper bounds (so expired competitions matched "deadline in 7 days"); full teams still displayed open roles.
- **Solution:**
  - Created [`apps/web/src/data/selectors.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/selectors.ts):
    - `isRecruiting(team, st, clock)`: Checks that the competition is not expired (`left >= 0`, `status !== 'closed'`), team recruitment is open, and open capacity $> 0$.
    - `canApply(teamId, st, roleId, clock)`: Centralizes all eligibility checks (own team, already a member, active application, membership in competing team, role capacity).
    - `testDeadlineFilter(comp, range)`: Ensures expired competitions (`left < 0`) are excluded from range filters.
  - Injected clock mechanism into [`apps/web/src/data/model.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/model.ts):
    - `setClock(date)` / `getClock()` with cache keying by `${id}:${at.getTime()}`.
  - Integrated into [`apps/web/src/data/matching.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/matching.ts), [`apps/web/src/screens/Competition.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/Competition.tsx), [`apps/web/src/screens/Team.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/Team.tsx), and [`apps/web/src/screens/Explore.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/Explore.tsx).
  - Added 13 unit tests in [`apps/web/src/data/selectors.test.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/selectors.test.ts).

### Priority P1-6: Remove False Success & Real Handoffs
- **Problem:** "Official registration" only fired a flash toast; Share team only invoked `navigator.clipboard` without fallback; external profile links were rendered as plain `<span>` text; copy promised Discord groups and notification systems that were not yet built.
- **Solution:**
  - In [`apps/web/src/screens/Competition.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/Competition.tsx): Rendered official registration buttons as semantic `<a target="_blank" rel="noopener noreferrer">` anchor links with automatic `https://` protocol normalization.
  - In [`apps/web/src/screens/Team.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/Team.tsx): Implemented `copyToClipboard` with `document.execCommand('copy')` fallback for unsupported contexts.
  - In [`apps/web/src/screens/Profile.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/Profile.tsx): Converted profile link spans into functional external `<a>` links.
  - Aligned user copy:
    - Team communication: `"Contact details stay private. Consented contacts are shared with team members after acceptance."`
    - Decline copy in [`apps/web/src/screens/Manage.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/screens/Manage.tsx): Removed promises of push notifications.
    - Notification panel: Tagged prototype notifications with a `"Sample"` badge.

### Priority P1-3: Real Identity, Profile Onboarding & Clean Team Creation
- **Problem:** `LoginOverlay` was simulation-only; new accounts inherited Maya Chen's demo state (Vertex team, Orion application, 5 pre-existing connections); profile editing and team creation were incomplete.
- **Solution:**
  - Handled `/signup` in [`apps/web/src/data/commands.ts`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/data/commands.ts):
    - Generates a new user identity (`usr_...`).
    - Gives new accounts a clean slate: empty applications (`apps: {}`), empty connections (`conns: {}`), empty saved list (`saved: []`), and empty team state.
  - Handled `/login`:
    - Allows logging in with demo credentials (`demo@compmate.id` or blank) to view sample data.
    - Supports custom registered users.
  - Handled `PUT /profile`: Updates user profile fields, skills, and presentation metadata in memory and app state.
  - Handled `POST /teams` and `DELETE /teams/:id`: Supports creating and deleting teams with capacity boundaries and competition deadline validation.
  - Offline store resilience in [`apps/web/src/app/LiveFrontend.tsx`](file:///Users/darrisfelicio/Documents/CompMate/compmate/apps/web/src/app/LiveFrontend.tsx):
    - When running `npm run dev` without `make stack` (backend offline), automatically and seamlessly falls back to the persistent prototype store with restored seed catalog, eliminating the red "API unavailable" banner.

---

## 3. Git Commit History on `dev/tofle`

All changes have been committed cleanly to `dev/tofle`:

```text
4bf3f3e fix(web): fallback seamlessly to persistent prototype store when API backend is offline
212288b feat(web): support new account registration and team creation without demo state inheritance
c8182ce fix(web): validate official links, add clipboard fallback, and align handoff copy
d2b2729 feat(web): add shared eligibility selectors and clock injection for competitions and teams
c4780ce fix: guard corrupt persisted state and missing entity selectors
6ec0d15 feat(web): add unified domain commands with atomic validations and generalized team records
```

> [!NOTE]
> Per the instructions, commits have **not** been pushed to remote (`origin/dev/tofle` or `master`) yet. You can push them to GitHub with:
> ```bash
> git push origin dev/tofle
> ```
