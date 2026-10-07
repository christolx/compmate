import { PERSONS } from '../data/model';
import { match, relevance } from '../data/matching';
import type { ConnState } from '../data/types';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useAppState } from '../store/store';
import { CheckIcon, CloseIcon } from './icons';

interface PersonTileProps {
  pid: string;
  /** people = Discover people card, rec = recommended teammate (reasons + invite), mini = compact row. */
  variant?: 'people' | 'rec' | 'mini';
  /** Team and role to rank against; without them the card ranks for the sample user. */
  tid?: string;
  rid?: string;
  /** Overrides the stored connection state (used by the design board). */
  conn?: ConnState;
  canInvite?: boolean;
}

const CONNECT_BUTTON: Record<'none' | 'sent' | 'connected', { label: string; bd: string; bg: string; fg: string }> = {
  none: { label: 'Connect', bd: '1px solid #BFD3FE', bg: '#FFFFFF', fg: '#1D4ED8' },
  sent: { label: 'Pending', bd: '1px solid #E2E8F0', bg: '#F8FAFC', fg: '#64748B' },
  connected: { label: 'Connected ✓', bd: '1px solid #E2E8F0', bg: '#FFFFFF', fg: '#15803D' },
};

export function PersonTile({ pid, variant = 'people', tid, rid, conn: connOverride, canInvite }: PersonTileProps) {
  const st = useAppState();
  const nav = useNav();
  const p = PERSONS[pid];
  const forTeam = !!(tid && rid);
  const teamMatch = forTeam ? match(p.id, tid, rid, st) : null;
  const m = teamMatch ?? relevance(p.id);
  const conn = connOverride || st.conns[p.id] || 'none';
  const invited = !!st.invites[p.id];
  const me = PERSONS.me;
  const need = new Set(teamMatch ? teamMatch.role.skills : me.skills.concat(me.cats));
  const skills = p.skills
    .slice()
    .sort((a, b) => Number(need.has(b)) - Number(need.has(a)))
    .slice(0, variant === 'rec' ? 4 : 3);
  const btn = CONNECT_BUTTON[conn === 'incoming' ? 'none' : conn];
  const connect = () => {
    if (conn === 'none') nav('connect', p.id);
    else if (conn === 'sent') nav('withdraw', p.id);
    else nav('profile', p.id);
  };
  const view = () => nav('profile', p.id);

  if (variant === 'mini') {
    return (
      <div className="flex items-center gap-3 py-3 font-sans">
        <button type="button" onClick={view} tabIndex={-1} className="grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-full border-0 text-[14px] font-bold" style={{ background: p.bg, color: p.fg }}>
          {p.initials}
        </button>
        <div className="min-w-0 flex-1">
          <AppLink to="profile" args={[p.id]} className="block cursor-pointer text-[14px] font-bold text-ink hover:text-ink">
            {p.name}
          </AppLink>
          <div className="truncate text-[12px] text-slate-500">{p.program + (p.mutual ? ' · ' + p.mutual + ' mutual' : '')}</div>
        </div>
        {conn === 'incoming' ? (
          <>
            <button type="button" onClick={() => nav('ignoreConn', p.id)} aria-label="Ignore" className="grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-[9px] border border-slate-200 bg-white text-slate-600">
              <CloseIcon size={14} sw={2.6} />
            </button>
            <button type="button" onClick={() => nav('acceptConn', p.id)} className="h-[34px] cursor-pointer rounded-[9px] border-0 bg-brand px-3 text-[12px] font-bold text-white">
              Accept
            </button>
          </>
        ) : (
          <button type="button" onClick={connect} className="h-[34px] flex-none cursor-pointer rounded-[9px] px-3 text-[12px] font-bold" style={{ border: btn.bd, background: btn.bg, color: btn.fg }}>
            {btn.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <article className="box-border flex h-full flex-col gap-3.5 rounded-[16px] border border-card bg-white p-5 font-sans transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,.06)]">
      <div className="flex items-start gap-3">
        <button type="button" onClick={view} tabIndex={-1} aria-label={`View ${p.name}`} className="grid h-12 w-12 flex-none cursor-pointer place-items-center rounded-full border-0 text-[16px] font-bold" style={{ background: p.bg, color: p.fg }}>
          {p.initials}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <AppLink to="profile" args={[p.id]} className="cursor-pointer text-[16px] font-bold text-ink hover:text-ink">
              {p.name}
            </AppLink>
            {conn === 'connected' && <span className="rounded-[5px] bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">1st</span>}
          </div>
          <div className="text-[13px] text-slate-600">{p.program}</div>
          <div className="mt-0.5 text-[12px] font-semibold text-slate-500">{p.rolesLine}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full px-[9px] text-[12px] font-bold" style={{ background: m.bg, color: m.fg }}>
          {m.label}
        </span>
        <span className="text-[12px] text-slate-600">{teamMatch ? 'for ' + teamMatch.role.name : 'for your interests'}</span>
      </div>
      {variant === 'rec' ? (
        <div className="flex flex-col gap-1.5">
          {m.reasons.slice(0, 5).map((text) => {
            const adds = /^Adds/.test(text);
            return (
              <div key={text} className="flex gap-2 text-[13px] leading-[1.4] text-ink-2">
                <CheckIcon size={13} stroke={adds ? '#0F766E' : '#4F46E5'} className="mt-0.5 flex-none" />
                <span className={adds ? 'font-bold' : 'font-medium'}>{text}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[13px] text-slate-700">{p.interests.join(' · ')}</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => {
          const hit = forTeam && need.has(s);
          return (
            <span key={s} className={'inline-flex h-[26px] items-center gap-1 rounded-[7px] px-[9px] text-[12px] font-semibold ' + (hit ? 'bg-indigo-tint text-indigo' : 'bg-[#F3F5F8] text-slate-700')}>
              {s}
            </span>
          );
        })}
      </div>
      {p.mutual > 0 && <div className="text-[12px] text-slate-500">{p.mutual + ' mutual connection' + (p.mutual > 1 ? 's' : '')}</div>}
      <div className="mt-auto flex gap-2">
        <button type="button" onClick={view} className="h-10 flex-1 cursor-pointer rounded-[10px] border border-slate-200 bg-white text-[13px] font-semibold text-ink hover:border-slate-300 hover:bg-slate-50">
          View profile
        </button>
        {(variant === 'rec' || (canInvite && forTeam)) && (
          <button
            type="button"
            onClick={() => !invited && tid && rid && nav('invite', { pid: p.id, tid, rid })}
            disabled={invited}
            className={'h-10 flex-1 cursor-pointer rounded-[10px] border-0 text-[13px] font-bold transition-[background-color] duration-200 ' + (invited ? 'bg-success-tint text-success' : 'bg-brand text-white')}
          >
            {invited ? 'Invited ✓' : 'Invite to team'}
          </button>
        )}
        {variant !== 'rec' &&
          (conn === 'incoming' ? (
            <>
              <button type="button" onClick={() => nav('ignoreConn', p.id)} className="h-10 cursor-pointer rounded-[10px] border-0 bg-transparent px-3 text-[13px] font-semibold text-slate-600">
                Ignore
              </button>
              <button type="button" onClick={() => nav('acceptConn', p.id)} className="h-10 flex-1 cursor-pointer rounded-[10px] border-0 bg-brand text-[13px] font-bold text-white">
                Accept
              </button>
            </>
          ) : (
            <button type="button" onClick={connect} className="h-10 flex-1 cursor-pointer rounded-[10px] text-[13px] font-bold transition-[background-color,color] duration-200" style={{ border: btn.bd, background: btn.bg, color: btn.fg }}>
              {btn.label}
            </button>
          ))}
      </div>
    </article>
  );
}
