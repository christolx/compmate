import type { ReactNode } from 'react';
import { PERSONS, TEAM_BY_ID, comp, team, todayLabel } from '../data/model';
import { compsForMe, teamsForMe } from '../data/matching';
import type { ApplicationStatus } from '../data/types';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { BottomNav } from '../components/BottomNav';
import { CompTile } from '../components/CompTile';
import { Icon } from '../components/icons';
import { PersonTile } from '../components/PersonTile';
import { TeamTile } from '../components/TeamTile';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';

const ICONS = {
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  user: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 8v6M22 11h-6',
  check: 'M20 6 9 17l-5-5',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
};

const STATUS: Record<ApplicationStatus, { label: string; fg: string; bg: string }> = {
  pending: { label: 'Pending', fg: '#B45309', bg: '#FFF7E6' },
  accepted: { label: 'Accepted', fg: '#15803D', bg: '#ECFDF3' },
  declined: { label: 'Declined', fg: '#B91C1C', bg: '#FEF2F2' },
  withdrawn: { label: 'Withdrawn', fg: '#475569', bg: '#F1F5F9' },
};

const RECOMMENDED_COMPS = compsForMe()
  .filter((x) => x.id !== 'techno')
  .slice(0, 3)
  .map((x) => x.id);

interface Action {
  icon: string;
  ibg: string;
  ifg: string;
  title: string;
  sub: string;
  cta: string;
  go: () => void;
  primary?: boolean;
  /** Short label for the chip layout (direction B). */
  chip: string;
}

interface ForYouProps {
  /** a = action-first (chosen), b = discovery-first (rejected). Mobile always uses a. */
  dir?: 'a' | 'b';
  /** Show the prototype control that simulates Dimas accepting the Apex application. */
  demo?: boolean;
}

/** Logged-in home: what needs doing first, then recommendations. */
export function ForYou({ dir = 'a', demo }: ForYouProps) {
  const st = useAppState();
  const m = useIsMobile();
  const nav = useNav();
  const vx = team('vertex', st);
  const apexApp = st.apps.apex;
  const accepted = apexApp?.status === 'accepted';
  const pending = st.vx.apps.filter((a) => a.status === 'pending');
  const tc = comp('techno');

  const actions: Action[] = [
    {
      icon: ICONS.clock, ibg: '#FFF7E6', ifg: '#B45309',
      title: tc.title + ' closes in ' + tc.left + ' days',
      sub: vx.eligible ? 'Vertex is eligible. Register the team on the official site.' : 'Vertex still needs members before registering.',
      cta: 'Register ↗', go: () => nav('official', 'techno'), chip: 'Hackathon closes in ' + tc.left + ' days',
    },
  ];
  if (pending.length) {
    actions.push({
      icon: ICONS.user, ibg: '#EFF4FF', ifg: '#1D4ED8',
      title: 'Vertex has ' + pending.length + ' new applicant' + (pending.length > 1 ? 's' : ''),
      sub: pending.map((a) => PERSONS[a.pid].first + ' · ' + TEAM_BY_ID.vertex.roles.find((r) => r.id === a.role)!.name).join('   '),
      cta: 'Review', go: () => nav('manage'), primary: true, chip: pending.length + ' applicants for Vertex',
    });
  }
  if (accepted) {
    actions.push({ icon: ICONS.check, ibg: '#ECFDF3', ifg: '#15803D', title: "You're now on Apex", sub: 'Dimas shared the WhatsApp group. Apex is competition eligible.', cta: 'View team', go: () => nav('team', 'apex'), chip: 'You joined Apex' });
  } else if (apexApp) {
    actions.push({ icon: ICONS.send, ibg: '#F1F5F9', ifg: '#334155', title: 'Your application to Apex is pending', sub: 'Presenter · sent ' + apexApp.when.toLowerCase(), cta: 'View', go: () => nav('team', 'apex'), chip: 'Apex application pending' });
  } else {
    actions.push({ icon: ICONS.spark, ibg: '#EEF0FF', ifg: '#4338CA', title: 'Apex needs a Presenter', sub: 'Strong match for you · ' + comp('nbcc').title, cta: 'View team', go: () => nav('team', 'apex'), chip: 'Apex needs a Presenter' });
  }
  if (st.apps.orion?.status === 'pending') {
    actions.push({ icon: ICONS.send, ibg: '#F1F5F9', ifg: '#334155', title: 'Your application to Orion is pending', sub: 'Researcher · sent ' + st.apps.orion.when, cta: 'View', go: () => nav('team', 'orion'), chip: 'Orion application pending' });
  }
  if (st.conns.nadia === 'incoming') {
    actions.push({ icon: ICONS.user, ibg: '#F1F5F9', ifg: '#334155', title: 'Nadia Chen wants to connect', sub: "UI/UX Designer · strong fit for Vertex's design role", cta: 'View', go: () => nav('profile', 'nadia'), chip: 'Nadia wants to connect' });
  }
  const upNext = actions.slice(0, 4);

  const myTeams = [{ t: vx, myRole: 'Leader', cta: 'Manage', eligShort: vx.eligible ? 'Eligible' : 'Needs members', leads: true }];
  if (accepted) myTeams.push({ t: team('apex', st), myRole: 'Presenter', cta: 'View', eligShort: 'Eligible', leads: false });
  const deadlines = st.saved
    .map((id) => comp(id))
    .filter((c) => c.left >= 0)
    .sort((a, b) => a.left - b.left)
    .slice(0, 3);
  const recTeams = teamsForMe(st).map((x) => x.id);

  const h2 = cx('m-0 font-extrabold tracking-[-0.025em]', m ? 'text-[20px]' : 'text-[24px]');
  const row = cx('overflow-x-auto', m ? '-mx-5 flex px-5 pb-1' : 'grid');

  return (
    <div data-screen-label="For You" className="relative min-h-full bg-canvas font-sans text-ink">
      <TopNav authed active="" />
      <div className={cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-5 pb-8' : 'px-8 pt-9 pb-20')}>
        <div className="text-[13px] font-semibold text-slate-500">{todayLabel}</div>
        <h1 className={cx('mt-1 mb-0 font-extrabold tracking-[-0.035em]', m ? 'text-[30px]' : 'text-[40px]')}>For you</h1>
        {demo && apexApp?.status === 'pending' && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-dashed border-slate-300 px-3.5 py-2.5 text-[13px] text-slate-600">
            <span className="font-mono text-[10px] font-bold tracking-[.06em] text-slate-500">PROTOTYPE</span>
            <span className="flex-1">Simulate Dimas accepting your Apex application.</span>
            <button type="button" onClick={() => nav('acceptApex')} className="h-8 cursor-pointer rounded-[8px] border-0 bg-ink px-3 text-[12px] font-bold text-white">
              Accept application
            </button>
          </div>
        )}

        {dir === 'a' || m ? (
          <div className={cx('mt-7 grid items-start', m ? 'grid-cols-[minmax(0,1fr)] gap-11' : 'grid-cols-[minmax(0,1fr)_340px] gap-[clamp(32px,4vw,64px)]')}>
            <main className="min-w-0">
              <section>
                <h2 className="mt-0 mb-1.5 text-[13px] font-bold text-slate-500">Up next</h2>
                {upNext.map((a) => (
                  <div key={a.title} className="flex items-center gap-3.5 border-b border-divider py-4">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px]" style={{ background: a.ibg, color: a.ifg }}>
                      <Icon size={18} sw={2.2}>
                        <path d={a.icon} />
                      </Icon>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cx('leading-[1.35] font-bold', m ? 'text-[14px]' : 'text-[15px]')}>{a.title}</div>
                      <div className="mt-0.5 text-[13px] text-slate-500">{a.sub}</div>
                    </div>
                    <button
                      type="button"
                      onClick={a.go}
                      className={cx('h-9 flex-none cursor-pointer rounded-[10px] px-3.5 text-[13px] font-bold', a.primary ? 'border-0 bg-brand text-white' : 'border border-slate-200 bg-white text-ink')}
                    >
                      {a.cta}
                    </button>
                  </div>
                ))}
              </section>
              <section className="mt-11">
                <div className="mb-[18px] flex items-end justify-between gap-3">
                  <div>
                    <h2 className={h2}>Recommended competitions</h2>
                    <p className="mt-1 mb-0 text-[14px] text-slate-500">Based on your interests, skills and preferred roles.</p>
                  </div>
                  <AppLink to="explore" className="flex-none cursor-pointer text-[14px] font-bold">
                    Explore →
                  </AppLink>
                </div>
                <div className={cx(row, 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6')}>
                  {RECOMMENDED_COMPS.map((id) => (
                    <div key={id} className={cx('flex-none', m ? 'w-[268px]' : 'w-auto')}>
                      <CompTile cid={id} reason authed />
                    </div>
                  ))}
                </div>
              </section>
              <section className="mt-12">
                <h2 className={h2}>Teams for you</h2>
                <p className="mt-1 mb-[18px] text-[14px] text-slate-500">Open roles that fit your profile. Each card says why.</p>
                <div className={cx(row, 'grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5')}>
                  {recTeams.slice(0, 2).map((id) => (
                    <div key={id} className={cx('flex-none', m ? 'w-[300px]' : 'w-auto')}>
                      <TeamTile tid={id} variant="rec" showComp authed />
                    </div>
                  ))}
                </div>
              </section>
            </main>
            <aside className="flex flex-col gap-9">
              <RailSection title="Your teams">
                {myTeams.map(({ t, myRole, cta, eligShort, leads }) => {
                  const rowClass = 'flex w-full cursor-pointer items-center gap-3 border-b border-divider py-3.5 text-left';
                  const content = (
                    <>
                    <span className="flex flex-none pl-1.5">
                      {t.slots.map((s, i) => (
                        <span key={i} className="-ml-1.5 box-border grid h-[26px] w-[26px] place-items-center rounded-full text-[9px] font-bold shadow-[0_0_0_2px_#FFFFFF]" style={{ background: s.bg, color: s.fg, border: s.border }}>
                          {s.text}
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-ink">
                        {t.name} <span className="font-medium text-slate-500">· {myRole}</span>
                      </span>
                      <span className="block text-[12px] font-semibold" style={{ color: t.eligFg }}>
                        {t.sizeLabel} · {eligShort}
                      </span>
                    </span>
                    <span className="text-[13px] font-bold text-brand">{cta}</span>
                    </>
                  );
                  return leads ? (
                    <AppLink key={t.id} to="manage" className={rowClass}>
                      {content}
                    </AppLink>
                  ) : (
                    <AppLink key={t.id} to="team" args={[t.id]} className={rowClass}>
                      {content}
                    </AppLink>
                  );
                })}
              </RailSection>
              <RailSection title="Applications">
                {Object.entries(st.apps).map(([id, a]) => {
                  const s = STATUS[a.status];
                  return (
                    <AppLink key={id} to="team" args={[id]} className="flex w-full cursor-pointer items-center gap-3 border-b border-divider py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold text-ink">
                          {TEAM_BY_ID[id].name} · {TEAM_BY_ID[id].roles.find((r) => r.id === a.role)!.name}
                        </span>
                        <span className="block truncate text-[12px] text-slate-500">{comp(TEAM_BY_ID[id].comp).title}</span>
                      </span>
                      <span className="inline-flex h-6 flex-none items-center rounded-full px-[9px] text-[12px] font-bold" style={{ background: s.bg, color: s.fg }}>
                        {s.label}
                      </span>
                    </AppLink>
                  );
                })}
              </RailSection>
              <RailSection title="Upcoming deadlines">
                {deadlines.map((c) => {
                  const [day, mon] = c.deadlineShort.split(' ');
                  return (
                    <AppLink key={c.id} to="comp" args={[c.id]} className="flex w-full cursor-pointer items-center gap-3 border-b border-divider py-3 text-left">
                      <span className="w-11 flex-none text-center">
                        <span className="block text-[11px] font-bold" style={{ color: c.closing ? '#B45309' : '#64748B' }}>
                          {mon.toUpperCase()}
                        </span>
                        <span className="block text-[19px] leading-[1.1] font-extrabold text-ink">{day}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-ink">{c.title}</span>
                        <span className="block text-[12px] text-slate-500">{(c.id === 'techno' ? 'Vertex · ' : 'Saved · ') + c.leftLabel}</span>
                      </span>
                    </AppLink>
                  );
                })}
              </RailSection>
              <section>
                <h2 className="m-0 text-[16px] font-extrabold">People you may want to know</h2>
                <p className="mt-1 mb-1 text-[12px] text-slate-500">Based on shared interests and skills your teams need.</p>
                <PersonTile pid="raka" variant="mini" />
                <PersonTile pid="nadia" variant="mini" />
              </section>
            </aside>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              {upNext.map((a) => (
                <button key={a.title} type="button" onClick={a.go} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-0 px-3.5 text-[13px] font-bold" style={{ background: a.ibg, color: a.ifg }}>
                  <Icon size={15} sw={2.4}>
                    <path d={a.icon} />
                  </Icon>
                  {a.chip}
                </button>
              ))}
            </div>
            <h2 className="mt-9 mb-4 text-[26px] font-extrabold tracking-[-0.025em]">Picked for you</h2>
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-5">
              {RECOMMENDED_COMPS.map((id) => (
                <CompTile key={id} cid={id} variant="b" authed />
              ))}
            </div>
            <h2 className="mt-11 mb-4 text-[26px] font-extrabold tracking-[-0.025em]">Teams that need you</h2>
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-5 pb-16">
              {recTeams.slice(0, 3).map((id) => (
                <TeamTile key={id} tid={id} showComp authed />
              ))}
            </div>
          </>
        )}
      </div>
      {m && <BottomNav active="explore" />}
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mt-0 mb-1 text-[16px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}
