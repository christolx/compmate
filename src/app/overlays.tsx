import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ALL_COMPETITIONS, PERSONS, SKILL_CATEGORY } from '../data/model';
import { NOTIFICATIONS, POPULAR_SEARCHES, TEAMS } from '../data/seed';
import { ApplySheet } from '../components/ApplySheet';
import { CheckIcon, Logo, SearchIcon } from '../components/icons';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';
import { useNav } from './nav';
import { useIsMobile } from './viewport';

interface OverlayProps {
  onClose: () => void;
}

/** Moves keyboard focus into a dialog when it opens. */
function useFocusOnOpen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return ref;
}

/** Command-palette search over competitions, skills and (signed in) people. */
export function SearchOverlay({ onClose }: OverlayProps) {
  const m = useIsMobile();
  const nav = useNav();
  const st = useAppState();
  const [sq, setSq] = useState('');
  const q = sq.trim().toLowerCase();
  const comps = (q ? ALL_COMPETITIONS.filter((c) => [c.title, c.org, c.cat, c.group].concat(c.skills).join(' ').toLowerCase().includes(q)) : ALL_COMPETITIONS.filter((c) => c.closing)).slice(0, 5);
  const skills = q
    ? Object.keys(SKILL_CATEGORY)
        .filter((k) => k.toLowerCase().includes(q))
        .slice(0, 3)
        .map((k) => {
          const n = TEAMS.filter((t) => t.roles.some((r) => r.skills.includes(k))).length;
          return { name: k, sub: n + ' team' + (n === 1 ? '' : 's') + ' looking for it · ' + SKILL_CATEGORY[k] };
        })
    : [];
  const people = q && st.authed ? Object.values(PERSONS).filter((p) => p.id !== 'me' && [p.name, p.program].concat(p.roles).join(' ').toLowerCase().includes(q)).slice(0, 3) : [];
  const nothing = !!q && !comps.length && !skills.length && !people.length;
  const heading = (text: string, first = false) => <div className={cx('text-[12px] font-bold text-slate-500', first ? 'px-2.5 pt-2.5 pb-1' : 'px-2.5 pt-1.5 pb-1')}>{text}</div>;
  const popular = (small: boolean) =>
    POPULAR_SEARCHES.map((label) => (
      <button
        key={label}
        type="button"
        onClick={() => nav('explore', { q: label })}
        className={cx('cursor-pointer rounded-full border border-slate-200 bg-white px-3 font-semibold text-slate-700', small ? 'h-[30px] text-[12px]' : 'h-8 text-[13px]')}
      >
        {label}
      </button>
    ));
  const row = 'flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-0 bg-transparent text-left hover:bg-canvas';

  return (
    <div onClick={onClose} className={cx('fixed inset-0 z-[35] flex animate-[cm-fade_.15s] justify-center bg-[rgba(15,23,42,.35)]', m ? 'p-0' : 'px-6 pt-[72px] pb-6')}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        className={cx('flex h-max max-h-full w-full max-w-[640px] animate-[cm-drop_.18s_ease-out] flex-col overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,.25)]', m ? 'rounded-none' : 'rounded-[16px]')}
      >
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            nav('explore', { q: sq.trim() });
          }}
          className="flex h-[60px] flex-none items-center gap-2.5 border-b border-divider px-4"
        >
          <SearchIcon size={19} stroke="#64748B" />
          <input
            autoFocus
            value={sq}
            onChange={(e) => setSq(e.target.value)}
            aria-label="Search"
            placeholder="Search competitions, skills, or categories"
            className="min-w-0 flex-1 border-0 text-[16px] font-medium text-ink outline-0"
          />
          <button type="button" onClick={onClose} className="h-7 cursor-pointer rounded-[6px] border-0 bg-slate-100 px-2 text-[12px] font-semibold text-slate-600">
            Esc
          </button>
        </form>
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-3">
          {!q && (
            <>
              {heading('Popular searches', true)}
              <div className="flex flex-wrap gap-1.5 px-2.5 pt-1 pb-3">{popular(false)}</div>
              {heading('Closing soon')}
            </>
          )}
          {comps.length > 0 && (
            <>
              {q && heading('Competitions', true)}
              {comps.map((c) => (
                <button key={c.id} type="button" onClick={() => nav('comp', c.id)} className={cx(row, 'px-2.5 py-2')}>
                  <span className="relative h-11 w-9 flex-none overflow-hidden rounded-[8px]" style={{ background: c.hueBg }}>
                    {c.hasPoster && <img src={c.poster} alt="" className="h-full w-full object-cover object-top" />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-bold text-ink">{c.title}</span>
                    <span className="block text-[12px] text-slate-500">
                      {c.org} · {c.cat} · closes {c.deadlineShort}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
          {skills.length > 0 && (
            <>
              {heading('Skills', true)}
              {skills.map((k) => (
                <button key={k.name} type="button" onClick={() => nav('explore', { q: k.name })} className={cx(row, 'p-2.5')}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-indigo-tint text-[13px] font-extrabold text-indigo">#</span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-bold text-ink">{k.name}</span>
                    <span className="block text-[12px] text-slate-500">{k.sub}</span>
                  </span>
                </button>
              ))}
            </>
          )}
          {people.length > 0 && (
            <>
              {heading('People', true)}
              {people.map((p) => (
                <button key={p.id} type="button" onClick={() => nav('profile', p.id)} className={cx(row, 'px-2.5 py-2')}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[12px] font-bold" style={{ background: p.bg, color: p.fg }}>
                    {p.initials}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-bold text-ink">{p.name}</span>
                    <span className="block text-[12px] text-slate-500">
                      {p.program} · {p.rolesLine}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
          {nothing && (
            <div className="px-4 py-7 text-center">
              <div className="text-[15px] font-bold text-ink">No results for “{sq}”</div>
              <div className="mt-1 text-[13px] text-slate-500">Try a category or a skill instead.</div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">{popular(true)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Demo sign-in: the sample account is prefilled, any action signs you in. */
export function LoginOverlay({ reason, onClose, onLogin }: OverlayProps & { reason?: string; onLogin: () => void }) {
  const m = useIsMobile();
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    onLogin();
  };
  const field = 'mt-1.5 box-border h-[46px] w-full rounded-[12px] border border-field px-3.5 text-[15px] font-medium text-ink';
  return (
    <div onClick={onClose} className={cx('fixed inset-0 z-40 flex animate-[cm-fade_.15s] justify-center bg-[rgba(15,23,42,.45)]', m ? 'items-end p-0' : 'items-center p-6')}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className={cx('box-border animate-[cm-sheet_.22s_ease-out] bg-white p-7 shadow-[0_30px_80px_rgba(15,23,42,.3)]', m ? 'w-full rounded-t-[20px]' : 'w-[420px] rounded-[20px]')}
      >
        <Logo size={36} />
        <h2 id="login-title" className="mt-4 mb-0 text-[22px] font-extrabold tracking-[-0.02em] text-ink">
          {reason ? 'Log in to ' + reason : 'Log in to CompMate'}
        </h2>
        <p className="mt-1.5 mb-0 text-[14px] leading-[1.5] text-slate-500">Browse competitions without an account. Log in when you're ready to build a team.</p>
        <label htmlFor="lg-email" className="mt-5 block text-[13px] font-bold text-ink">
          Email
        </label>
        <input id="lg-email" value="maya.putri@binus.ac.id" readOnly className={field} />
        <label htmlFor="lg-pw" className="mt-3.5 block text-[13px] font-bold text-ink">
          Password
        </label>
        <input id="lg-pw" type="password" value="password123" readOnly className={field} />
        <button type="submit" autoFocus className="mt-5 h-[50px] w-full cursor-pointer rounded-[12px] border-0 bg-brand text-[15px] font-bold text-white">
          Continue
        </button>
        <div className="mt-3.5 flex justify-between text-[13px]">
          <button type="button" onClick={() => submit()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-brand hover:text-brand-hover">
            Email me a code instead
          </button>
          <button type="button" onClick={() => submit()} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-brand hover:text-brand-hover">
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}

/** Notification dropdown anchored under the bell (sheet-style on mobile). */
export function NotificationsPanel({ onClose, position, onRead, onReadAll }: OverlayProps & { position: { top: number; right: number }; onRead: (id: string) => void; onReadAll: () => void }) {
  const m = useIsMobile();
  const nav = useNav();
  const st = useAppState();
  const ref = useFocusOnOpen<HTMLDivElement>();
  return (
    <div onClick={onClose} className={cx('fixed inset-0 z-[36]', m ? 'bg-[rgba(15,23,42,.35)]' : 'bg-transparent')}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-label="Notifications"
        onClick={(e) => e.stopPropagation()}
        className={cx('absolute max-h-[70%] outline-none animate-[cm-drop_.18s_ease-out] overflow-y-auto rounded-[16px] border border-card bg-white shadow-[0_24px_60px_rgba(15,23,42,.18)]', m ? 'right-3 left-3' : 'w-[400px]')}
        style={m ? { top: position.top } : { top: position.top, right: position.right }}
      >
        <div className="flex items-center justify-between px-[18px] pt-4 pb-2">
          <span className="text-[16px] font-extrabold text-ink">Notifications</span>
          <button type="button" onClick={onReadAll} className="cursor-pointer border-0 bg-transparent text-[13px] font-semibold text-brand">
            Mark all read
          </button>
        </div>
        {NOTIFICATIONS.map((n) => {
          const unread = !st.read.includes(n.id);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                onRead(n.id);
                if (n.go.to === 'manage') nav('manage');
                else nav(n.go.to, n.go.id);
              }}
              className={cx('flex w-full cursor-pointer gap-3 border-0 px-[18px] py-3 text-left hover:bg-canvas', unread ? 'bg-[#F8FAFF]' : 'bg-white')}
            >
              <span className={cx('mt-1.5 h-2 w-2 flex-none rounded-full', unread ? 'bg-brand' : 'bg-transparent')} />
              <span className="flex-1">
                <span className={cx('block text-[14px] leading-[1.45] text-ink', unread ? 'font-semibold' : 'font-medium')}>
                  {n.text}
                  {unread && <span className="sr-only"> (unread)</span>}
                </span>
                <span className="mt-0.5 block text-[12px] text-slate-500">{n.time}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Apply flow: centered modal on desktop, bottom sheet on mobile. */
export function ApplyOverlay({ team, role, onClose }: OverlayProps & { team: string; role: string }) {
  const m = useIsMobile();
  const ref = useFocusOnOpen<HTMLDivElement>();
  return (
    <div onClick={onClose} className={cx('fixed inset-0 z-30 flex animate-[cm-fade_.18s] justify-center bg-[rgba(15,23,42,.45)]', m ? 'items-end p-0' : 'items-center p-6')}>
      <div
        ref={ref}
        tabIndex={-1}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'max-h-full animate-[cm-sheet_.24s_ease-out] shadow-[0_30px_80px_rgba(15,23,42,.3)] outline-none',
          m ? 'h-[92%] w-full rounded-t-[20px]' : 'h-[min(720px,100%)] w-[540px] rounded-[20px]',
        )}
      >
        <ApplySheet tid={team} role={role} />
      </div>
    </div>
  );
}

export function Toast({ message, onUndo, mobile }: { message: string; onUndo?: () => void; mobile: boolean }) {
  return (
    <div
      className={cx(
        'fixed left-1/2 z-[60] box-border flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 animate-[cm-toast_.22s_ease-out] items-center gap-2.5 rounded-[12px] bg-ink px-4 py-3 text-[14px] font-medium text-white shadow-[0_12px_32px_rgba(15,23,42,.25)]',
        mobile ? 'bottom-[92px]' : 'bottom-6',
      )}
    >
      <CheckIcon size={16} stroke="#4ADE80" className="flex-none" />
      <span>{message}</span>
      {onUndo && (
        <button type="button" onClick={onUndo} className="ml-1.5 cursor-pointer border-0 bg-transparent p-0 text-[14px] font-bold text-[#93C5FD]">
          Undo
        </button>
      )}
    </div>
  );
}
