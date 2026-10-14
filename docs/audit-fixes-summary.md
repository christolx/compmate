# Audit follow-up: current implementation

Audit dated 7 October 2026 describes prototype state. It predates persistent
Go/PostgreSQL workflows and restored API-backed frontend added on 11–13 October.
Use it as historical evidence, not as current feature inventory.

## Backend ownership

Go API owns accounts, sessions, profiles, team creation, applications, invitations,
membership limits, consented contacts, notifications, and transactions. These
already existed at `cf6564d`, before Darris's follow-up commits.

Cleanup removes duplicate local command/auth/team implementation and automatic
fallback from API store to local prototype. An API outage now preserves server
state, displays error, and supports Retry/polling recovery. Failed writes never
become local successes. Existing local persistence remains prototype support;
design board remains fixture-based.

## Retained and corrected frontend changes

- Shared recruitment selectors exclude full, closed, expired, and upcoming teams.
  Apply selector respects server eligibility for signed-in users. Anonymous users
  can enter auth flow. Final applications remain blocked, matching API uniqueness.
- Missing competition/member/leader records and invalid saved IDs are guarded.
- Official and profile links use one web-URL validator; invalid URLs cannot open.
- Team sharing retains clipboard fallback, removes temporary DOM node even on
  failure, and restores keyboard focus.
- Live notifications have no Sample badge; prototype notifications retain it.
- Contact handoff copy describes consented member contacts.

API catalog hydration already advances date used by competition view models.
Clock injection remains available for deterministic tests. No separate local
identity or account lifecycle is supported by live frontend.

## Validation

Run `npm test`, `npm run lint`, `npm run build`, and API race tests with
`TEST_DATABASE_URL`. Run `npm run test:e2e` against isolated seeded test DB for
desktop/mobile registration, profiles, team creation, applications, acceptance,
contacts, invitations, moderation, failed writes, and session recovery.

Unit tests cover server eligibility, upcoming competitions, final applications,
missing leader profiles, invalid external links, and API outage/retry behavior.
