import { PERSONS, SKILL_CATEGORY, avatar, team } from '../data/model';
import { match } from '../data/matching';
import { TEAMS } from '../data/seed';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { BottomNav } from '../components/BottomNav';
import { CheckIcon, VerifiedIcon } from '../components/icons';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';

const CONNECT_BUTTON = {
  none: { label: 'Connect', bd: '1px solid #BFD3FE', bg: '#FFFFFF', fg: '#1D4ED8' },
  sent: { label: 'Request pending', bd: '1px solid #E2E8F0', bg: '#F8FAFC', fg: '#64748B' },
  connected: { label: 'Connected ✓', bd: '1px solid #E2E8F0', bg: '#FFFFFF', fg: '#15803D' },
};

/** A student profile: trust signals, experience, teams, and fit for Vertex. */
export function Profile({ pid }: { pid: string }) {
  const st = useAppState();
  const m = useIsMobile();
  const nav = useNav();
  const p = PERSONS[pid];
  const me = pid === 'me';
  const conn = me ? null : st.conns[pid] || 'none';
  const vx = team('vertex', st);
  const fit = !me && !vx.members.includes(pid) && vx.roleList.length ? vx.roleList.map((r) => match(pid, 'vertex', r.id, st)).sort((a, b) => b.score - a.score)[0] : null;
  const invited = !!st.invites[pid];

  const groups: Record<string, string[]> = {};
  p.skills.forEach((s) => (groups[SKILL_CATEGORY[s] || 'Other'] ??= []).push(s));
  const currentTeams = TEAMS.filter((t) => team(t.id, st).members.includes(pid)).map((t) => {
    const tv = team(t.id, st);
    return { id: t.id, name: tv.name, role: tv.leader === pid ? 'Leader' : p.roles[0], comp: tv.c.title };
  });
  const pastTeams = p.pastTeams || [];
  const mutualFaces = ['kevin', 'rizky', 'bima'].slice(0, Math.min(3, p.mutual)).map(avatar);
  const btn = conn && conn !== 'incoming' ? CONNECT_BUTTON[conn] : null;
  const sectionH2 = 'mt-0 mb-1 text-[20px] font-bold tracking-[-0.015em]';
  const railH2 = 'mt-0 text-[13px] font-bold text-slate-500';

  const teamRow = (t: { name: string; role: string; comp: string }, status: string, current: boolean) => (
    <>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-ink text-[15px] font-extrabold text-white">{t.name[0]}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-ink">
          {t.name} <span className="font-medium text-slate-500">· {t.role}</span>
        </div>
        <div className="truncate text-[13px] text-slate-500">{t.comp}</div>
      </div>
      <span className="text-[12px] font-bold" style={{ color: current ? '#15803D' : '#64748B' }}>
        {status}
      </span>
    </>
  );

  return (
    <div data-screen-label="Profile" className="relative min-h-full bg-white font-sans text-ink">
      <TopNav authed active={me ? '' : 'people'} backTitle={m && !me ? 'Profile' : ''} />
      <div className={cx('mx-auto box-border max-w-[1120px]', m ? 'px-5 pt-6 pb-10' : 'px-8 pt-12 pb-[88px]')}>
        <header className={cx('grid items-start gap-6', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[auto_minmax(0,1fr)_auto]')}>
          <span className={cx('grid place-items-center rounded-full font-extrabold', m ? 'h-[76px] w-[76px] text-[26px]' : 'h-[104px] w-[104px] text-[34px]')} style={{ background: p.bg, color: p.fg }}>
            {p.initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className={cx('m-0 font-extrabold tracking-[-0.035em]', m ? 'text-[28px]' : 'text-[38px]')}>{p.name}</h1>
              {conn === 'connected' && <span className="rounded-[6px] bg-slate-100 px-2 py-[3px] text-[12px] font-bold text-slate-600">1st connection</span>}
            </div>
            <div className="mt-1.5 text-[15px] text-slate-700">
              {p.program} · {p.facName}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[14px] text-slate-600">
              <VerifiedIcon size={14} stroke="#2563EB" />
              BINUS University · verified student
            </div>
            <div className="mt-3.5 flex flex-wrap gap-4 text-[13px]">
              {p.links.map((l) => (
                <span key={l.label} className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <span className="font-medium text-slate-500">{l.label}</span>
                  <span>{l.value}</span> ↗
                </span>
              ))}
            </div>
            {!me && p.mutual > 0 && (
              <div className="mt-3 flex items-center gap-2 text-[13px] text-slate-600">
                <span className="flex pl-[5px]">
                  {mutualFaces.map((f) => (
                    <span key={f.id} className="-ml-[5px] grid h-[22px] w-[22px] place-items-center rounded-full text-[8px] font-bold shadow-[0_0_0_2px_#FFFFFF]" style={{ background: f.bg, color: f.fg }}>
                      {f.initials}
                    </span>
                  ))}
                </span>
                {p.mutual + ' mutual connection' + (p.mutual > 1 ? 's' : '') + (p.mutual >= 2 ? ', including Kevin Wijaya' : '')}
              </div>
            )}
          </div>
          <div className={cx('flex flex-wrap gap-2', m ? 'justify-start' : 'justify-end')}>
            {me ? (
              <button type="button" onClick={() => nav('toast', 'Profile editing comes in the next round')} className="h-11 cursor-pointer rounded-[12px] border border-slate-200 bg-white px-[18px] text-[14px] font-bold text-ink">
                Edit profile
              </button>
            ) : (
              <>
                {conn === 'incoming' ? (
                  <>
                    <button type="button" onClick={() => nav('ignoreConn', pid)} className="h-11 cursor-pointer rounded-[12px] border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-600">
                      Ignore
                    </button>
                    <button type="button" onClick={() => nav('acceptConn', pid)} className="h-11 cursor-pointer rounded-[12px] border-0 bg-brand px-[18px] text-[14px] font-bold text-white">
                      Accept request
                    </button>
                  </>
                ) : (
                  btn && (
                    <button
                      type="button"
                      onClick={() => (conn === 'none' ? nav('connect', pid) : conn === 'sent' ? nav('withdraw', pid) : undefined)}
                      className="h-11 cursor-pointer rounded-[12px] px-[18px] text-[14px] font-bold"
                      style={{ border: btn.bd, background: btn.bg, color: btn.fg }}
                    >
                      {btn.label}
                    </button>
                  )
                )}
                {fit?.kind && (
                  <button
                    type="button"
                    onClick={() => !invited && nav('invite', { pid, tid: 'vertex', rid: fit.role.id })}
                    disabled={invited}
                    className={cx('h-11 cursor-pointer rounded-[12px] border-0 px-[18px] text-[14px] font-bold', invited ? 'bg-success-tint text-success' : 'bg-brand text-white')}
                  >
                    {invited ? 'Invited to Vertex ✓' : 'Invite to Vertex'}
                  </button>
                )}
              </>
            )}
          </div>
        </header>
        {conn === 'incoming' && <div className="mt-5 rounded-[12px] bg-brand-tint px-4 py-3 text-[14px] text-brand-deep">{p.first} wants to connect with you.</div>}
        {me && (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[14px] bg-canvas px-4 py-3.5">
            <div className="min-w-[200px] flex-1">
              <div className="text-[14px] font-bold">Profile {Math.round(p.complete * 100)}% complete</div>
              <div className="mt-0.5 text-[13px] text-slate-600">Add an Instagram or a second portfolio link. Complete profiles rank higher in team recommendations.</div>
            </div>
            <div className="h-1.5 w-40 rounded-[3px] bg-slate-200" role="progressbar" aria-valuenow={Math.round(p.complete * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
              <div className="h-full rounded-[3px] bg-brand" style={{ width: Math.round(p.complete * 100) + '%' }} />
            </div>
          </div>
        )}
        {fit?.kind && (
          <div className={cx('mt-6 grid gap-x-7 gap-y-3.5 rounded-[16px] border border-match-line bg-match', m ? 'grid-cols-[minmax(0,1fr)] p-4' : 'grid-cols-[210px_minmax(0,1fr)] px-6 py-5')}>
            <div>
              <span className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[12px] font-extrabold" style={{ background: fit.bg, color: fit.fg }}>
                {fit.label}
              </span>
              <div className="mt-2 text-[15px] font-bold">for Vertex · {fit.role.name}</div>
            </div>
            <div className={cx('grid gap-x-6 gap-y-2', m ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-2')}>
              {fit.reasons.map((w) => (
                <div key={w} className="flex gap-2 text-[14px] leading-[1.45] text-ink-2">
                  <CheckIcon size={14} stroke="#4F46E5" className="mt-[3px] flex-none" />
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={cx('mt-11 grid items-start', m ? 'grid-cols-[minmax(0,1fr)] gap-10' : 'grid-cols-[minmax(0,1fr)_320px] gap-[72px]')}>
          <main className="min-w-0">
            <section>
              <h2 className="m-0 text-[13px] font-bold text-slate-500">About</h2>
              <p className="mt-2 mb-0 max-w-[620px] text-[17px] leading-[1.65] text-ink-2">{p.about}</p>
            </section>
            <section className="mt-10">
              <h2 className={sectionH2}>Competition experience</h2>
              {p.exp.map((e) => (
                <div key={e.title} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-divider py-4">
                  <span className="text-[14px] font-bold text-slate-500">{e.year}</span>
                  <div>
                    <div className="text-[16px] font-bold">{e.title}</div>
                    <div className="mt-0.5 text-[13px] text-slate-500">{e.org}</div>
                  </div>
                  <span className="text-[13px] font-bold" style={{ color: /place|Finalist|Semifinalist/.test(e.result) ? '#15803D' : '#475569' }}>
                    {e.result}
                  </span>
                </div>
              ))}
              {p.exp.length === 0 && <div className="py-4 text-[14px] text-slate-500">No competitions listed yet.</div>}
            </section>
            <section className="mt-10">
              <h2 className={sectionH2}>Teams</h2>
              {currentTeams.map((t) => (
                <AppLink key={t.id} to="team" args={[t.id]} className="flex cursor-pointer items-center gap-3.5 border-b border-divider py-3.5">
                  {teamRow(t, 'Current', true)}
                </AppLink>
              ))}
              {pastTeams.map((t) => (
                <div key={t.name} className="flex items-center gap-3.5 border-b border-divider py-3.5">
                  {teamRow(t, t.result, false)}
                </div>
              ))}
              {currentTeams.length === 0 && pastTeams.length === 0 && <div className="py-4 text-[14px] text-slate-500">Not on a team right now.</div>}
            </section>
          </main>
          <aside className="flex flex-col gap-8">
            <section>
              <h2 className={cx(railH2, 'mb-3')}>Skills</h2>
              {Object.entries(groups).map(([cat, skills]) => (
                <div key={cat} className="mb-3">
                  <div className="mb-1.5 text-[12px] font-semibold text-slate-400">{cat}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((k) => (
                      <span key={k} className="inline-flex h-[30px] items-center rounded-[8px] bg-[#F3F5F8] px-[11px] text-[13px] font-semibold text-ink-2">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
            <section>
              <h2 className={cx(railH2, 'mb-2.5')}>Preferred roles</h2>
              <div className="flex flex-wrap gap-1.5">
                {p.roles.map((r) => (
                  <span key={r} className="inline-flex h-[30px] items-center rounded-[8px] bg-brand-tint px-[11px] text-[13px] font-bold text-brand-hover">
                    {r}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <h2 className={cx(railH2, 'mb-2')}>Competition interests</h2>
              <div className="text-[15px] leading-[1.6] font-semibold">{p.interests.join(' · ')}</div>
            </section>
            <section>
              <h2 className={cx(railH2, 'mb-2')}>Availability & experience</h2>
              <div className="text-[15px] font-semibold">
                {p.avail} · {p.level}
              </div>
            </section>
            <section className="border-t border-divider pt-5">
              <div className="text-[13px] text-slate-500">{me ? p.connections + ' connections' : `${p.connections} connections · ${p.mutual || 'no'} mutual`}</div>
              {conn === 'connected' && (
                <button type="button" onClick={() => nav('removeConn', pid)} className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-danger">
                  Remove connection
                </button>
              )}
              <div className="mt-2.5 text-[12px] leading-[1.5] text-slate-400">Email, phone number and student ID are never shown on profiles.</div>
            </section>
          </aside>
        </div>
      </div>
      {m && <BottomNav active={me ? 'profile' : 'people'} />}
    </div>
  );
}
