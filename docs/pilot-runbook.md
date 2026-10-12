# Pilot release and observation

Implementation can prepare infrastructure and measure actions. Real cohort,
verified organizer data, production hostname and pilot execution require operator
input. Do not label pilot/release gate complete from local test evidence alone.

## Proposed targets — confirm before invitations

Single campus, 20–30 students, 3–5 actively recruiting official competitions,
two-week observation. Suggested targets (not measured outcomes):

| Metric | Proposed target |
| --- | --- |
| Teams with ≥2 members confirming they connected | ≥5 |
| Applications per actively recruiting team | ≥2 |
| Median leader response time | ≤24 hours |
| Acceptance rate | ≥30% |
| Signup → application conversion | ≥40% |

Admin metrics expose current formation counts, per-recruiting-team applications,
median decided application response hours, acceptance rate and committed-action
funnel. Funnel counts events, not unique visitors. Signup/application ratios are
approximate until evaluated per cohort; repeat team/application actions count.
Teams count as connected only with confirmations from ≥2 current members.
Deletion changes current-record metrics, while anonymous event counts remain.

## Before opening recruitment

- Confirm cohort/campus and numeric targets. Choose trusted admin, support owner,
  moderation owner. Promote curator through CLI after account signup.
- Verify official event URL, dates, organizer eligibility and team size against
  organizer source. Set campus restriction deliberately. Add only active events.
- Point backend DNS to production server, configure `APP_HOST` for backend and
  `PUBLIC_ORIGIN` for frontend HTTPS origin. Deploy backend-only Compose/Caddy;
  verify HTTPS redirect/certificate, `/api/ready` and non-API paths returning 404.
- Deploy frontend separately via Vercel. Add `/api/:path*` rewrite to backend HTTPS
  domain before SPA fallback. Verify frontend SPA refresh, proxied API JSON and
  Secure/HttpOnly/SameSite cookie through the Vercel frontend domain.
- Use two fresh real student accounts on deployed desktop/mobile app: signup →
  profile → create → apply → accept → member contacts. Confirm separate identity,
  reload-safe statuses, outsider denied, consent revocation effective.
- Connect hosting health probes and structured ERROR logs to operator alerts.
  Server logs exclude bodies/contact data. Review auth proxy rate limit before
  expanding beyond small cohort; current process-local limit covers remote IP.
- Create DB backup, restore into separate empty DB, verify schema/version and
  row counts, launch API pointed at restored DB, check readiness and user journey.
  Never test restoration on active production DB.

## Backup drill

1. Use `scripts/backup-db.sh` with production DATABASE_URL and private directory.
   Keep encrypted copy off host; define retention/deletion policy.
2. Create new empty database. Set RESTORE_DATABASE_URL and run `restore-db.sh`.
   Script rejects nonempty target and restores in one transaction.
3. Compare users/applications/memberships and migration versions against source.
   Set API to restored DB on separate port; sign in with test account. Confirm
   roster, application states and contact authorization.
4. Record timestamp, archive checksum, counts, operator and recovery duration.
   Suggested backup daily, retention 14 days, restore drill before launch and
   weekly through pilot. These are operator actions, not installed schedules.

## Student onboarding

Create account with unique email/password → campus/skills/availability → private
contact. Explain profile sharing + per-team consent. Find eligible competition,
create team or apply with specific role/message. Leader reviews dashboard inbox;
accepted students exchange contacts then each confirms “We connected”. Support
owner handles password recovery through pilot support; self-service reset not
shipped. No email verification claim; campus eligibility is self-declared.

## Observe and iterate

Review admin metrics daily during pilot. Follow up through agreed human cohort
channel to confirm connection outcomes and collect friction. Log issues with
journey step, expected/actual result and anonymized reproduction. Do not copy
private contact details into issue tracker. Prioritize broken formation/privacy
flows before expanding ranking, chat or other deferred features.

End two weeks: compare actual outcomes against confirmed targets, document
signup/application/acceptance/connection drop-off and leader response delays.
Choose next fixes from evidence. Real student recruitment/follow-up is not
performed by repository tests and has not been executed by this implementation.
