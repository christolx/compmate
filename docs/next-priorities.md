# CompMate: what to build or fix next

**Short answer:** The main flow (sign up → create team → apply → accept → share contacts) works, and the demo blockers (P0) are fixed. Next come the **dead ends** (no way to leave a team, no list of your teams, no connections list), **fake trust signals** left over from the prototype, and **onboarding after signup**. After that: growth features (deadline reminders, share previews), then **data loading that scales** before opening beyond the first pilot group.

Sources: PRD, MVP review, happy paths, the prototype testing report (user feedback), and a code review on 2026-11-21.

Effort: **S** = hours · **M** = 1–2 days · **L** = 3 or more days

✅ = done in the 2026-11-24 QA fix pass (see `git log`). #25 is partly done: the For You dashboard now has empty states and a "Complete your profile" step.

---

## P0: Blocks the demo or core flow ✅ Done 2026-11-21

| # | Item | Why | Effort |
|---|---|---|---|
| 1 | **Refresh seed deadlines**, or make them relative to today | All 10 seeded deadlines are on or before 2026-11-12, so today every competition is closed. Nobody can apply or create a team. Breaks every demo. | S |
| 2 | **Team capacity follows competition limits** | The create-team form defaults to capacity 2 and ignores the competition's min/max. Competitions that need 3+ members fail with "Capacity outside competition limits". This is likely the "can't create another team" complaint from user testing. Set min/max/default from the chosen competition and show "seats left to assign" live. | S |
| 3 | **Hide or disable "Create a team" on closed competitions** | The button still shows on closed competitions. The form then quietly resets the competition picker, which looks broken. Show a clear "Registration closed" message instead. | S |
| 4 | **"See my applications" goes to `/`** | Should go to `/for-you` (`ApplySheet.tsx:223`). One-line fix for a known bug. | S |
| 5 | **Error toasts show a green check** | Every failure looks like a success (`overlays.tsx:286`). Add a red error style. | S |

## P1: High-return improvements and features users asked for

| # | Item | Why | Effort |
|---|---|---|---|
| 6 | **Connections list** (Connected, Sent, Incoming tabs) | The #1 complaint from user testing. Today only the count shows, and that count comes from seed data. | M |
| 7 | **"My teams" page** | The "Teams" nav link opens only the *first* team you lead. Members who don't lead a team get sent away. Users with several teams can't find them. | M |
| 8 | **Leave team / remove member** | The app tells users to "Leave that team first", but no leave action exists, so they're stuck forever. Leaders also can't remove an inactive member. | M |
| 9 | ✅ **Team picker when inviting** | Invites always use your first managed team, which may be expired. "Invited ✓" also shows for the wrong team. Add a picker and track invites per user + team. | S–M |
| 10 | ✅ **Remove fake trust signals** | Every profile shows a hardcoded "BINUS · verified student" and "including Kevin Wijaya" in mutual connections. Profiles without real links get placeholder links, and competition avatars are padded with random users. All of this misleads real users. | S |
| 11 | **Better text contrast** | User feedback said colors are too faint. About 85 uses of `slate-300/400` text. Raise to `slate-500/600`. | S |
| 12 | ✅ **Show the campus rule up front** | A campus mismatch returns a bare "Permission denied". Show "Open to <campus> only" on the competition page, and return a clear error message. | S |
| 25 | **Onboarding after signup** | New users land on `/` with an empty profile. Matching doesn't work without skills, roles and interests (user testing confirmed this). An empty campus also blocks competitions limited to one campus. Send users to a short profile step or checklist right after signup. | S–M |
| 26 | **Nudge leaders to respond** | The pilot target is a leader reply within 24 hours, but nothing reminds leaders. Show how long each application has waited (e.g. "Waiting 2 days") and a dashboard banner for pending applications. | S |

## P1.5: Growth and pilot measurement

| # | Item | Why | Effort |
|---|---|---|---|
| 27 | **Deadline reminders for saved competitions** | In interviews, students said they hear about competitions too late and miss deadlines. Saving a competition only bookmarks it today. Add an in-app alert 7 days and 1 day before the deadline, then email later. | M |
| 28 | **Link previews when sharing competitions and teams** | Students already share competitions on WhatsApp and Instagram. A team link that shows a proper preview brings in recruits for free. | S–M |
| 29 | **Funnel analytics** | Metrics only count completed actions (signup, apply, accept). With no page-view data, you can't see where people drop off between browsing and applying, and the pilot needs that answer. | S–M |

## P2: Correctness and rule fixes (hidden but real)

| # | Item | Why | Effort |
|---|---|---|---|
| 13 | ✅ **One team per competition also applies when creating** | Applying blocks double membership, but creating a team doesn't. A user can lead two teams in the same competition, and their pending applications there get stuck. Apply the same check and auto-withdraw those pending applications. | S |
| 14 | **Edit roles after creation** | Roles are locked once the team exists. Raising capacity adds seats to a random role, and lowering it never removes role seats. | M |
| 15 | **"Dismiss report" un-hides a hidden team** | Dismissing one report resets visibility a previous report set (`admin.go:61`). Dismiss should only close the report. | S |
| 16 | **Deadline-day mismatch** | The UI compares dates only and the API uses exact times. On deadline day the UI says "Closes today", the user applies, and the server rejects it. | S |
| 17 | ✅ **Re-invite after a declined invite** | Today it fails with a generic 409. Allow re-inviting by resetting the invite to pending. | S |
| 18 | ✅ **Confirm before final actions** | Withdrawing an application (final) and cancelling a connection request happen in one click. | S |

## P3: Before a real pilot (ops and security)

| # | Item | Why | Effort |
|---|---|---|---|
| 19 | **Rate limit uses the real client IP** | Behind Caddy, every user shares one IP, so 20 sign-ins per minute becomes a site-wide limit. Trust `X-Forwarded-For` from Caddy only. | S |
| 20 | ✅ **Lock down `/catalog`** | Anyone can fetch every profile without signing in, while the UI requires sign-in to view profiles. Require auth or trim the fields. | S |
| 21 | **Password reset (email)** | Not built yet. Pilot support would have to reset passwords by hand. | M |
| 22 | **Email alerts for applications and decisions** | Alerts are in-app only, with a 30s refresh. Leaders miss applications, which hurts the "≤24h response" pilot goal. | M |
| 23 | **Mobile: invite buttons hidden under the bottom bar** | On the team page, Accept/Decline can sit under the fixed action bar, which still says "Apply as…" during a pending invite. Not checked visually yet. | S |
| 24 | **Small nav glitches** | The For You page highlights the Explore tab. The Admin link reloads the whole page. | S |
| 30 | **Data loading that scales** | Every action and every 30-second refresh re-downloads *all* profiles, competitions and teams (`apiStore.ts:25`, `LiveFrontend.tsx:11`). Fine for a 30-person pilot, but it slows down at a few hundred users. Fetch only what each page needs, add pagination, and refresh only what changed. Needed before opening beyond one pilot group. | M–L |

## Code health (ongoing, alongside features)

| # | Item | Why | Effort |
|---|---|---|---|
| 31 | **Split the 492 KB bundle** | The app ships as one large file. Only the Board page loads on demand. Loading each page only when it's opened makes mobile faster. | S |
| 32 | **Break up very long lines of code** | 23 lines are over 400 characters (`DataForms.tsx`, `apiStore.ts`, `overlays.tsx`). They're hard to review, so bugs hide there. The capacity bug was in one of them. Reformat each file when you next touch it. | M |
| 33 | **Close test gaps** | Unit tests cover only the data layer and routing. The Team, Manage and Competition screens and the create-team form have no component tests, so only the end-to-end tests catch problems there. | M |

## Later (after pilot evidence)

Email verification, built-in chat, "Add to calendar" for deadlines, better match scoring based on real formation data, organizer portal, automated scraping. All deferred in the PRD. Revisit only if pilot data shows the need.

---

**Suggested order:** ~~P0~~ ✅ → #6, #7, #8, #10, #11 (fixes from user testing) → #25, #26 (small, directly help pilot goals) → #27, #28, #29 (growth + measurement) → rest of P1/P2 → P3 before inviting a real pilot group → #30 before going beyond it. Do #31–33 alongside other work.
