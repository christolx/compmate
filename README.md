# CompMate

**CompMate — Competition Teammate.** Find competitions and build your team: every
competition has its own team board, teams list the exact roles they need, and
recommendations explain why they fit.

This repository contains the CompMate web app prototype (round 3 core experience).

```sh
npm install
npm run dev        # local dev server
npm test           # data and matching rules
npm run lint
npm run typecheck
npm run build      # production build in dist/
```

## Routes

| Route | Screen |
| --- | --- |
| `/` | Discover (logged out). Signed-in users go to For you |
| `/for-you` | For you: actions first, then recommendations |
| `/competitions` | Explore (`?q=` search, `?cat=` category) |
| `/competitions/:id` | Competition detail with the "Find your team" board |
| `/teams/:id` | Team detail |
| `/teams/vertex/manage` | Team management for Vertex, the team the sample user leads |
| `/people` | Discover people (`?rank=vertex` ranks for Vertex's open roles) |
| `/u/:id` | Profile (`/u/me` for the sample user) |
| `/saved` | Saved competitions |
| `/board` | Design board for presentations (not linked from the app) |

## How the prototype works

- All data is fictional sample data in `src/data/seed.ts`, pinned to 6 October 2026
  so deadlines and countdowns stay stable.
- There is no backend. Sign-in is simulated, and app state (saved competitions,
  applications, connections, the Vertex roster) is kept in the browser's
  `localStorage` under `compmate-v2`.
- The **Prototype** pill at the bottom left signs the sample user in or out,
  resets the demo, and on wide screens previews the app in a 390px phone frame.
- Screens switch to their mobile layout below 1024px.

## Structure

- `src/data/` seed data, view models (`model.ts`) and the matching rules (`matching.ts`)
- `src/components/` cards, navigation and the apply sheet
- `src/screens/` the eight screens
- `src/app/` routing, sign-in gates, overlays and toasts
- `src/board/` the design board

Built with React, React Router, Tailwind CSS and Vite. Tailwind's preflight reset
is intentionally not used, so the layout relies on browser defaults.

## Deployment

Deployed on Vercel as a static Vite build. `vercel.json` rewrites every path to
`index.html` so deep links and refreshes on nested routes work.
