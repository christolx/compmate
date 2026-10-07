import { useEffect, useId, useRef, useState } from 'react';
import { PERSONS, SKILL_CATEGORY, TEAM_BY_ID, team } from '../data/model';
import { bestFor, match } from '../data/matching';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';
import { CheckIcon, CloseIcon } from './icons';

/** Why an application cannot be sent (validation states from the brief). */
export type ApplyBlock = 'member' | 'applied' | 'full' | 'closed';

interface ApplySheetProps {
  tid: string;
  /** Role to preselect; defaults to the best match for the sample user. */
  role?: string;
  block?: ApplyBlock;
  /** Start on the success state (design board). */
  sent?: boolean;
}

const QUICK_ADDS = ['Available on weekends', "I've pitched before", 'Happy to rehearse'];

export function ApplySheet({ tid, role: initialRole, block, sent: initialSent = false }: ApplySheetProps) {
  const mobile = useIsMobile();
  const st = useAppState();
  const nav = useNav();
  const msgId = useId();
  const [roleId, setRoleId] = useState(initialRole ?? null);
  const [msg, setMsg] = useState('');
  const [shareLinkedIn, setShareLinkedIn] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(initialSent);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const t = team(tid, st);
  const rid = roleId ?? bestFor('me', t.id, st)?.role.id ?? t.roleList[0]?.id;
  const role = t.roleList.find((r) => r.id === rid) || t.roleList[0] || TEAM_BY_ID[t.id].roles[0];
  const m = match('me', t.id, role.id, st);
  const mine = PERSONS.me.skills;
  const relevant = role.skills
    .filter((k) => mine.includes(k))
    .concat(mine.filter((k) => !role.skills.includes(k) && SKILL_CATEGORY[k] && role.skills.some((x) => SKILL_CATEGORY[x] === SKILL_CATEGORY[k])))
    .slice(0, 5);
  const blocked = block && BLOCKS[block](t.name, t.leaderFirst);
  const title = 'Join ' + t.name;

  const send = () => {
    setSending(true);
    timer.current = setTimeout(() => {
      setSending(false);
      setSent(true);
      nav('applied', { team: t.id, role: role.id });
    }, 650);
  };

  const pad = {
    head: mobile ? 'px-5 pt-4' : 'px-7 pt-[26px]',
    body: mobile ? 'px-5 pt-[18px] pb-2' : 'px-7 pt-5 pb-2',
    foot: mobile ? 'px-5 pt-3 pb-5' : 'px-7 pt-4 pb-6',
  };

  return (
    <div role="dialog" aria-label={title} className={cx('box-border flex h-full flex-col overflow-hidden bg-white font-sans text-ink', mobile ? 'rounded-t-[20px]' : 'rounded-[20px]')}>
      {mobile && <div className="mx-auto mt-2.5 h-1 w-9 flex-none rounded-[2px] bg-slate-300" />}
      {!sent ? (
        <>
          <div className={cx('flex flex-none items-start gap-3.5', pad.head)}>
            <div className="min-w-0 flex-1">
              <div className="mb-3.5 flex pl-1.5">
                {t.slots.map((s, i) => (
                  <span key={i} className="-ml-1.5 box-border grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold shadow-[0_0_0_2px_#FFFFFF]" style={{ background: s.bg, color: s.fg, border: s.border }}>
                    {s.text}
                  </span>
                ))}
              </div>
              <h2 className="m-0 text-[24px] font-extrabold tracking-[-0.025em]">{title}</h2>
              <div className="mt-[3px] text-[14px] text-slate-500">{t.c.title}</div>
            </div>
            <button type="button" onClick={() => nav('closeApply')} aria-label="Close" className="grid h-9 w-9 flex-none cursor-pointer place-items-center rounded-[10px] border-0 bg-slate-100 text-slate-700">
              <CloseIcon size={16} sw={2.4} />
            </button>
          </div>
          <div className={cx('flex-1 overflow-y-auto', pad.body)}>
            {blocked ? (
              <div role="alert" className="rounded-[12px] px-4 py-3.5 text-[14px] leading-[1.5]" style={{ background: blocked.bg, color: blocked.fg }}>
                <strong>{blocked.title}</strong> {blocked.body}
              </div>
            ) : (
              <>
                <div className="text-[13px] font-semibold text-slate-500">You're applying as</div>
                {t.roleList.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.roleList.map((r) => {
                      const on = r.id === role.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRoleId(r.id)}
                          aria-pressed={on}
                          className={cx('h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold', on ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-700')}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[14px] border border-match-line bg-match px-4 py-3.5">
                  <div>
                    <div className="text-[18px] font-extrabold">{role.name}</div>
                    <div className="text-[13px] text-slate-600">{role.note}</div>
                  </div>
                  {m.kind && (
                    <span className="inline-flex h-6 flex-none items-center rounded-full px-[9px] text-[12px] font-bold" style={{ background: m.bg, color: m.fg }}>
                      {m.label}
                    </span>
                  )}
                </div>
                <div className="mt-[22px] flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-slate-500">Relevant skills from your profile</span>
                  <AppLink to="profile" args={['me']} className="cursor-pointer text-[12px] font-semibold">
                    Edit profile
                  </AppLink>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {relevant.map((k) => {
                    const on = role.skills.includes(k);
                    return (
                      <span key={k} className={cx('inline-flex h-[30px] items-center gap-[5px] rounded-[8px] px-[11px] text-[13px] font-semibold', on ? 'bg-indigo-tint text-indigo' : 'bg-[#F3F5F8] text-slate-700')}>
                        {on && <CheckIcon size={11} sw={3.4} />}
                        {k}
                      </span>
                    );
                  })}
                </div>
                <label htmlFor={msgId} className="mt-[22px] block text-[14px] font-bold">
                  Message to the team <span className="font-medium text-slate-500">(optional)</span>
                </label>
                <textarea
                  id={msgId}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="Hi! I'd like to join because…"
                  className="mt-2 box-border w-full resize-none rounded-[12px] border border-field px-3.5 py-3 text-[15px] leading-[1.5] font-normal text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_4px_#DBEAFE]"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {QUICK_ADDS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setMsg((cur) => ((cur ? cur.trim() + ' ' : '') + label + '.').slice(0, 300))}
                      className="h-7 cursor-pointer rounded-full border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-semibold text-slate-600 hover:border-brand hover:text-brand-hover"
                    >
                      + {label}
                    </button>
                  ))}
                  <span className="ml-auto text-[12px] text-slate-400">{msg.length}/300</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shareLinkedIn}
                  onClick={() => setShareLinkedIn((v) => !v)}
                  className="mt-5 flex w-full cursor-pointer items-center gap-3 border-0 border-t border-solid border-hairline bg-transparent px-0 py-3 text-left"
                >
                  <span className="flex-1">
                    <span className="block text-[14px] font-semibold text-ink">Share my LinkedIn</span>
                    <span className="block text-[12px] text-slate-500">Your email, phone number and student ID stay private.</span>
                  </span>
                  <span className={cx('relative h-6 w-10 flex-none rounded-[12px] transition-[background-color] duration-200', shareLinkedIn ? 'bg-brand' : 'bg-slate-300')}>
                    <span className={cx('absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200', shareLinkedIn ? 'left-[19px]' : 'left-[3px]')} />
                  </span>
                </button>
              </>
            )}
          </div>
          <div className={cx('flex flex-none gap-2 border-t border-hairline', pad.foot)}>
            <button
              type="button"
              onClick={() => nav('closeApply')}
              className={cx('h-[50px] cursor-pointer rounded-[12px] border-0 bg-slate-100 px-[18px] text-[14px] font-bold text-ink', blocked ? 'flex-1' : 'flex-[0_0_auto]')}
            >
              {blocked ? 'Close' : 'Cancel'}
            </button>
            {!blocked && (
              <button type="button" onClick={send} disabled={sending} className="flex h-[50px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border-0 bg-brand text-[15px] font-bold text-white hover:bg-brand-hover">
                {sending && <span className="box-border h-4 w-4 animate-[cm-spin_.7s_linear_infinite] rounded-full border-2 border-white/40 border-t-white" />}
                {sending ? 'Sending…' : 'Send application'}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className={cx('flex-1 overflow-y-auto text-center', mobile ? 'px-6 pt-9 pb-5' : 'px-8 pt-11 pb-5')}>
            <div className="mx-auto grid h-[68px] w-[68px] animate-[cm-pop_.45s_ease-out] place-items-center rounded-full bg-success-tint">
              <CheckIcon size={30} stroke="#15803D" />
            </div>
            <h2 className="mt-[18px] mb-0 text-[26px] font-extrabold tracking-[-0.025em]">Application sent</h2>
            <p className="mx-auto mt-2 mb-0 max-w-[360px] text-[15px] leading-[1.55] text-slate-600">
              Your application is now waiting for the team leader. {t.leaderFirst} usually replies within a few days.
            </p>
            <div className="mx-auto mt-[26px] grid max-w-[380px] grid-cols-3 gap-2 text-center">
              {[
                { label: 'Sent', done: true, cur: true },
                { label: t.leaderFirst + ' reviews', done: false, cur: true },
                { label: 'You join ' + t.name, done: false, cur: false },
              ].map((sp) => (
                <div key={sp.label}>
                  <div className="h-1 rounded-[2px]" style={{ background: sp.done ? '#22C55E' : sp.cur ? '#BFD3FE' : '#E2E8F0' }} />
                  <div className="mt-2 text-[12px]" style={{ fontWeight: sp.done || sp.cur ? 700 : 500, color: sp.done ? '#15803D' : sp.cur ? '#1D4ED8' : '#94A3B8' }}>
                    {sp.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-[26px] mb-0 max-w-[380px] text-[13px] leading-[1.55] text-slate-500">
              You can still apply to other teams for this competition. If you join one, your other applications for it are withdrawn automatically.
            </p>
          </div>
          <div className={cx('flex flex-none gap-2 border-t border-hairline', pad.foot)}>
            <button type="button" onClick={() => nav('home')} className="h-[50px] flex-1 cursor-pointer rounded-[12px] border-0 bg-slate-100 text-[14px] font-bold text-ink">
              See my applications
            </button>
            <button type="button" onClick={() => nav('closeApply')} className="h-[50px] flex-1 cursor-pointer rounded-[12px] border-0 bg-brand text-[14px] font-bold text-white">
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const BLOCKS: Record<ApplyBlock, (team: string, leader: string) => { bg: string; fg: string; title: string; body: string }> = {
  member: (team) => ({ bg: '#FEF2F2', fg: '#991B1B', title: 'You are already a member of another team for this competition.', body: `Leave that team first if you want to join ${team}.` }),
  applied: (_team, leader) => ({ bg: '#FFFBEB', fg: '#92400E', title: 'This application has already been submitted.', body: `${leader} hasn't replied yet.` }),
  full: () => ({ bg: '#F1F5F9', fg: '#334155', title: 'This team has reached its member target.', body: 'Try another team for this competition.' }),
  closed: () => ({ bg: '#F1F5F9', fg: '#334155', title: 'Registration has closed.', body: 'Teams for this competition are no longer accepting applications.' }),
};
