# CompMate happy paths

**Short answer:** Main E2E exists: **sign up → complete profile → create team → apply → accept → share contacts → confirm connection.** Other existing paths below.

## Demo setup

- Run frontend + API + DB.
- Use separate browser sessions for **leader** and **applicant**.
- Use published competition with future deadline; match campus restriction.
- Seed login: `maya@compmate.local` / `compmate-demo-password`.
- Seed dates stay fixed → expired competitions block recruitment actions.
- Normal login/signup lands on `/`. Open `/for-you` for dashboard.

## 1. New student onboarding

1. Open `/` → **Sign up**.
2. Enter name, email, password; password minimum 10 characters.
3. **Create account** → signed in.
4. Open `/u/me` → **Edit profile**.
5. Fill campus, program, roles, skills, interests, availability, experience.
6. Add optional public links + private contact.
7. **Save profile** → updated profile.

**End state:** Account + profile persisted; personalized discovery available.

## 2. Competition discovery + saved shortlist

1. Browse `/` → `/competitions`.
2. Search; choose category, filters, sort.
3. Open competition → review details, poster, recruiting teams.
4. **Save competition**; login if prompted.
5. Open `/saved` → reopen saved competition.
6. Optional: remove bookmark.

**End state:** Personal competition shortlist.

## 3. Full team formation — recommended main presentation

| Step | Actor | Action |
| --- | --- | --- |
| 1 | Both | Sign up/login → complete profiles |
| 2 | Leader | Open competition → **Create a team** |
| 3 | Leader | Set team name, capacity, roles, skills, role seats |
| 4 | Leader | **Create team** → management page |
| 5 | Applicant | Open team → **Apply as Developer** or available role |
| 6 | Applicant | Enter message, 10–300 characters → **Send application** |
| 7 | Applicant | Open `/for-you` → application **Pending** |
| 8 | Leader | Open `/for-you` → **Review**, or `/teams/:id/manage` |
| 9 | Leader | **Accept** → confirm acceptance |
| 10 | Applicant | Refresh dashboard → **Accepted**; team appears under own teams |
| 11 | Both | Open team → **Show / refresh contacts** |
| 12 | Both | Click **We connected** |

**End state:** Shared roster, accepted application, consented contacts, recorded connection outcome.

**Requirements:**

- Role seats = team capacity − leader seat. Example: capacity **3**, Developer seats **2**.
- Contact visibility requires profile sharing **and** team-specific consent. Leader consents during creation; applicant during application.
- Applicant must have no existing membership for same competition.
- Cross-session updates refresh every 30 seconds; reload for immediate demo.

## 4. Direct invitation → team membership

1. Leader creates recruiting team with open role.
2. Leader opens `/people` → finds compatible student → opens profile.
3. Click **Invite to [team]**.
4. Invitee opens `/for-you` → **View invitation**.
5. Open team → **Accept invitation**; optionally consent to contact sharing.
6. Team roster updates.

**End state:** Student joins through invitation.

**Demo setup:** Leader owns one team → predictable invite target; UI selects first managed team + best matching role.

## 5. Student networking

1. Student A logs in → `/people`.
2. Search/filter → open Student B profile.
3. **Connect** → **Request pending**.
4. Student B logs in → opens incoming request/profile.
5. **Accept request** → **Connected ✓**.

**End state:** Persistent student connection.

## 6. Recruitment management

1. Leader opens `/teams/:id/manage`.
2. **Close recruitment** → confirm.
3. Team stops accepting applications.
4. **Reopen recruitment** → confirm.
5. Open `/teams/:id/edit` → edit details → **Save team**.

**End state:** Recruitment state + team details updated.

## 7. Application decision alternatives

| Path | Steps | End state |
| --- | --- | --- |
| Applicant withdraws | Submit application → open team → **Withdraw application** | **Withdrawn** |
| Leader declines | Open management inbox → **Decline** → confirm | **Declined** |
| Invitee declines | Open invited team → **Decline invitation** | Invitation declined |

**Constraint:** Withdrawn/declined applications are final; same student cannot reapply to same team.

## 8. Contact-sharing revocation

1. Complete team formation with shared contacts.
2. Member opens `/u/me/edit`.
3. Uncheck **Enable contact sharing…** → **Save profile**.
4. Teammate opens team → **Show / refresh contacts**.

**End state:** Revoked contact displays **Contact not shared**.

## 9. Logout → login → resume

1. Open **Account options** → **Log out**.
2. **Log in** → enter same credentials → **Continue**.
3. Open `/for-you`.

**End state:** Existing profile, teams, applications, saved items restored.

## 10. Admin competition curation + moderation

**Prerequisite:** Existing account promoted through operator CLI; signup alone grants no admin access.

- **Curation:** `/admin` → enter competition details, official URL, future deadline, team limits → **Save competition** → competition appears in discovery.
- **Moderation:** Student opens team → **Report this team** → submit reason → admin opens `/admin` → **Hide team** → optionally **Dismiss / restore team**.
- **Metrics:** Admin opens `/admin` → reviews pilot metrics.

## 11. Account export + cleanup

- **Export:** `/u/me/edit` → **Export my data** → download account data.
- **Delete team:** Leader opens team editor → **Delete team** → type exact team name → confirm.
- **Delete account:** `/u/me/edit` → **Delete account** → confirm password.

**End state:** Export downloaded or selected records permanently removed. Delete led teams before deleting leader account.

## Verification scope + demo risks

Findings from current UI/API code + [existing E2E script](../scripts/e2e.mjs). Live browser checks and tests not rerun for this document.

- Expired seed deadlines can block recruitment.
- **See my applications** currently routes to `/` → open `/for-you` directly.
- Official registration opens external site; completion happens outside app.
