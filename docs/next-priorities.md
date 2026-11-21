# CompMate: what to build or fix next

**Short answer:** The main flow (sign up → create team → apply → accept → share contacts) works. The biggest risks now are **demo blockers** (every seeded competition has expired, and team creation breaks for 3+ member competitions), **dead ends** (no way to leave a team, no list of your teams, no connections list), and **fake trust signals** left over from the prototype. Fix those before adding new features.

Sources: PRD, MVP review, happy paths, the prototype testing report (user feedback), and a code review on 2026-11-21.

Effort: **S** = hours · **M** = 1–2 days · **L** = 3 or more days

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
| 9 | **Team picker when inviting** | Invites always use your first managed team, which may be expired. "Invited ✓" also shows for the wrong team. Add a picker and track invites per user + team. | S–M |
| 10 | **Remove fake trust signals** | Every profile shows a hardcoded "BINUS · verified student" and "including Kevin Wijaya" in mutual connections. Profiles without real links get placeholder links, and competition avatars are padded with random users. All of this misleads real users. | S |
| 11 | **Better text contrast** | User feedback said colors are too faint. About 85 uses of `slate-300/400` text. Raise to `slate-500/600`. | S |
| 12 | **Show the campus rule up front** | A campus mismatch returns a bare "Permission denied". Show "Open to <campus> only" on the competition page, and return a clear error message. | S |

## P2: Correctness and rule fixes (hidden but real)

| # | Item | Why | Effort |
|---|---|---|---|
| 13 | **One team per competition also applies when creating** | Applying blocks double membership, but creating a team doesn't. A user can lead two teams in the same competition, and their pending applications there get stuck. Apply the same check and auto-withdraw those pending applications. | S |
| 14 | **Edit roles after creation** | Roles are locked once the team exists. Raising capacity adds seats to a random role, and lowering it never removes role seats. | M |
| 15 | **"Dismiss report" un-hides a hidden team** | Dismissing one report resets visibility a previous report set (`admin.go:61`). Dismiss should only close the report. | S |
| 16 | **Deadline-day mismatch** | The UI compares dates only and the API uses exact times. On deadline day the UI says "Closes today", the user applies, and the server rejects it. | S |
| 17 | **Re-invite after a declined invite** | Today it fails with a generic 409. Allow re-inviting by resetting the invite to pending. | S |
| 18 | **Confirm before final actions** | Withdrawing an application (final) and cancelling a connection request happen in one click. | S |

## P3: Before a real pilot (ops and security)

| # | Item | Why | Effort |
|---|---|---|---|
| 19 | **Rate limit uses the real client IP** | Behind Caddy, every user shares one IP, so 20 sign-ins per minute becomes a site-wide limit. Trust `X-Forwarded-For` from Caddy only. | S |
| 20 | **Lock down `/catalog`** | Anyone can fetch every profile without signing in, while the UI requires sign-in to view profiles. Require auth or trim the fields. | S |
| 21 | **Password reset (email)** | Not built yet. Pilot support would have to reset passwords by hand. | M |
| 22 | **Email alerts for applications and decisions** | Alerts are in-app only, with a 30s refresh. Leaders miss applications, which hurts the "≤24h response" pilot goal. | M |
| 23 | **Mobile: invite buttons hidden under the bottom bar** | On the team page, Accept/Decline can sit under the fixed action bar, which still says "Apply as…" during a pending invite. Not checked visually yet. | S |
| 24 | **Small nav glitches** | The For You page highlights the Explore tab. The Admin link reloads the whole page. | S |

## Later (after pilot evidence)

Email verification, built-in chat, "Add to calendar" for deadlines, better match scoring based on real formation data, organizer portal, automated scraping. All deferred in the PRD. Revisit only if pilot data shows the need.

---

**Suggested order:** P0 all (about 1 day) → #6, #7, #8, #10, #11 (the user-testing fixes) → the rest of P1/P2 → P3 before inviting a real cohort.
