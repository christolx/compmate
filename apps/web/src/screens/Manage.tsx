import { useEffect, useState } from 'react';
import { PERSONS, TEAM_BY_ID, team } from '../data/model';
import { MATCH_WEIGHTS, coverage, match, recsForTeam } from '../data/matching';
import type { VertexState } from '../data/state';
import type { ApplicationStatus } from '../data/types';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { BottomNav } from '../components/BottomNav';
import { PersonTile } from '../components/PersonTile';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState, useStore } from '../store/store';

type Tab = 'apps' | 'recs' | 'team';
type Confirm = { kind: 'close' } | { kind: 'accept' | 'decline'; id: string };

/** Team management for Vertex, the team the sample user leads. */
export function Manage({ tab: initialTab = 'apps' }: { tab?: Tab }) {
  const store = useStore();
  const st = useAppState();
  const m = useIsMobile();
  const nav = useNav();
  const [roleId, setRoleId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [howOpen, setHowOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirm(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm]);

  const t = team('vertex', st);
  const vx = st.vx;
  const write = (patch: Partial<VertexState>) => store.set((s) => ({ vx: { ...s.vx, ...patch } }));
  const pending = vx.apps.filter((a) => a.status === 'pending');
  const curRole = (t.roleList.find((r) => r.id === roleId) || t.roleList[0])?.id;
  const cov = coverage('vertex', st);
  const missing = cov.filter((c) => c.missing).map((c) => c.name);
  const recs = curRole
    ? recsForTeam('vertex', curRole, st)
        .filter((x) => !vx.apps.some((a) => a.pid === x.id && a.status === 'pending'))
        .slice(0, 3)
        .map((x) => x.id)
    : [];

  const dialog = (() => {
    if (!confirm) return null;
    if (confirm.kind === 'close') {
      return t.closed
        ? { title: 'Reopen recruitment?', body: 'Vertex will show as recruiting again on the competition page.', btn: 'Reopen', btnBg: 'var(--color-brand)' }
        : { title: 'Close recruitment?', body: "Vertex will stop appearing as recruiting and won't receive new applications. Pending applications stay reviewable.", btn: 'Close recruitment', btnBg: '#DC2626' };
    }
    const a = vx.apps.find((x) => x.id === confirm.id)!;
    const p = PERSONS[a.pid];
    const role = TEAM_BY_ID.vertex.roles.find((x) => x.id === a.role)!;
    const n = t.filled + 1;
    return confirm.kind === 'accept'
      ? {
          title: `Accept ${p.first} as ${role.name}?`,
          body: `${p.first} joins Vertex and gets the Discord invite. The ${role.name} role closes, and ${p.first}'s other applications for this competition are withdrawn.`,
          segs: Array.from({ length: t.target }, (_, i) => (i < n ? 'var(--color-brand)' : '#E2E8F0')),
          after: `After accepting: ${n} of ${t.target} members`,
          btn: 'Accept ' + p.first,
          btnBg: 'var(--color-brand)',
        }
      : { title: `Decline ${p.first}?`, body: `${p.first} gets a short, neutral notification. You can still invite them later.`, btn: 'Decline', btnBg: '#DC2626' };
  })();

  const onConfirm = () => {
    if (!confirm) return;
    setConfirm(null);
    if (confirm.kind === 'close') {
      write({ closed: !t.closed });
      nav('toast', t.closed ? 'Recruitment reopened' : 'Recruitment closed');
      return;
    }
    const a = vx.apps.find((x) => x.id === confirm.id)!;
    const status: ApplicationStatus = confirm.kind === 'accept' ? 'accepted' : 'declined';
    const apps = vx.apps.map((x) => (x.id === a.id ? { ...x, status } : x));
    if (confirm.kind === 'accept') {
      write({ added: vx.added.concat(a.pid), filled: vx.filled.concat(a.role), apps });
      nav('toast', PERSONS[a.pid].first + ' joined Vertex');
    } else {
      write({ apps });
      nav('toast', 'Application declined');
    }
  };

  const increase = () => {
    if (t.target >= t.c.max) return setErr(`Team size cannot exceed the competition maximum (${t.c.max}).`);
    setErr('');
    write({ target: t.target + 1 });
  };
  const decrease = () => {
    if (t.target - 1 < Math.max(t.filled, t.c.min)) return setErr(`Target can't go below your current ${t.filled} members.`);
    setErr('');
    write({ target: t.target - 1 });
  };

  const showApps = !m || tab === 'apps';
  const showRecs = !m || tab === 'recs';
  const showRail = !m || tab === 'team';
  const railH2 = 'mt-0 mb-1 text-[16px] font-extrabold';

  return (
    <div data-screen-label="Manage team" className="relative min-h-full bg-canvas font-sans text-ink">
      <TopNav authed active="teams" backTitle={m ? 'Manage team' : ''} />
      <div className={cx('mx-auto box-border max-w-[1240px]', m ? 'px-5 pt-5 pb-8' : 'px-8 pt-10 pb-[88px]')}>
        <header className={cx('grid items-end gap-6', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto]')}>
          <div>
            <div className="text-[13px] font-bold text-slate-500">Your team · Leader</div>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <h1 className={cx('m-0 leading-none font-extrabold tracking-[-0.04em]', m ? 'text-[34px]' : 'text-[48px]')}>{t.name}</h1>
              <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold" style={{ background: t.statusBg, color: t.statusFg }}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {t.statusLabel}
              </span>
              {t.eligible && <span className="inline-flex h-[26px] items-center rounded-full bg-success-tint px-2.5 text-[12px] font-bold text-success">✓ Competition eligible</span>}
            </div>
            <AppLink to="comp" args={[t.comp]} className="mt-2 inline-block cursor-pointer text-[15px] font-bold">
              {t.c.title}
            </AppLink>
            <div className="mt-[18px] flex flex-wrap items-center gap-4">
              <span className="flex pl-2">
                {t.slots.map((s, i) => (
                  <span key={i} className="-ml-2 box-border grid h-10 w-10 place-items-center rounded-full text-[13px] font-bold shadow-[0_0_0_3px_#FFFFFF] transition-[background-color] duration-300" style={{ background: s.bg, color: s.fg, border: s.border }}>
                    {s.text}
                  </span>
                ))}
              </span>
              <span className="text-[15px] font-extrabold">{t.sizeLabel}</span>
              <span className="text-[13px] text-slate-600">
                {t.roleList.length ? `${t.roleList.length} role${t.roleList.length > 1 ? 's' : ''} open · registration closes ${t.c.deadlineShort}` : 'All roles filled'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => nav('team', 'vertex')} className="h-11 cursor-pointer rounded-[12px] border border-slate-200 bg-white px-4 text-[14px] font-bold text-ink">
              View public page
            </button>
          </div>
        </header>
        {m && (
          <div role="tablist" className="sticky top-14 z-[5] -mx-5 mt-5 flex gap-[22px] border-b border-line bg-white px-5">
            {(
              [
                ['apps', 'Applicants · ' + pending.length],
                ['recs', 'Recommended'],
                ['team', 'Team'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx('h-[46px] cursor-pointer border-0 bg-transparent p-0 text-[14px] font-bold', tab === k ? 'text-ink shadow-[inset_0_-2px_0_var(--color-brand)]' : 'text-slate-500')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className={cx('grid items-start', m ? 'mt-6 grid-cols-[minmax(0,1fr)] gap-8' : 'mt-11 grid-cols-[minmax(0,1fr)_320px] gap-[clamp(32px,4vw,64px)]')}>
          <main className="min-w-0">
            {showApps && (
              <section>
                <div className="flex items-baseline gap-2.5">
                  <h2 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">Applications</h2>
                  <span className="text-[14px] text-slate-500">{pending.length ? pending.length + ' waiting' : ''}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {pending.map((a) => {
                    const p = PERSONS[a.pid];
                    const mm = match(a.pid, 'vertex', a.role, st);
                    return (
                      <article key={a.id} className="animate-[cm-fade_.25s] rounded-[16px] border border-card p-5">
                        <div className="flex items-start gap-3.5">
                          <button type="button" onClick={() => nav('profile', a.pid)} tabIndex={-1} aria-label={'View ' + p.name} className="grid h-[46px] w-[46px] flex-none cursor-pointer place-items-center rounded-full border-0 text-[15px] font-bold" style={{ background: p.bg, color: p.fg }}>
                            {p.initials}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[16px] font-bold">{p.name}</span>
                              <span className="inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-bold" style={{ background: mm.bg, color: mm.fg }}>
                                {mm.label}
                              </span>
                              <span className="ml-auto text-[12px] text-slate-500">{a.when}</span>
                            </div>
                            <div className="mt-0.5 text-[13px] text-slate-600">
                              {p.program} · applying as <strong className="text-ink">{mm.role.name}</strong>
                            </div>
                            <p className="mt-2.5 mb-0 text-[14px] leading-[1.55] text-ink-2">“{a.msg}”</p>
                            <div className="mt-2.5 text-[12px] font-semibold text-indigo">{mm.reasons.slice(0, 2).join(' · ')}</div>
                            <div className="mt-3.5 flex flex-wrap gap-2">
                              <button type="button" onClick={() => nav('profile', a.pid)} className="h-[38px] cursor-pointer rounded-[10px] border-0 bg-transparent px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-100">
                                View profile
                              </button>
                              <div className="flex-1" />
                              <button type="button" onClick={() => setConfirm({ kind: 'decline', id: a.id })} className="h-[38px] cursor-pointer rounded-[10px] border border-slate-200 bg-white px-3.5 text-[13px] font-bold text-danger">
                                Decline
                              </button>
                              <button type="button" onClick={() => setConfirm({ kind: 'accept', id: a.id })} className="h-[38px] cursor-pointer rounded-[10px] border-0 bg-brand px-4 text-[13px] font-bold text-white">
                                Accept
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {pending.length === 0 && (
                    <div className="rounded-[16px] border border-dashed border-slate-300 px-5 py-7 text-center">
                      <div className="text-[15px] font-bold">No applications yet.</div>
                      <div className="mt-1 text-[14px] text-slate-500">Students browsing this competition can still discover your team. Inviting people below is faster.</div>
                    </div>
                  )}
                </div>
              </section>
            )}
            {showRecs && (
              <section className={m ? 'mt-0' : 'mt-[52px]'}>
                <div className="text-[13px] font-bold text-indigo">Recommended teammates</div>
                <h2 className={cx('mt-1.5 mb-0 font-extrabold tracking-[-0.03em]', m ? 'text-[22px]' : 'text-[28px]')}>People who could strengthen {t.name}</h2>
                {t.roleList.length > 0 ? (
                  <>
                    <div className="mt-[18px] rounded-[14px] bg-canvas px-[18px] py-4">
                      <div className="text-[13px] font-bold text-slate-700">Your team today</div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {cov.map((cv) => (
                          <div
                            key={cv.name}
                            className={cx('flex h-[34px] items-center gap-2 rounded-[10px] border px-3', cv.covered ? 'border-solid border-card bg-white' : 'border-dashed border-warning-dot bg-[#FFFBEB]')}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ background: cv.covered ? '#22C55E' : '#F59E0B' }} />
                            <span className={cx('text-[13px] font-bold', cv.covered ? 'text-ink' : 'text-[#92400E]')}>{cv.name}</span>
                            <span className="text-[12px] text-slate-500">{cv.covered ? cv.who : 'missing'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2.5 text-[13px] text-slate-600">
                        {missing.length ? `Recommendations give extra weight to people who add ${missing.join(' and ')} skills.` : 'Your current members cover every skill area your open roles need.'}
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] text-slate-500">Your team needs:</span>
                      {t.roleList.map((r) => {
                        const on = r.id === curRole;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setRoleId(r.id)}
                            aria-pressed={on}
                            className={cx('h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-bold', on ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-700')}
                          >
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className={cx('mt-4 grid gap-4', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]')}>
                      {recs.map((pid) => (
                        <PersonTile key={pid} pid={pid} variant="rec" tid={t.id} rid={curRole} />
                      ))}
                    </div>
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                      <button type="button" onClick={() => setHowOpen((v) => !v)} aria-expanded={howOpen} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-slate-600">
                        {howOpen ? 'Hide how matches are ranked' : 'How are matches ranked?'}
                      </button>
                      <AppLink to="people" args={[{ rank: 'vertex' }]} className="cursor-pointer text-[13px] font-bold">
                        Browse everyone in Discover people →
                      </AppLink>
                    </div>
                    {howOpen && (
                      <div className="mt-3 animate-[cm-fade_.2s] rounded-[14px] border border-card px-[18px] py-4">
                        <div className="text-[13px] leading-[1.55] text-slate-700">
                          Matches are ranked with fixed, published rules. Labels: Strong 80+, Good 60–79, Potential 40–59. Related skills (for example Pitching and Presentation) count for half.
                        </div>
                        <div className={cx('mt-3 grid gap-x-5 gap-y-2', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-2')}>
                          {MATCH_WEIGHTS.map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2.5 text-[13px]">
                              <span className="flex-1 text-slate-700">{k}</span>
                              <span className="h-1.5 w-[60px] rounded-[3px] bg-divider">
                                <span className="block h-full rounded-[3px] bg-[#6366F1]" style={{ width: Math.round((v / 30) * 100) + '%' }} />
                              </span>
                              <span className="w-6 text-right font-bold">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-4 text-[14px] text-slate-500">All roles are filled. Recommendations reappear if you open a new role.</div>
                )}
              </section>
            )}
          </main>
          {showRail && (
            <aside className="flex flex-col gap-8">
              <section>
                <h2 className={railH2}>Members</h2>
                {t.memberList.map((mm) => (
                  <div key={mm.id} className="flex animate-[cm-fade_.3s] items-center gap-3 border-b border-divider py-3">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[12px] font-bold" style={{ background: mm.bg, color: mm.fg }}>
                      {mm.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold">{mm.label}</div>
                      <div className="text-[12px] text-slate-500">{mm.program}</div>
                    </div>
                    {mm.isLeader && <span className="rounded-[5px] bg-slate-100 px-[7px] py-0.5 text-[11px] font-bold text-slate-600">Leader</span>}
                  </div>
                ))}
              </section>
              <section>
                <h2 className={railH2}>Open roles</h2>
                {t.roleList.map((r) => (
                  <div key={r.id} className="border-b border-divider py-3">
                    <div className="flex justify-between text-[14px]">
                      <span className="font-bold">{r.name}</span>
                      <span className="text-slate-500">{r.qtyLabel}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-slate-500">{r.skillsLine}</div>
                  </div>
                ))}
                {t.roleList.length === 0 && <div className="py-3 text-[13px] text-slate-500">All roles filled.</div>}
              </section>
              <section>
                <h2 className="mt-0 mb-3 text-[16px] font-extrabold">Settings</h2>
                <div className="text-[13px] font-semibold text-slate-600">Target team size</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-10 items-center rounded-[10px] border border-field">
                    <button type="button" onClick={decrease} aria-label="Decrease target" className="h-full w-[38px] cursor-pointer border-0 bg-transparent text-[18px] text-slate-700">
                      −
                    </button>
                    <span className="w-7 text-center font-extrabold" aria-live="polite">
                      {t.target}
                    </span>
                    <button type="button" onClick={increase} aria-label="Increase target" className="h-full w-[38px] cursor-pointer border-0 bg-transparent text-[18px] text-slate-700">
                      +
                    </button>
                  </div>
                  <span className="text-[12px] text-slate-500">
                    Competition allows {t.c.min}–{t.c.max}
                  </span>
                </div>
                {err && (
                  <div role="alert" className="mt-2 text-[12px] font-semibold text-danger">
                    {err}
                  </div>
                )}
                <div className="mt-3.5 flex flex-col gap-2">
                  <button type="button" onClick={() => nav('toast', 'Edit team uses the same guided flow as Create team')} className="h-10 cursor-pointer rounded-[10px] border border-slate-200 bg-white text-[14px] font-semibold text-ink">
                    Edit team info
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ kind: 'close' })}
                    className={cx('h-10 cursor-pointer rounded-[10px] border border-slate-200 bg-white text-[14px] font-semibold', t.closed ? 'text-brand-hover' : 'text-danger')}
                  >
                    {t.closed ? 'Reopen recruitment' : 'Close recruitment'}
                  </button>
                </div>
              </section>
            </aside>
          )}
        </div>
      </div>
      {dialog && (
        <div onClick={() => setConfirm(null)} className="fixed inset-0 z-50 flex animate-[cm-fade_.15s] items-center justify-center bg-[rgba(15,23,42,.45)] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="manage-confirm-title"
            onClick={(e) => e.stopPropagation()}
            className="box-border w-full max-w-[440px] animate-[cm-dialog_.2s_ease-out] rounded-[18px] bg-white p-6 shadow-[0_30px_70px_rgba(15,23,42,.2)]"
          >
            <h2 id="manage-confirm-title" className="m-0 text-[20px] font-extrabold tracking-[-0.02em]">
              {dialog.title}
            </h2>
            <p className="mt-2 mb-0 text-[14px] leading-[1.55] text-slate-600">{dialog.body}</p>
            {'segs' in dialog && dialog.segs && (
              <div className="mt-3.5 flex items-center gap-3 rounded-[12px] bg-canvas px-3.5 py-3 text-[13px] text-slate-700">
                <span className="flex gap-1">
                  {dialog.segs.map((g, i) => (
                    <span key={i} className="h-1.5 w-[22px] rounded-[3px]" style={{ background: g }} />
                  ))}
                </span>
                {dialog.after}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="h-[42px] cursor-pointer rounded-[10px] border-0 bg-slate-100 px-4 text-[14px] font-bold text-ink">
                Cancel
              </button>
              <button type="button" onClick={onConfirm} autoFocus className="h-[42px] cursor-pointer rounded-[10px] border-0 px-[18px] text-[14px] font-bold text-white" style={{ background: dialog.btnBg }}>
                {dialog.btn}
              </button>
            </div>
          </div>
        </div>
      )}
      {m && <BottomNav active="teams" />}
    </div>
  );
}
