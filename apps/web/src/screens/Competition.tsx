import { useEffect, useRef, useState, type RefObject } from 'react';
import { TEAM_BY_ID, comp, teamsFor } from '../data/model';
import { teamsForMe } from '../data/matching';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { BookmarkIcon, CheckIcon } from '../components/icons';
import { TeamTile } from '../components/TeamTile';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';

type Tab = 'overview' | 'teams' | 'details';

const STATUS_COLORS = {
  open: { fg: '#15803D', bg: '#ECFDF3' },
  closing: { fg: '#B45309', bg: '#FFF7E6' },
  upcoming: { fg: '#475569', bg: '#F1F5F9' },
};

interface CompetitionProps {
  cid: string;
  /** a = editorial header with sticky rail (chosen), b = dark banner (rejected). */
  hero?: 'a' | 'b';
  /** Initial mobile tab. */
  tab?: Tab;
  /** Render the "no teams yet" state. */
  noTeams?: boolean;
  authed?: boolean;
}

export function Competition({ cid, hero = 'a', tab: initialTab = 'overview', noTeams, authed: authedProp }: CompetitionProps) {
  const st = useAppState();
  const authed = authedProp ?? st.authed;
  const m = useIsMobile();
  const nav = useNav();
  const [role, setRole] = useState('all');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [anchor, setAnchor] = useState<Tab>('overview');
  const [posterOpen, setPosterOpen] = useState(false);
  const ovRef = useRef<HTMLElement>(null);
  const tlRef = useRef<HTMLElement>(null);
  const teamsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!posterOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPosterOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [posterOpen]);

  const c = comp(cid);
  const all = noTeams ? [] : teamsFor(c.id, st).filter((t) => t.roleList.length && !t.closed);
  const roleNames = [...new Set(all.flatMap((t) => t.roleList.map((r) => r.name)))];
  const shown = all.filter((t) => role === 'all' || t.roleList.some((r) => r.name === role));
  const inComp = all.some((t) => t.isMember);
  const bestMatch = authed && !inComp ? teamsForMe(st).find((x) => TEAM_BY_ID[x.id].comp === c.id && x.m.kind === 'strong') : undefined;
  const best = bestMatch ? { id: bestMatch.id, name: TEAM_BY_ID[bestMatch.id].name, role: bestMatch.m.role.name } : null;
  const saved = authed && st.saved.includes(c.id);
  const teamsTotal = noTeams ? 0 : c.teamsCount;
  const status = STATUS_COLORS[c.status];
  const facLine = c.facList.map((f) => f.name).join(', ');
  const timeline = c.timelineList.map((x) => ({
    ...x,
    dot: x.next ? 'var(--color-brand)' : x.past ? '#94A3B8' : null,
  }));

  const scrollTo = (ref: RefObject<HTMLElement | null>) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const toTeams = () => (m ? setTab('teams') : scrollTo(teamsRef));
  const openPoster = () => c.hasPoster && setPosterOpen(true);
  const save = { onClick: () => nav('save', c.id), 'aria-label': saved ? 'Remove from saved' : 'Save competition' };
  const saveStyle = { borderColor: saved ? '#BFD3FE' : '#E2E8F0', background: saved ? '#EFF4FF' : '#FFFFFF', color: saved ? 'var(--color-brand)' : '#0F172A' };

  const statusPill = (small: boolean) => (
    <span
      className={cx('inline-flex items-center rounded-full font-bold', small ? 'h-[22px] gap-[5px] px-2 text-[11px]' : 'h-6 gap-1.5 px-[9px] text-[12px]')}
      style={{ color: status.fg, background: status.bg }}
    >
      <span className={cx('rounded-full bg-current', small ? 'h-[5px] w-[5px]' : 'h-1.5 w-1.5')} />
      {c.statusLabel}
    </span>
  );
  const timelineRows = (mobile: boolean) =>
    timeline.map((tl) => (
      <div key={tl.label} className={cx('flex', mobile ? 'gap-3 pb-4' : 'relative gap-3.5 pb-[18px]')}>
        <span
          className="mt-1 box-border h-3 w-3 flex-none rounded-full border-2"
          style={{ borderColor: tl.dot ?? '#CBD5E1', background: tl.dot ?? '#FFFFFF' }}
        />
        <div>
          <div className={cx('text-[14px]', !mobile && 'text-ink')} style={{ fontWeight: tl.next ? 700 : 500 }}>
            {tl.label}
          </div>
          <div className={cx('text-[13px] text-slate-500', !mobile && 'mt-0.5')}>{tl.date}</div>
        </div>
      </div>
    ));
  const faces = (size: 'md' | 'sm') => (
    <span className="flex pl-1.5">
      {c.faces.map((f) => (
        <span
          key={f.id}
          className={cx('-ml-1.5 grid place-items-center rounded-full font-bold shadow-[0_0_0_2px_#F5F8FF]', size === 'md' ? 'h-7 w-7 text-[10px]' : 'h-[26px] w-[26px] text-[9px]')}
          style={{ background: f.bg, color: f.fg }}
        >
          {f.initials}
        </span>
      ))}
    </span>
  );

  return (
    <div data-screen-label="Competition" className="relative min-h-full bg-canvas font-sans text-ink">
      <TopNav authed={authed} active="explore" backTitle={m ? 'Competition' : ''} />

      {!m && hero === 'a' && (
        <>
          <nav aria-label="Breadcrumb" className="mx-auto flex max-w-[1280px] gap-2 px-8 pt-5 text-[13px] text-slate-500">
            <AppLink to="explore" className="cursor-pointer text-slate-500 hover:text-slate-500">
              Explore
            </AppLink>
            <span>/</span>
            <AppLink to="explore" args={[{ cat: c.group }]} className="cursor-pointer text-slate-500 hover:text-slate-500">
              {c.cat}
            </AppLink>
          </nav>
          <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_minmax(296px,352px)] items-start gap-[clamp(32px,4vw,64px)] px-8 pt-6 pb-16">
            <main className="min-w-0">
              <div className="grid grid-cols-[minmax(140px,248px)_minmax(0,1fr)] items-end gap-[clamp(20px,3vw,36px)]">
                <button
                  type="button"
                  onClick={openPoster}
                  aria-label="View full poster"
                  className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-[14px] border-0 p-0 shadow-[0_0_0_1px_rgba(15,23,42,.06),0_20px_40px_-24px_rgba(15,23,42,.35)]"
                  style={{ background: c.hueBg }}
                >
                  {c.hasPoster ? (
                    <img src={c.poster} alt={`${c.title} poster`} className="absolute inset-0 h-full w-full object-cover object-top" />
                  ) : (
                    <div className="poster-stripes absolute inset-0 flex flex-col justify-between p-[18px] text-left">
                      <span className="font-mono text-[11px] font-bold tracking-[.08em]" style={{ color: c.hueFg }}>
                        {c.catUpper}
                      </span>
                      <span className="grid h-14 w-14 place-items-center rounded-[14px] bg-white text-[18px] font-extrabold" style={{ color: c.hueFg }}>
                        {c.initials}
                      </span>
                    </div>
                  )}
                </button>
                <div className="@container min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[13px] font-bold text-brand">{c.cat}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[13px] text-slate-600">National · {c.loc}</span>
                    {statusPill(false)}
                  </div>
                  <h1 className="mt-3 mb-0 text-[clamp(28px,3.1vw,40px)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">{c.title}</h1>
                  <div className="mt-2.5 text-[15px] text-slate-600">
                    by <strong className="font-bold text-ink">{c.org}</strong>
                  </div>
                  {c.tagline && <p className="mt-3.5 mb-0 text-[16px] leading-[1.5] text-slate-700">{c.tagline}</p>}
                  <button
                    type="button"
                    onClick={toTeams}
                    className="mt-[22px] inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-[#D6E2FD] bg-[#F5F8FF] py-1.5 pr-3.5 pl-1.5 transition-[border-color] duration-150 hover:border-[#93C5FD]"
                  >
                    {faces('md')}
                    <span className="text-[14px] font-bold whitespace-nowrap text-brand-deep">{teamsTotal} teams recruiting</span>
                    <span className="text-[14px] whitespace-nowrap text-slate-600 @max-lg:hidden">· {c.openRoles} open roles</span>
                    <span className="font-bold text-brand">↓</span>
                  </button>
                </div>
              </div>
              <nav className="sticky top-[68px] z-[5] mt-10 flex gap-7 border-b border-line bg-white">
                {(
                  [
                    ['overview', 'Overview', ovRef],
                    ['teams', 'Find a team · ' + teamsTotal, teamsRef],
                    ['details', 'Timeline & eligibility', tlRef],
                  ] as const
                ).map(([k, label, ref]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setAnchor(k);
                      scrollTo(ref);
                    }}
                    className={cx(
                      'h-12 cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold',
                      anchor === k ? 'text-ink shadow-[inset_0_-2px_0_#0F172A]' : 'text-slate-500',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <section ref={ovRef} className="scroll-mt-[130px] pt-9">
                <h2 className="m-0 text-[21px] font-bold tracking-[-0.015em]">About this competition</h2>
                <p className="mt-3 mb-0 max-w-[680px] text-[16px] leading-[1.7] text-ink-2">{c.overview}</p>
                {c.prizes.length > 0 && (
                  <div className="mt-7 max-w-[680px]">
                    <div className="mb-1 text-[13px] font-bold text-slate-500">Prizes</div>
                    {c.prizes.map((pz) => (
                      <div key={pz.label} className="grid grid-cols-[140px_1fr] gap-4 border-b border-hairline py-3 text-[15px]">
                        <span className="text-slate-600">{pz.label}</span>
                        <span className="font-bold">{pz.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section ref={tlRef} className="grid scroll-mt-[130px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-10 pt-11">
                <div>
                  <h2 className="mt-0 mb-4 text-[21px] font-bold tracking-[-0.015em]">Timeline</h2>
                  {timelineRows(false)}
                </div>
                <div>
                  <h2 className="mt-0 mb-4 text-[21px] font-bold tracking-[-0.015em]">Eligibility</h2>
                  {c.eligibility.map((el) => (
                    <div key={el} className="flex gap-2.5 pb-3 text-[14px] leading-[1.55] text-ink-2">
                      <CheckIcon size={14} stroke="#15803D" className="mt-1 flex-none" />
                      {el}
                    </div>
                  ))}
                  <div className="mt-4 text-[13px] font-bold text-slate-500">Likely relevant</div>
                  <div className="mt-1.5 text-[14px] leading-[1.6] text-slate-700">{facLine}</div>
                  <div className="mt-1 text-[13px] text-slate-500">Any faculty can join. Skills matter more: {c.skills.join(', ')}.</div>
                </div>
              </section>
            </main>
            <aside className="sticky top-[92px]">
              <div className="rounded-[18px] border border-card bg-white p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,.3)]">
                <div className="text-[13px] font-semibold text-slate-500">Registration closes</div>
                <div className="mt-1 text-[26px] font-extrabold tracking-[-0.02em]">{c.deadlineFull}</div>
                <div className="mt-0.5 text-[14px] font-bold" style={{ color: c.closing ? '#B45309' : '#15803D' }}>
                  {c.leftLabel}
                </div>
                <div className="mt-[18px] border-t border-hairline">
                  {[
                    { k: 'Team size', v: c.teamLong },
                    { k: 'Registration fee', v: c.feeLabel },
                    { k: 'Format', v: c.loc },
                    { k: 'Event', v: c.eventLabel },
                  ].map((fa) => (
                    <div key={fa.k} className="flex justify-between gap-3 border-b border-hairline py-3 text-[14px]">
                      <span className="text-slate-500">{fa.k}</span>
                      <span className="text-right font-bold">{fa.v}</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={toTeams} className="mt-5 h-[50px] w-full cursor-pointer rounded-[12px] border-0 bg-brand text-[15px] font-bold text-white hover:bg-brand-hover">
                  Find a team
                </button>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => nav('official', c.id)} className="h-[46px] flex-1 cursor-pointer rounded-[12px] border border-slate-200 bg-white text-[14px] font-bold text-ink hover:border-slate-300">
                    Official registration ↗
                  </button>
                  <button
                    type="button"
                    {...save}
                    aria-pressed={saved}
                    className="grid h-[46px] w-[46px] flex-none cursor-pointer place-items-center rounded-[12px] border border-solid transition-all duration-200 active:scale-90"
                    style={saveStyle}
                  >
                    <BookmarkIcon size={18} fill={saved ? 'var(--color-brand)' : 'none'} />
                  </button>
                </div>
                <p className="mt-3.5 mb-0 text-[12px] leading-[1.5] text-slate-500">Registration and payment happen on the organizer's site. CompMate helps you form the team first.</p>
              </div>
              {best && (
                <AppLink
                  to="team"
                  args={[best.id]}
                  className="mt-3.5 box-border flex w-full cursor-pointer items-center gap-3 rounded-[14px] border border-[#E4E1FF] bg-[#F8F7FF] px-4 py-3.5 text-left"
                >
                  <span className="flex-1">
                    <span className="block text-[12px] font-bold text-indigo">Best match for you</span>
                    <span className="mt-0.5 block text-[14px] font-bold text-ink">
                      {best.name} needs a {best.role}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold text-indigo">View →</span>
                </AppLink>
              )}
            </aside>
          </div>
        </>
      )}

      {!m && hero === 'b' && (
        <div className="bg-ink text-white">
          <div className="mx-auto grid max-w-[1280px] grid-cols-[180px_minmax(0,1fr)_auto] items-center gap-9 px-8 pt-10 pb-11">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[12px]" style={{ background: c.hueBg }}>
              {c.hasPoster && <img src={c.poster} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />}
            </div>
            <div>
              <span className="inline-flex h-[26px] items-center rounded-full bg-white/12 px-2.5 text-[12px] font-bold">
                <span>{c.cat}</span> · <span>{c.statusLabel}</span>
              </span>
              <h1 className="mt-3.5 mb-0 text-[40px] leading-[1.08] font-extrabold tracking-[-0.035em]">{c.title}</h1>
              <div className="mt-2 text-[15px] text-slate-300">by {c.org}</div>
              <div className="mt-[26px] flex gap-10">
                <BigStat value={String(teamsTotal)} label="teams recruiting" />
                <BigStat value={String(c.openRoles)} label="open roles" />
                <BigStat value={c.leftNum} label={c.leftUnit} accent />
              </div>
            </div>
            <div className="flex w-60 flex-col gap-2.5">
              <button type="button" onClick={toTeams} className="h-[50px] cursor-pointer rounded-[12px] border-0 bg-white text-[15px] font-bold text-ink">
                Find a team
              </button>
              <button type="button" onClick={() => nav('official', c.id)} className="h-[46px] cursor-pointer rounded-[12px] border border-white/25 bg-transparent text-[14px] font-bold text-white">
                Official registration ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {m && (
        <>
          <div className="relative h-[300px] overflow-hidden" style={{ background: c.hueBg }}>
            {c.hasPoster ? (
              <img src={c.poster} alt={`${c.title} poster`} className="absolute inset-0 h-full w-full object-cover object-top" />
            ) : (
              <div className="poster-stripes absolute inset-0 grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-[16px] bg-white text-[20px] font-extrabold" style={{ color: c.hueFg }}>
                  {c.initials}
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-[90px] bg-[linear-gradient(transparent,rgba(15,23,42,.45))]" />
            {c.hasPoster && (
              <button type="button" onClick={openPoster} className="absolute right-3 bottom-3 h-8 cursor-pointer rounded-[9px] border-0 bg-white/95 px-3 text-[12px] font-bold whitespace-nowrap text-ink">
                View full poster
              </button>
            )}
          </div>
          <div className="px-5 pt-[18px] pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold text-brand">{c.cat}</span>
              {statusPill(true)}
            </div>
            <h1 className="mt-2 mb-0 text-[25px] leading-[1.15] font-extrabold tracking-[-0.03em]">{c.title}</h1>
            <div className="mt-1 text-[14px] text-slate-500">by {c.org}</div>
            <div className="mt-[18px] grid grid-cols-3 border-y border-divider">
              {[
                { k: 'Closes', v: c.deadlineShort, fg: c.dlFg },
                { k: 'Team', v: c.teamShort, fg: '#0F172A' },
                { k: 'Fee', v: c.feeShort, fg: '#0F172A' },
              ].map((fa, i) => (
                <div key={fa.k} className={cx('py-3 text-center', i > 0 && 'border-l border-divider')}>
                  <div className="text-[11px] font-semibold text-slate-500">{fa.k}</div>
                  <div className="mt-0.5 text-[14px] font-extrabold" style={{ color: fa.fg }}>
                    {fa.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div role="tablist" className="sticky top-14 z-[5] mt-3 flex gap-6 border-b border-line bg-white px-5">
            {(
              [
                ['overview', 'Overview'],
                ['teams', 'Teams · ' + teamsTotal],
                ['details', 'Details'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx(
                  'h-[46px] cursor-pointer border-0 bg-transparent p-0 text-[14px] font-bold',
                  tab === k ? 'text-ink shadow-[inset_0_-2px_0_var(--color-brand)]' : 'text-slate-500',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'overview' && (
            <div className="px-5 pt-5 pb-6">
              <p className="m-0 text-[15px] leading-[1.65] text-ink-2">{c.overview}</p>
              {c.prizes.length > 0 && (
                <>
                  <div className="mt-5 text-[13px] font-bold text-slate-500">Prizes</div>
                  {c.prizes.map((pz) => (
                    <div key={pz.label} className="flex justify-between gap-3 border-b border-hairline py-[11px] text-[14px]">
                      <span className="text-slate-600">{pz.label}</span>
                      <span className="text-right font-bold">{pz.value}</span>
                    </div>
                  ))}
                </>
              )}
              <button
                type="button"
                onClick={toTeams}
                className="mt-5 flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] border border-[#D6E2FD] bg-[#F5F8FF] px-3.5 py-3 text-left"
              >
                {faces('sm')}
                <span className="flex-1 text-[14px] font-bold text-brand-deep">{teamsTotal} teams are recruiting</span>
                <span className="font-bold text-brand">→</span>
              </button>
            </div>
          )}
          {tab === 'details' && (
            <div className="px-5 pt-5 pb-6">
              <div className="mb-3.5 text-[16px] font-bold">Timeline</div>
              {timelineRows(true)}
              <div className="mt-2 mb-3 text-[16px] font-bold">Eligibility</div>
              {c.eligibility.map((el) => (
                <div key={el} className="flex gap-2.5 pb-2.5 text-[14px] leading-[1.5]">
                  <CheckIcon size={13} stroke="#15803D" className="mt-1 flex-none" />
                  {el}
                </div>
              ))}
              <div className="mt-2.5 text-[13px] leading-[1.55] text-slate-500">Likely relevant: {facLine}. Any faculty can join.</div>
            </div>
          )}
        </>
      )}

      {(!m || tab === 'teams') && (
        <section ref={teamsRef} className="scroll-mt-[68px] border-t border-line bg-canvas">
          <div className={cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-7 pb-9' : 'px-8 pt-16 pb-[88px]')}>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <div className="text-[13px] font-bold text-brand">Find your team</div>
                <h2 className={cx('mt-1.5 mb-0 leading-[1.15] font-extrabold tracking-[-0.03em]', m ? 'text-[24px]' : 'text-[34px]')}>
                  {teamsTotal ? teamsTotal + ' teams are currently recruiting' : 'Find your team'}
                </h2>
                <p className="mt-2 mb-0 max-w-[620px] text-[15px] leading-[1.55] text-slate-600">Apply for one specific role. Faculty doesn't matter here, skills do.</p>
              </div>
              {!m && (
                <button type="button" onClick={() => nav('create', c.id)} className="h-[46px] cursor-pointer rounded-[12px] border border-slate-300 bg-white px-[18px] text-[14px] font-bold text-ink hover:border-slate-400">
                  + Create a team
                </button>
              )}
            </div>
            {all.length > 0 ? (
              <>
                {best && role === 'all' && (
                  <div className={cx('mt-7 grid items-center gap-5', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[minmax(0,420px)_minmax(0,1fr)]')}>
                    <TeamTile tid={best.id} variant="rec" authed={authed} />
                    {!m && (
                      <div className="px-3">
                        <div className="text-[13px] font-bold text-indigo">Recommended for you</div>
                        <p className="mt-2 mb-0 text-[15px] leading-[1.6] text-slate-700">
                          CompMate compares your profile with each open role: preferred role, skills, interests, availability and what the team is missing. No hidden scoring, the reasons are listed on the card.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className={cx('mt-7 flex items-center gap-2 overflow-x-auto', m && '-mx-5 px-5')}>
                  {[['all', 'All roles · ' + all.length], ...roleNames.map((n) => [n, n + ' · ' + all.filter((t) => t.roleList.some((r) => r.name === n)).length])].map(([k, label]) => {
                    const on = role === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setRole(k)}
                        aria-pressed={on}
                        className={cx(
                          'h-9 flex-none cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-150',
                          on ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-700',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className={cx('mt-4 grid gap-5', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[repeat(3,minmax(0,1fr))]')}>
                  {shown
                    .filter((t) => !(best && role === 'all' && t.id === best.id))
                    .map((t) => (
                      <TeamTile key={t.id} tid={t.id} authed={authed} />
                    ))}
                </div>
                {shown.length === 0 && <div className="mt-4 p-7 text-center text-[14px] text-slate-500">No teams are looking for this role right now.</div>}
                <div className="mt-5 text-center text-[13px] text-slate-500">
                  Showing {shown.length} of {teamsTotal} teams in this prototype
                </div>
                <div className="mt-9 flex flex-wrap items-center justify-between gap-5 border-t border-slate-200 pt-7">
                  <div>
                    <div className="text-[17px] font-extrabold">Can't find the right team?</div>
                    <div className="mt-1 text-[14px] text-slate-600">
                      Start one, pick a target between {c.min} and {c.max} people, and list the roles you need.
                    </div>
                  </div>
                  <button type="button" onClick={() => nav('create', c.id)} className="h-[46px] cursor-pointer rounded-[12px] border-0 bg-ink px-5 text-[14px] font-bold text-white">
                    Create a team
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-7 rounded-[18px] border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <div className="flex justify-center pl-2">
                  <span className="-ml-2 grid h-11 w-11 place-items-center rounded-full bg-brand text-[12px] font-bold text-white shadow-[0_0_0_3px_#FFFFFF]">You</span>
                  <span className="-ml-2 box-border h-11 w-11 rounded-full border-[1.5px] border-dashed border-seat bg-white shadow-[0_0_0_3px_#FFFFFF]" />
                  <span className="-ml-2 box-border h-11 w-11 rounded-full border-[1.5px] border-dashed border-seat bg-white shadow-[0_0_0_3px_#FFFFFF]" />
                </div>
                <div className="mt-4 text-[18px] font-extrabold">No team yet</div>
                <p className="mx-auto mt-1.5 mb-0 max-w-[380px] text-[14px] leading-[1.55] text-slate-500">
                  No teams are recruiting for this competition yet. Start one and students browsing this page will see your open roles first.
                </p>
                <button type="button" onClick={() => nav('create', c.id)} className="mt-[18px] h-[46px] cursor-pointer rounded-[12px] border-0 bg-brand px-5 text-[14px] font-bold text-white">
                  Create the first team
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {m && <div aria-hidden="true" className="h-[77px]" />}
      {m && (
        <div className="fixed inset-x-0 bottom-0 z-[15] flex gap-2 border-t border-line bg-white/97 px-4 pt-2.5 pb-4 backdrop-blur-[10px]">
          <button type="button" {...save} className="grid h-[50px] w-[50px] flex-none cursor-pointer place-items-center rounded-[12px] border border-solid" style={saveStyle}>
            <BookmarkIcon size={19} fill={saved ? 'var(--color-brand)' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => (tab === 'teams' ? nav('official', c.id) : nav('create', c.id))}
            className="h-[50px] flex-1 cursor-pointer rounded-[12px] border border-slate-200 bg-white text-[14px] font-bold text-ink"
          >
            {tab === 'teams' ? 'Official site ↗' : 'Create a team'}
          </button>
          <button
            type="button"
            onClick={() => (tab === 'teams' ? nav('create', c.id) : setTab('teams'))}
            className="h-[50px] flex-[1.3] cursor-pointer rounded-[12px] border-0 bg-brand text-[15px] font-bold text-white"
          >
            {tab === 'teams' ? 'Create a team' : 'Find a team'}
          </button>
        </div>
      )}

      {posterOpen && c.hasPoster && (
        <div
          role="dialog"
          aria-label={`${c.title} poster`}
          onClick={() => setPosterOpen(false)}
          className="fixed inset-0 z-[60] flex animate-[cm-fade_.18s] items-center justify-center bg-[rgba(15,23,42,.88)] p-6"
        >
          <img src={c.poster} alt={`${c.title} poster`} className="max-h-full max-w-full rounded-[10px] shadow-[0_30px_80px_rgba(0,0,0,.5)]" />
          <button type="button" aria-label="Close" className="absolute top-4 right-4 h-10 w-10 cursor-pointer rounded-full border-0 bg-white/15 text-[20px] text-white">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function BigStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={cx('text-[30px] font-extrabold', accent && 'text-[#FCD34D]')}>{value}</div>
      <div className="text-[13px] text-slate-400">{label}</div>
    </div>
  );
}
