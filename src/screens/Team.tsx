import { PERSONS, TEAMS_BY_COMP, team } from '../data/model';
import { bestFor, match } from '../data/matching';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { CheckIcon, Icon, ShareIcon } from '../components/icons';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';

interface TeamProps {
  tid: string;
  authed?: boolean;
}

/** Team detail: people first, with a match strip explaining why it fits. */
export function Team({ tid, authed: authedProp }: TeamProps) {
  const st = useAppState();
  const authed = authedProp ?? st.authed;
  const m = useIsMobile();
  const nav = useNav();
  const t = team(tid, st);
  const app = st.apps[t.id];
  const busy = TEAMS_BY_COMP[t.comp].some((id) => id !== t.id && team(id, st).isMember);
  const canApply = !t.mine && !t.isMember && !app && !busy && !t.complete && !t.closed;
  const best = authed && canApply ? bestFor('me', t.id, st) : null;
  const mySkills = new Set(PERSONS.me.skills);

  const roles = t.roleList.map((r) => {
    const mm = authed && canApply ? match('me', t.id, r.id, st) : null;
    const top = !!best && !!mm && mm.role.id === best.role.id && best.kind === 'strong';
    return {
      ...r,
      mm,
      top,
      btnLabel: t.mine
        ? 'Find people for this role'
        : app
          ? 'Application ' + app.status
          : busy
            ? 'You are in another team for this competition'
            : t.isMember
              ? "You're on this team"
              : 'Apply to this role',
    };
  });
  const primary: [string, boolean] = t.mine
    ? ['Manage team', true]
    : t.isMember
      ? ["You're on this team", false]
      : app
        ? ['Application ' + app.status, false]
        : busy
          ? ['Already in a team for this competition', false]
          : roles.length
            ? ['Apply as ' + (best ? best.role.name : roles[0].name), true]
            : ['Not recruiting', false];
  const onPrimary = () => {
    if (t.mine) nav('manage');
    else if (primary[1]) nav('apply', { team: t.id, role: best ? best.role.id : t.roleList[0].id });
  };
  const primaryClass = cx('cursor-pointer border-0 font-bold', primary[1] ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500');

  return (
    <div data-screen-label="Team" className="relative min-h-full bg-canvas font-sans text-ink">
      <TopNav authed={authed} active="explore" backTitle={m ? 'Team' : ''} />
      {!m && (
        <nav aria-label="Breadcrumb" className="mx-auto flex max-w-[1120px] gap-2 px-8 pt-5 text-[13px] text-slate-500">
          <AppLink to="explore" className="cursor-pointer text-slate-500 hover:text-slate-500">
            Explore
          </AppLink>
          <span>/</span>
          <AppLink to="comp" args={[t.comp]} className="cursor-pointer text-slate-500 hover:text-slate-500">
            {t.c.title}
          </AppLink>
          <span>/</span>
          <span className="font-semibold text-ink">{t.name}</span>
        </nav>
      )}
      <header className={cx('mx-auto box-border grid max-w-[1120px] items-end gap-7', m ? 'grid-cols-[minmax(0,1fr)] px-5 pt-6 pb-2' : 'grid-cols-[minmax(0,1fr)_auto] px-8 pt-7 pb-9')}>
        <div>
          <div className="flex items-center pl-2.5">
            {t.slots.map((s, i) => (
              <span
                key={i}
                className={cx(
                  '-ml-2.5 box-border grid place-items-center rounded-full font-bold shadow-[0_0_0_4px_#FFFFFF] transition-[background-color] duration-300',
                  m ? 'h-12 w-12 text-[14px]' : 'h-[60px] w-[60px] text-[17px]',
                )}
                style={{ background: s.bg, color: s.fg, border: s.border }}
              >
                {s.text}
              </span>
            ))}
          </div>
          <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
            <h1 className={cx('m-0 leading-none font-extrabold tracking-[-0.04em]', m ? 'text-[34px]' : 'text-[clamp(38px,4.4vw,52px)]')}>{t.name}</h1>
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold" style={{ background: t.statusBg, color: t.statusFg }}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {t.statusLabel}
            </span>
            {t.eligible && (
              <span className="inline-flex h-[26px] items-center gap-[5px] rounded-full bg-success-tint px-2.5 text-[12px] font-bold text-success">
                <CheckIcon size={11} sw={3.4} />
                Competition eligible
              </span>
            )}
          </div>
          <div className="mt-2.5 text-[15px] text-slate-600">
            <AppLink to="comp" args={[t.comp]} className="cursor-pointer font-bold">
              {t.c.title}
            </AppLink>{' '}
            · Led by {t.leaderName}
          </div>
          <div className="mt-[18px] flex flex-wrap items-center gap-3.5">
            <span className="text-[15px] font-extrabold">{t.sizeLabel}</span>
            <div className="flex gap-1">
              {t.segs.map((g, i) => (
                <span key={i} className="relative h-1.5 w-[26px] rounded-[3px] transition-[background-color] duration-300" style={{ background: g.bg }} />
              ))}
            </div>
            <span className="text-[13px] font-semibold" style={{ color: t.eligFg }}>
              {t.eligText}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-slate-500">Competition rule: {t.c.teamLong}</div>
        </div>
        {!m && (
          <div className="flex gap-2">
            <button type="button" onClick={() => nav('toast', 'Team link copied')} aria-label="Share team" className="grid h-12 w-12 cursor-pointer place-items-center rounded-[12px] border border-slate-200 bg-white text-slate-700">
              <ShareIcon size={18} />
            </button>
            <button type="button" onClick={onPrimary} disabled={!primary[1]} className={cx('h-12 rounded-[12px] px-[22px] text-[15px]', primaryClass)}>
              {primary[0]}
            </button>
          </div>
        )}
      </header>
      {best?.kind && (
        <div className={cx('mx-auto box-border max-w-[1120px]', m ? 'px-5 pt-4' : 'px-8')}>
          <div className={cx('grid items-start gap-x-7 gap-y-4 rounded-[16px] border border-match-line bg-match', m ? 'grid-cols-[minmax(0,1fr)] p-4' : 'grid-cols-[200px_minmax(0,1fr)] px-6 py-5')}>
            <div>
              <span className="inline-flex h-[26px] items-center rounded-full bg-indigo-tint px-2.5 text-[12px] font-extrabold text-indigo">{best.label}</span>
              <div className="mt-2 text-[15px] font-bold">for the {best.role.name} role</div>
            </div>
            <div className={cx('grid gap-x-6 gap-y-2', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-2')}>
              {best.reasons.map((w) => (
                <div key={w} className="flex gap-2 text-[14px] leading-[1.45] text-ink-2">
                  <CheckIcon size={14} stroke="#4F46E5" className="mt-[3px] flex-none" />
                  {w}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className={cx('mx-auto box-border grid max-w-[1120px] items-start', m ? 'grid-cols-[minmax(0,1fr)] gap-10 px-5 pt-7 pb-8' : 'grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-[clamp(32px,5vw,72px)] px-8 pt-12 pb-[88px]')}>
        <main className="min-w-0">
          <section>
            <h2 className="m-0 text-[20px] font-bold tracking-[-0.015em]">About the team</h2>
            <p className={cx('mt-2.5 mb-0 max-w-[640px] leading-[1.65] text-ink-2', m ? 'text-[16px]' : 'text-[17px]')}>{t.about}</p>
            <div className={cx('mt-6 grid gap-4 border-t border-divider pt-5', m ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-4')}>
              {[
                { k: 'Experience', v: t.level },
                { k: 'Communication', v: t.comms },
                { k: 'Availability', v: t.avail },
                { k: 'Team language', v: t.lang },
              ].map((pf) => (
                <div key={pf.k}>
                  <div className="text-[12px] font-semibold text-slate-500">{pf.k}</div>
                  <div className="mt-[3px] text-[14px] font-bold">{pf.v}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="mt-11">
            <h2 className="mt-0 mb-1.5 text-[20px] font-bold tracking-[-0.015em]">Meet the team</h2>
            {t.memberList.map((mm) => (
              <AppLink key={mm.id} to="profile" args={[mm.id]} className="flex cursor-pointer items-center gap-3.5 border-b border-divider py-4 text-ink hover:text-ink">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-full text-[15px] font-bold" style={{ background: mm.bg, color: mm.fg }}>
                  {mm.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold">{mm.label}</span>
                    {mm.isLeader && <span className="rounded-[5px] bg-slate-100 px-[7px] py-0.5 text-[11px] font-bold text-slate-600">Leader</span>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-600">
                    {mm.program} · {mm.facName}
                  </div>
                </div>
                <div className="max-w-[45%] min-w-0 flex-[0_1_auto] text-right text-[13px] text-slate-700">
                  <div className="font-bold">{mm.roles[0]}</div>
                  <div className="truncate text-slate-500">{mm.skills.slice(0, 3).join(' · ')}</div>
                </div>
              </AppLink>
            ))}
            {t.roleList.flatMap((r) =>
              Array.from({ length: r.qty }, (_, i) => (
                <div key={r.id + i} className="flex items-center gap-3.5 border-b border-divider py-4">
                  <span className="box-border grid h-12 w-12 flex-none place-items-center rounded-full border-[1.5px] border-dashed border-seat text-[18px] text-slate-400">+</span>
                  <div className="flex-1">
                    <div className="text-[15px] font-bold text-slate-600">Open seat · {r.name}</div>
                    <div className="text-[13px] text-slate-500">{best && best.role.id === r.id ? 'This could be you' : 'Waiting for the right person'}</div>
                  </div>
                </div>
              )),
            )}
          </section>
        </main>
        <aside className={cx('top-[92px]', m ? 'static' : 'sticky')}>
          <h2 className="mt-0 mb-3.5 text-[20px] font-bold tracking-[-0.015em]">Open roles</h2>
          <div className="flex flex-col gap-3.5">
            {roles.map((r) => (
              <div key={r.id} className="rounded-[16px] border border-solid bg-white p-[22px]" style={{ borderColor: r.top ? '#C7D2FE' : '#E5E9F0', boxShadow: r.top ? '0 14px 30px -18px rgba(79,70,229,.45)' : 'none' }}>
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <div className="text-[21px] font-extrabold tracking-[-0.02em]">{r.name}</div>
                    <div className="mt-0.5 text-[13px] text-slate-500">{r.qtyLabel}</div>
                  </div>
                  {r.mm?.kind && (
                    <span className="inline-flex h-6 items-center rounded-full px-[9px] text-[12px] font-bold" style={{ background: r.mm.bg, color: r.mm.fg }}>
                      {r.mm.label}
                    </span>
                  )}
                </div>
                <p className="mt-3 mb-0 text-[14px] leading-[1.55] text-slate-700">{r.note}</p>
                <div className="mt-3.5 text-[13px] font-semibold text-slate-600">We're looking for someone comfortable with:</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {r.skills.map((k) => {
                    const has = authed && mySkills.has(k);
                    return (
                      <div key={k} className="flex items-center gap-2 text-[14px] text-ink">
                        <span className={cx('grid h-4 w-4 flex-none place-items-center rounded-full', has ? 'bg-indigo-tint' : 'bg-slate-100')}>
                          <Icon size={9} sw={4} stroke={has ? '#4F46E5' : '#94A3B8'}>
                            <path d={has ? 'M20 6 9 17l-5-5' : 'M6 12h12'} />
                          </Icon>
                        </span>
                        <span className={has ? 'font-bold' : 'font-medium'}>{k}</span>
                        {has && <span className="sr-only">(you have this skill)</span>}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => (t.mine ? nav('manage') : canApply && nav('apply', { team: t.id, role: r.id }))}
                  disabled={!canApply && !t.mine}
                  className={cx(
                    'mt-[18px] h-[46px] w-full cursor-pointer rounded-[12px] border-0 text-[14px] font-bold hover:brightness-95',
                    canApply || t.mine ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {r.btnLabel}
                </button>
              </div>
            ))}
            {roles.length === 0 && <div className="rounded-[16px] bg-canvas p-5 text-[14px] text-slate-600">All roles are filled. This team is no longer recruiting.</div>}
          </div>
          <p className="mt-4 mb-0 text-[12px] leading-[1.55] text-slate-500">
            Contact details stay private. If you're accepted, {t.leaderFirst} shares the team's {t.comms} group with you.
          </p>
        </aside>
      </div>
      {m && <div aria-hidden="true" className="h-[79px]" />}
      {m && (
        <div className="fixed inset-x-0 bottom-0 z-[15] border-t border-line bg-white/97 px-4 pt-2.5 pb-4 backdrop-blur-[10px]">
          <button type="button" onClick={onPrimary} disabled={!primary[1]} className={cx('h-[52px] w-full rounded-[12px] text-[15px]', primaryClass)}>
            {primary[0]}
          </button>
        </div>
      )}
    </div>
  );
}
