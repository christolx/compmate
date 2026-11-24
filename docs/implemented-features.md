# CompMate — Prototype and Implemented Features

**Short answer:** CompMate helps students discover competitions, find compatible teammates, form teams, and connect through consent-based contact sharing. Features below exist in current frontend and backend implementation.

## 1. Account Registration and Login

Students can register, log in, and log out using email and password. Profiles, saved competitions, teams, and applications remain stored between sessions, allowing students to resume their competition preparation.

## 2. Student Profiles

Students can edit their campus, study program, faculty, preferred roles, skills, interests, availability, experience, and personal introduction. Public LinkedIn, portfolio, and Instagram links help prospective teammates assess their background; private contact details have separate sharing controls.

## 3. Competition Discovery and Details

Students can search competitions, browse categories, filter by deadline, team size, format, and fee, and sort results. Competition pages display descriptions, organizers, deadlines, posters, participation requirements, and recruiting teams, with external links for official registration.

## 4. Saved Competitions

Students can bookmark competitions and revisit their shortlist from Saved. Bookmarks persist across sessions and can be removed when students change their plans.

## 5. Personalized Recommendations and Match Explanations

CompMate ranks potential teams and teammates using defined rules covering preferred roles, relevant skills, interests, availability, experience, team skill coverage, and profile completeness. Match labels and explanations help students understand suitability; team recommendations also check recruitment eligibility.

## 6. Team Creation and Recruitment Management

Students can create teams for specific competitions, define required roles and skills, and allocate available seats. Leaders can edit team details, close or reopen recruitment, and delete teams; capacity and role-seat checks prevent recruitment beyond available places.

## 7. Team Applications and Decisions

Students can apply for open roles with an introductory message and optional contact-sharing consent. Leaders can accept or decline applications, while applicants can withdraw pending requests; acceptance updates membership and withdraws other pending applications for that competition, enforcing one team per student per competition.

## 8. Direct Team Invitations

Leaders can invite students from their profiles to an available team role. Recipients can accept or decline invitations; acceptance checks current eligibility and available seats before adding them to team roster.

## 9. Student Discovery and Networking

Students can browse other students, search profiles, and filter by role, skill, interest, faculty, experience, and availability. They can send connection requests, accept incoming requests, or remove connections, building a network for future collaboration.

## 10. Personal Dashboard and In-App Alerts

For You dashboard brings together joined teams, submitted applications, leader review inbox, invitations, and in-app alerts. Students can track recruitment activity and decisions, with updates refreshed periodically and alerts markable as read.

## 11. Private Contact Sharing and Connection Confirmation

Accepted teammates can view contact details only when profile sharing and team-specific consent are both enabled. Students can revoke profile sharing across teams and record “We connected” confirmations after making contact, allowing CompMate to track team formation outcomes.

## 12. Competition Curation, Moderation, and Metrics

Authorized admins can create and update competition listings, manage publication, and set official HTTPS links, deadlines, campus restrictions, and team-size limits. Students can report teams; admins can hide or restore reported teams and review signup, application, acceptance, response-time, and connection metrics.

## 13. Account Data Controls

Students can export account data or permanently delete their account after confirming their password. Team leaders must delete teams they own before account deletion; privacy page explains data visibility and contact-sharing rules.

## Suggested Prototype Screenshots

Capture these screens from running prototype for assignment’s “Prototype Photo and Feature Description” section. Pair each image with relevant feature paragraph above.

| Screenshot | Features illustrated |
| --- | --- |
| Explore competitions and competition detail | Search, filters, posters, requirements, saved competitions |
| Student profile and Discover people | Profiles, teammate discovery, connections, invitations |
| Team creation and team detail | Roles, capacity, match explanations, applications |
| For You dashboard and Manage team | Application status, leader decisions, alerts, recruitment controls |
| Accepted team roster and contact panel | Membership, consent-based sharing, connection confirmation |
| Admin dashboard | Competition curation, moderation, formation metrics |

## Implementation Scope

Descriptions checked against current UI, matching logic, API handlers, and [API contract](api-contract.md). Live browser checks and tests were not rerun for this document. Seed listings are sample records; expired deadlines can block recruitment during demonstrations. Registration completes on external organizer sites. Chat, email notifications, automated competition scraping, password reset, and email verification are not implemented.
