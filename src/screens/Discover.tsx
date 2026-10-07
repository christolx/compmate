import { useState } from 'react';
import { ALL_COMPETITIONS, team } from '../data/model';
import { GROUPS, POPULAR_SEARCHES } from '../data/seed';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { BottomNav } from '../components/BottomNav';
import { CompTile } from '../components/CompTile';
import { ChevronRightIcon, SearchIcon } from '../components/icons';
import { TeamTile } from '../components/TeamTile';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';

const CATEGORY_HUES = [
  ['#EAF1FF', '#1D4ED8'],
  ['#EEEBFF', '#5B45C9'],
  ['#E6F6F0', '#0F766E'],
  ['#FFF3E2', '#B45309'],
  ['#EEF1F5', '#334155'],
  ['#FCEBF1', '#BE185D'],
  ['#EAF1FF', '#1D4ED8'],
  ['#EEEBFF', '#5B45C9'],
];
const TEAMS_RECRUITING = ALL_COMPETITIONS.reduce((n, c) => n + c.teamsCount, 0);
const CLOSING_SOON = ALL_COMPETITIONS.filter((c) => !c.upcoming && c.left >= 0 && c.left <= 14)
  .sort((a, b) => a.left - b.left)
  .slice(0, 4);
const STEPS = [
  { n: '1', t: 'Discover', d: 'Every open competition in one place, with deadlines and team rules up front.' },
  { n: '2', t: 'Find a team', d: 'See who is already in each team and apply for the role that fits you.' },
  { n: '3', t: 'Compete together', d: 'Once your team is eligible, register on the official site.' },
];

/** Logged-out landing: real competitions and recruiting teams in the first viewport. */
export function Discover({ authed: authedProp }: { authed?: boolean }) {
  const st = useAppState();
  const authed = authedProp ?? st.authed;
  const m = useIsMobile();
  const nav = useNav();
  const [q, setQ] = useState('');
  const h2 = cx('m-0 font-extrabold tracking-[-0.025em]', m ? 'text-[21px]' : 'text-[26px]');
  const sec = cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-8 pb-2' : 'px-8 pt-10 pb-6');
  const row = cx('overflow-x-auto snap-x snap-mandatory', m ? '-mx-5 flex px-5 pb-1' : 'grid');

  return (
    <div data-screen-label="Discover" className="min-h-full bg-white font-sans text-ink">
      <TopNav authed={authed} active="explore" />
      <section className={cx('mx-auto box-border grid max-w-[1280px] items-center gap-12', m ? 'grid-cols-[minmax(0,1fr)] px-5 pt-7 pb-3' : 'grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] px-8 pt-16 pb-12')}>
        <div>
          <div className="inline-flex h-[30px] items-center gap-2 rounded-full bg-[#F3F6FB] pr-3 pl-1.5 text-[13px] font-semibold text-slate-700">
            <span className="inline-flex h-5 items-center rounded-full bg-white px-2 text-[11px] font-bold text-brand shadow-[0_0_0_1px_#E2E8F0]">BINUS</span>
            Now open for BINUS University students
          </div>
          <h1 className={cx('mt-[18px] mb-0 leading-[1.04] font-extrabold tracking-[-0.04em]', m ? 'text-[38px]' : 'text-[clamp(40px,4.6vw,58px)]')}>
            Find competitions.
            <br />
            <span className="text-brand">Build your team.</span>
          </h1>
          <p className={cx('mt-4 mb-0 max-w-[500px] leading-[1.55] text-slate-600', m ? 'text-[16px]' : 'text-[18px]')}>
            Every competition on CompMate has its own team board. Browse what's open, then join a team that needs your skills or start your own.
          </p>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              nav('explore', { q: q.trim() });
            }}
            className="mt-[26px] flex max-w-[580px] items-center gap-2 rounded-[14px] border border-field bg-white py-1.5 pr-1.5 pl-4 shadow-[0_10px_30px_-12px_rgba(15,23,42,.18)] transition-[border-color,box-shadow] duration-150 focus-within:border-[#93C5FD]"
          >
            <SearchIcon size={19} stroke="#64748B" className="flex-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search competitions"
              placeholder="Search competitions, skills, or categories"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-ink outline-0"
            />
            <button type="submit" className={cx('h-[46px] flex-none cursor-pointer rounded-[10px] border-0 bg-brand text-[15px] font-bold whitespace-nowrap text-white hover:bg-brand-hover', m ? 'px-3.5' : 'px-5')}>
              {m ? 'Search' : 'Explore competitions'}
            </button>
          </form>
          <div className={cx('mt-3.5 flex items-center gap-2 overflow-x-auto', m ? '-mr-5 flex-nowrap' : 'flex-wrap')}>
            <span className="flex-none text-[13px] text-slate-500">Popular:</span>
            {POPULAR_SEARCHES.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => nav('explore', { q: label })}
                className="h-8 flex-none cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition-[border-color,color] duration-150 hover:border-[#93C5FD] hover:text-brand-hover"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {!m && (
          <aside className="rounded-[20px] border border-card bg-white p-2 shadow-[0_30px_60px_-30px_rgba(15,23,42,.22)]">
            <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
              <span className="text-[13px] font-bold">Teams recruiting right now</span>
              <span className="text-[12px] text-slate-500">3 of {TEAMS_RECRUITING}</span>
            </div>
            {['apex', 'orion', 'northstar'].map((id) => {
              const t = team(id, st);
              return (
                <AppLink key={id} to="team" args={[id]} className="box-border flex w-full cursor-pointer items-center gap-3.5 rounded-[12px] px-3.5 py-3 text-left transition-[background-color] duration-150 hover:bg-canvas">
                  <span className="flex flex-none pl-1.5">
                    {t.slots.map((s, i) => (
                      <span key={i} className="-ml-1.5 box-border grid h-[30px] w-[30px] place-items-center rounded-full text-[10px] font-bold shadow-[0_0_0_2px_#FFFFFF]" style={{ background: s.bg, color: s.fg, border: s.border }}>
                        {s.text}
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-ink">
                      {t.name} needs a {t.firstRole}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                      {t.c.title} · {t.sizeLabel}
                    </span>
                  </span>
                  <ChevronRightIcon size={16} stroke="#94A3B8" />
                </AppLink>
              );
            })}
            <div className="mx-1.5 mt-1.5 mb-1 border-t border-hairline px-2.5 pt-3 pb-1.5 text-[12px] leading-[1.5] text-slate-500">
              Teams list the exact roles they need. Apply to one role, the team leader decides.
            </div>
          </aside>
        )}
      </section>

      <section className={sec}>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className={h2}>Trending competitions</h2>
            <p className="mt-1 mb-0 text-[14px] text-slate-500">Registration open, teams already forming.</p>
          </div>
          <AppLink to="explore" className="flex-none cursor-pointer text-[14px] font-bold">
            See all →
          </AppLink>
        </div>
        <div className={cx(row, 'grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-6 gap-y-7')}>
          {['techno', 'nbcc', 'dsc', 'nuiux'].map((id) => (
            <div key={id} className={cx('flex-none snap-start', m ? 'w-[272px]' : 'w-auto')}>
              <CompTile cid={id} authed={authed} />
            </div>
          ))}
        </div>
      </section>

      <section className={cx(sec, 'grid', m ? 'grid-cols-[minmax(0,1fr)] gap-10' : 'grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-16')}>
        <div>
          <h2 className={h2}>Closing soon</h2>
          <p className="mt-1 mb-2 text-[14px] text-slate-500">Registration deadlines in the next two weeks.</p>
          {CLOSING_SOON.map((c) => (
            <CompTile key={c.id} cid={c.id} variant="row" />
          ))}
        </div>
        <div>
          <h2 className={h2}>Browse by category</h2>
          <p className="mt-1 mb-4 text-[14px] text-slate-500">Faculty doesn't limit what you can join.</p>
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
            {GROUPS.map((g, i) => {
              const [bg, fg] = CATEGORY_HUES[i];
              const n = ALL_COMPETITIONS.filter((c) => c.group === g).length;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => nav('explore', { cat: g })}
                  className="flex h-14 cursor-pointer items-center justify-between gap-2 rounded-[12px] border-0 px-4 text-left transition-[translate] duration-150 hover:-translate-y-0.5"
                  style={{ background: bg }}
                >
                  <span className="text-[14px] font-bold" style={{ color: fg }}>
                    {g}
                  </span>
                  <span className="text-[12px] font-semibold opacity-75" style={{ color: fg }}>
                    {n} open
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={cx('border-t border-line bg-canvas', m ? 'mt-10' : 'mt-14')}>
        <div className={cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-8 pb-9' : 'px-8 pt-14 pb-16')}>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className={h2}>Teams looking for members</h2>
              <p className="mt-1 mb-0 text-[14px] text-slate-500">See who's already in, what's missing, and apply for one role.</p>
            </div>
          </div>
          <div className={cx(row, 'grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5')}>
            {['apex', 'lumen', 'northstar'].map((id) => (
              <div key={id} className={cx('flex-none snap-start', m ? 'w-[300px]' : 'w-auto')}>
                <TeamTile tid={id} showComp authed={authed} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className={cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-9 pb-10' : 'px-8 py-14')}>
        <div className={cx('grid items-start gap-6', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[1.1fr_1fr_1fr_1fr]')}>
          <h2 className={h2}>How CompMate works</h2>
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-3.5">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{s.n}</span>
              <div>
                <div className="text-[15px] font-bold">{s.t}</div>
                <div className="mt-1 text-[14px] leading-[1.55] text-slate-600">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4 px-8 pt-5 pb-7 text-[13px] text-slate-500">
          <span>
            <strong className="text-ink">CompMate</strong> · Competition Teammate
          </span>
          <span className="flex gap-[18px]">
            <span>About</span>
            <span>For organizers</span>
            <span>Privacy</span>
          </span>
        </div>
      </footer>
      {m && <BottomNav active="explore" />}
    </div>
  );
}
