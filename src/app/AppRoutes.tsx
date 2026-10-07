import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router';
import { COMPETITION_BY_ID, PERSONS, TEAM_BY_ID } from '../data/model';
import { GROUPS } from '../data/seed';
import { TopNav } from '../components/TopNav';
import { Competition } from '../screens/Competition';
import { Discover } from '../screens/Discover';
import { Explore } from '../screens/Explore';
import { ForYou } from '../screens/ForYou';
import { Manage } from '../screens/Manage';
import { People } from '../screens/People';
import { Profile } from '../screens/Profile';
import { Team } from '../screens/Team';
import { useAppState } from '../store/store';
import { AppLink } from './AppLink';
import { type PeopleRank } from './nav';

/** Location state that asks the shell to open the sign-in dialog. */
export interface LoginRequest {
  login: { reason: string; next: string };
}

function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · CompMate` : 'CompMate · Find competitions, build your team';
  }, [title]);
}

function RequireAuth({ reason, children }: { reason: string; children: ReactNode }) {
  const { authed } = useAppState();
  const location = useLocation();
  if (authed) return children;
  const state: LoginRequest = { login: { reason, next: location.pathname + location.search } };
  return <Navigate to="/" replace state={state} />;
}

function Home() {
  const { authed } = useAppState();
  useTitle('');
  return authed ? <Navigate to="/for-you" replace /> : <Discover />;
}

function ForYouRoute() {
  useTitle('For you');
  return <ForYou demo />;
}

function ExploreRoute() {
  const [params] = useSearchParams();
  const cat = params.get('cat') ?? 'All';
  useTitle('Explore competitions');
  return <Explore key={params.toString()} q={params.get('q') ?? ''} cat={GROUPS.includes(cat) ? cat : 'All'} />;
}

function SavedRoute() {
  useTitle('Saved');
  return <Explore mode="saved" />;
}

function CompetitionRoute() {
  const { id = '' } = useParams();
  const c = COMPETITION_BY_ID[id];
  useTitle(c ? c.title : 'Not found');
  return c ? <Competition key={id} cid={id} /> : <NotFound />;
}

function TeamRoute() {
  const { id = '' } = useParams();
  const t = TEAM_BY_ID[id];
  useTitle(t ? `${t.name} · ${COMPETITION_BY_ID[t.comp].title}` : 'Not found');
  return t ? <Team key={id} tid={id} /> : <NotFound />;
}

function ManageRoute() {
  useTitle('Manage Vertex');
  return <Manage />;
}

function PeopleRoute() {
  const [params] = useSearchParams();
  const rank: PeopleRank = params.get('rank') === 'vertex' ? 'vertex' : 'you';
  useTitle('Discover people');
  return <People key={rank} rank={rank} />;
}

function ProfileRoute() {
  const { id = '' } = useParams();
  const p = PERSONS[id];
  useTitle(p ? (id === 'me' ? 'Your profile' : p.name) : 'Not found');
  return p ? <Profile key={id} pid={id} /> : <NotFound />;
}

function NotFound() {
  const { authed } = useAppState();
  return (
    <div className="relative min-h-full bg-white font-sans text-ink">
      <TopNav authed={authed} active="" />
      <div className="mx-auto max-w-[640px] px-5 py-24 text-center">
        <div className="font-mono text-[12px] font-semibold tracking-[.08em] text-slate-500">404</div>
        <h1 className="mt-3 mb-0 text-[30px] font-extrabold tracking-[-0.03em]">This page doesn't exist.</h1>
        <p className="mt-2 mb-0 text-[15px] leading-[1.55] text-slate-500">The competition, team or profile may have been removed, or the link is mistyped.</p>
        <AppLink to="explore" className="mt-6 inline-flex h-[46px] items-center rounded-[12px] bg-brand px-5 text-[14px] font-bold text-white hover:text-white">
          Explore competitions
        </AppLink>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/for-you" element={<RequireAuth reason="see what's next for you"><ForYouRoute /></RequireAuth>} />
      <Route path="/competitions" element={<ExploreRoute />} />
      <Route path="/competitions/:id" element={<CompetitionRoute />} />
      <Route path="/teams/vertex/manage" element={<RequireAuth reason="manage your team"><ManageRoute /></RequireAuth>} />
      <Route path="/teams/:id" element={<TeamRoute />} />
      <Route path="/people" element={<RequireAuth reason="see student profiles"><PeopleRoute /></RequireAuth>} />
      <Route path="/u/:id" element={<RequireAuth reason="see student profiles"><ProfileRoute /></RequireAuth>} />
      <Route path="/saved" element={<RequireAuth reason="see saved competitions"><SavedRoute /></RequireAuth>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
