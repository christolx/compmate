# CompMate — Product Requirements Document

**Version:** 1.0 — MVP / Prototype  
**Platform:** Responsive Web Application  
**Target Users:** University students (initially BINUS)

## 1. Product Overview

CompMate is a competition discovery and team matchmaking platform that helps university students find competitions, discover compatible teammates, and form teams based on shared interests and complementary skills.

**Core Value Proposition:** Discover competitions. Find your people. Compete together.

## 2. Problem Statement

Students face three main challenges:

- **Fragmented Information:** Competition announcements are scattered across social media and university channels.
- **Limited Networks:** Students struggle to find teammates outside their existing social circles.
- **Skill Mismatch:** Students cannot easily find teammates with specific skills required for competitions.

## 3. MVP Features

### 3.1 Authentication & Student Profiles

- Sign up and log in.
- Create and edit student profiles.
- Profile fields: name, university, major, bio, skills, interests, and portfolio/social links.
- View other students' profiles.

### 3.2 Competition Discovery

- Browse competitions without authentication.
- Search and filter by category and deadline.
- View competition details, requirements, team-size limits, and registration links.
- Competition data initially managed by admins.

### 3.3 Team Creation & Discovery

- Create a team associated with a competition.
- Specify team name, description, required skills/roles, and available slots.
- Browse teams recruiting for specific competitions.
- Filter teams based on required skills and available slots.

### 3.4 Team Matchmaking

- Recommend relevant teams using skill and interest matching.
- Students can submit requests to join teams.
- Team leaders can accept or reject requests.
- Accepted students become team members.
- Prevent teams from exceeding competition team-size limits.
- Provide external contact links for accepted members to communicate.

**Matching Approach:** Simple rule-based matching using skill tags and competition interests. No AI required for MVP.

### 3.5 Dashboard

- View teams created or joined.
- Manage incoming join requests.
- Track outgoing applications and their statuses.

## 4. Primary User Flow

1. **Discover:** Student browses competitions.
2. **Select:** Student opens a competition.
3. **Explore:** Student browses teams recruiting for that competition.
4. **Match:** Student finds a suitable team based on required skills.
5. **Apply:** Student logs in and submits a join request.
6. **Connect:** Team leader accepts the request, and members connect.

**Alternative Flow:** Student creates a team, specifies required roles, and recruits other students.

## 5. Core Pages

| Page | Purpose |
|---|---|
| Landing | Product introduction and primary CTA |
| Competitions | Competition directory and filters |
| Competition Details | Competition information and available teams |
| Team Details | Members, open roles, and join requests |
| Dashboard | Manage teams and applications |
| Profile | Student information, skills, and portfolio |

Login and registration use dedicated auth pages or dialogs.

## 6. Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript |
| Backend | Go (net/http + Chi) — REST API |
| Database | PostgreSQL (Supabase) |
| Authentication | Supabase Auth |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Deployment | Vercel |
| Version Control / CI | GitHub + GitHub Actions |

**Architecture:** Full-stack monolith. One Next.js application, one PostgreSQL database, and managed authentication. A separate Go backend can be added later if needed.

## 7. Core Data Models

- **User:** Identity, university, major, bio, skills, interests, and portfolio links.
- **Competition:** Title, description, category, deadline, team-size limits, and registration URL.
- **Team:** Competition ID, leader ID, name, description, and recruitment status.
- **TeamRole:** Team ID, role name, required skills, and available slots.
- **TeamMember:** Team ID, user ID, and role.
- **JoinRequest:** Team ID, applicant ID, message, and status (pending, accepted, or rejected).

## 8. Visual Direction

**Style:** Modern, minimal, student-friendly SaaS. Take inspiration from Linear's polish, Devpost's competition discovery, and card-based team directories. Avoid stock-market imagery from the pitch deck; CompMate should feel like a student community and productivity tool.

- **Theme:** Light-first; dark mode can come later.
- **Typography:** Geist or Inter.
- **Layout:** Clean navigation, generous whitespace, responsive card grids.
- **Components:** Rounded cards, skill badges, category tags, clear CTAs, member avatars, and open-slot indicators.
- **Interaction:** Subtle hover effects and lightweight transitions.
- **Brand Identity:** Geometric, interconnected shapes representing collaboration.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| Background | `#F8FAFC` | Off-white page background |
| Surface | `#FFFFFF` | Cards and panels |
| Primary | `#4F46E5` | Indigo buttons and links |
| Accent | `#2DD4BF` | Mint highlights |
| Text | `#0F172A` | Main text |
| Muted | `#64748B` | Secondary text |

## 9. Out of Scope (MVP)

- AI-powered matchmaking.
- Built-in chat, video calls, or team workspaces.
- Recruiter portals and B2B features.
- Payment and monetization.
- Automated competition scraping.
- Social feeds and complex notification systems.
- Advanced portfolio or skill verification.

## 10. MVP Success Criteria

- Students can discover competitions without logging in.
- Students can create and update profiles.
- Students can create teams and recruit members.
- Students can request to join existing teams.
- Team leaders can manage applications.
- Students can successfully form teams through the platform.
- Application works on desktop and mobile.

**Development Priority:** Deliver the complete **browse competition → create/join team → accept member** flow first. Validate demand before expanding the feature set.
