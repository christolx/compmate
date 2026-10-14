import { useState } from 'react';
import { PERSONS, TEAMS_BY_COMP, team } from '../data/model';
import { canApply as checkCanApply } from '../data/selectors';
import { bestFor, match } from '../data/matching';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { CheckIcon, Icon, ShareIcon } from '../components/icons';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState, useStore } from '../store/store';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  const textarea = document.createElement('textarea');
  const focused = document.activeElement;
  try {
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}

interface TeamProps {
  tid: string;
  authed?: boolean;
}

/** Team detail: people first, with a match strip explaining why it fits. */
export function Team({ tid, authed: authedProp }: TeamProps) {
  const st = useAppState();
  const store=useStore();
  const invitation=st.incomingInvites?.find(i=>i.team_id===tid);
  const [shareInvite,setShareInvite]=useState(false);
  const authed = authedProp ?? st.authed;
  const m = useIsMobile();
  const nav = useNav();
  const handleShare = () => {
    void copyToClipboard(window.location.href).then((ok) => {
      nav('toast', ok ? 'Team link copied' : 'Unable to copy link');
    });
  };
  const t = team(tid, st);
  const app = st.apps[t.id];
  const busy = TEAMS_BY_COMP[t.comp]?.some((id) => id !== t.id && team(id, st).isMember);
  const generalApplyCheck = checkCanApply(t.id, st);
  const isApplicable = generalApplyCheck.ok;
  const best = authed && isApplicable ? bestFor('me', t.id, st) : null;
  const mySkills = new Set(PERSONS.me.skills);

  const roles = t.roleList.map((r) => {
    const roleCheck = checkCanApply(t.id, st, r.id);
    const mm = authed && roleCheck.ok ? match('me', t.id, r.id, st) : null;
    const top = !!best && !!mm && mm.role.id === best.role.id && best.kind === 'strong';
    let btnLabel = 'Apply to this role';
    if (t.mine) {
      btnLabel = 'Find people for this role';
    } else if (t.isMember) {
      btnLabel = "You're on this team";
    } else if (app) {
      btnLabel = 'Application ' + app.status;
    } else if (busy) {
      btnLabel = 'You are in another team for this competition';
    } else if (t.c.left < 0 || t.c.status === 'closed') {
      btnLabel = 'Registration closed';
    } else if (t.complete || t.filled >= t.target || t.open <= 0) {
      btnLabel = 'Team complete';
    } else if (r.qty <= 0) {
      btnLabel = 'Role filled';
    } else if (t.closed || t.recruiting === false) {
      btnLabel = 'Not recruiting';
    }
    return {
      ...r,
      mm,
      top,
      canApply: roleCheck.ok,
      btnLabel,
    };
  });
  let primary: [string, boolean] = ['Not recruiting', false];
  if (t.mine) {
    primary = ['Manage team', true];
  } else if (t.isMember) {
    primary = ["You're on this team", false];
  } else if (app) {
    primary = ['Application ' + app.status, false];
  } else if (busy) {
    primary = ['Already in a team for this competition', false];
  } else if (t.c.left < 0 || t.c.status === 'closed') {
    primary = ['Registration closed', false];
  } else if (t.complete || t.filled >= t.target || t.open <= 0) {
    primary = ['Team complete', false];
  } else if (t.closed || t.recruiting === false) {
    primary = ['Not recruiting', false];
  } else if (!isApplicable) {
    primary = [generalApplyCheck.reason || 'Not recruiting', false];
  } else if (roles.length) {
    primary = ['Apply as ' + (best ? best.role.name : roles[0].name), true];
  }
  const onPrimary = () => {
    if (t.mine) nav('manage',t.id);
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
            <button type="button" onClick={handleShare} aria-label="Share team" className="grid h-12 w-12 cursor-pointer place-items-center rounded-[12px] border border-slate-200 bg-white text-slate-700 hover:border-slate-300">
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
          {authed && store.request && <TeamReport tid={tid}/>}
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
                  onClick={() => (t.mine ? nav('people', { rank: t.id }) : r.canApply && nav('apply', { team: t.id, role: r.id }))}
                  disabled={!r.canApply && !t.mine}
                  className={cx(
                    'mt-[18px] h-[46px] w-full cursor-pointer rounded-[12px] border-0 text-[14px] font-bold hover:brightness-95',
                    r.canApply || t.mine ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {r.btnLabel}
                </button>
              </div>
            ))}
            {roles.length === 0 && <div className="rounded-[16px] bg-canvas p-5 text-[14px] text-slate-600">All roles are filled. This team is no longer recruiting.</div>}
          </div>
          <p className="mt-4 mb-0 text-[12px] leading-[1.55] text-slate-500">
            Contact details stay private. Consented contacts are shared with team members after acceptance.
          </p>
        </aside>
      </div>
      {m && <div aria-hidden="true" className="h-[79px]" />}
      {invitation && <section className="mx-auto box-border max-w-[1140px] px-5 pb-6"><div className="rounded-[14px] border border-card bg-white p-5"><h2 className="mt-0 text-[18px] font-extrabold">You're invited to join {t.name}</h2><label className="flex gap-3 text-[13px]"><input type="checkbox" checked={shareInvite} onChange={e=>setShareInvite(e.target.checked)}/>Share my contact after joining (profile sharing must also be enabled).</label><div className="mt-4 flex gap-3">{(['accept','decline'] as const).map(action=><button key={action} className="h-10 cursor-pointer rounded-[10px] border-0 bg-brand px-4 text-[14px] font-bold text-white" onClick={()=>{void store.request?.('/invitations/'+invitation.id+'/'+action,'POST',{share_contact:shareInvite}).then(()=>nav('toast','Invitation '+(action==='accept'?'accepted':'declined'))).catch(e=>nav('toast',e.message))}}>{action==='accept'?'Accept invitation':'Decline invitation'}</button>)}</div></div></section>}
      {(t.isMember || app?.status==='pending') && <div className={cx("mx-auto box-border max-w-[1140px] px-5",m?"pb-28":"pb-8")}>
        {app?.status==='pending' && <button className="h-10 cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 text-[14px] font-semibold text-danger" onClick={()=>{void store.request?.('/applications/'+app.id+'/withdraw','POST',{}).then(()=>nav('toast','Application withdrawn')).catch(e=>nav('toast',e.message))}}>Withdraw application</button>}
        {t.isMember && <MemberContacts tid={tid}/>}
      </div>}
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

function TeamReport({tid}:{tid:string}) {
 const store=useStore();const [notice,setNotice]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 return <details className="mt-6 rounded-[14px] border border-card bg-white p-5"><summary className="cursor-pointer text-[13px] font-bold text-slate-600">Report this team</summary><form className="mt-4 grid gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');setNotice('');void store.request!('/reports','POST',{team_id:tid,reason:String(f.get('reason'))}).then(()=>setNotice('Report submitted for moderation')).catch(e=>setError(e.message)).finally(()=>setBusy(false))}}><label className="text-[13px] font-bold">Report reason<textarea name="reason" required minLength={10} maxLength={2000} className="mt-2 box-border block h-24 w-full rounded-[10px] border border-field p-3 text-[14px]"/></label><button disabled={busy} className="h-10 cursor-pointer rounded-[10px] border-0 bg-brand px-4 text-[14px] font-bold text-white">Submit report</button>{notice&&<p role="status" className="m-0 text-[13px] text-success">{notice}</p>}{error&&<p role="alert" className="m-0 text-[13px] text-danger">{error}</p>}</form></details>;
}

function MemberContacts({tid}:{tid:string}) {
 const store=useStore();const nav=useNav();const [contacts,setContacts]=useState<{id:string;name:string;contact:string|null}[]>([]);
 return <section className="mt-6 rounded-[14px] border border-card bg-white p-5"><h2 className="mt-0 text-[18px] font-extrabold">Member contacts</h2><p className="text-[13px] text-slate-500">Only shared contacts are visible. Refresh for current consent.</p>
 <button className="h-10 cursor-pointer rounded-[10px] border-0 bg-brand px-4 text-[14px] font-bold text-white" onClick={()=>{void store.request?.<{id:string;name:string;contact:string|null}[]>('/teams/'+tid+'/contacts').then(setContacts).catch(e=>nav('toast',e.message))}}>Show / refresh contacts</button>
 {contacts.map(c=><p key={c.id} className="text-[14px]">{c.name}: {c.contact||'Contact not shared'}</p>)}
 <button className="ml-3 h-10 cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 text-[14px] font-semibold" onClick={()=>{void store.request?.('/teams/'+tid+'/connected','POST',{}).then(()=>nav('toast','Connection confirmed')).catch(e=>nav('toast',e.message))}}>We connected</button></section>
}
