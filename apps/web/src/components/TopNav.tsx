import { useEffect, useId, useRef, useState } from 'react';
import { NOTIFICATIONS } from '../data/seed';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';
import { BackIcon, BellIcon, BookmarkIcon, Logo, SearchIcon } from './icons';

export type TopNavActive = 'explore' | 'people' | 'teams' | '';

interface TopNavProps {
  authed: boolean;
  active: TopNavActive;
  /** Mobile only: replaces the logo with a back button and this title. */
  backTitle?: string;
}

export function TopNav({ authed, active, backTitle }: TopNavProps) {
  const mobile = useIsMobile();
  const nav = useNav();
  const st = useAppState();
  const hasUnread = authed && NOTIFICATIONS.some((n) => !st.read.includes(n.id));

  if (mobile) {
    return (
      <header data-topnav className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-line bg-header/96 pr-2 pl-4 font-sans backdrop-blur-[12px]">
        {backTitle ? (
          <>
            <button type="button" onClick={() => nav('back')} aria-label="Back" className="-ml-2.5 grid h-11 w-11 cursor-pointer place-items-center border-0 bg-transparent text-ink">
              <BackIcon size={22} />
            </button>
            <span className="flex-1 text-[16px] font-bold text-ink">{backTitle}</span>
          </>
        ) : (
          <AppLink to="home" className="flex flex-1 cursor-pointer items-center gap-2">
            <Logo size={26} />
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">
              Comp<span className="text-brand">Mate</span>
            </span>
          </AppLink>
        )}
        <button type="button" onClick={() => nav('search')} aria-label="Search" className="grid h-11 w-11 cursor-pointer place-items-center border-0 bg-transparent text-ink">
          <SearchIcon size={21} />
        </button>
        {authed ? (
          <>
          <button type="button" onClick={() => nav('notifications')} aria-label="Notifications" className="relative grid h-11 w-11 cursor-pointer place-items-center border-0 bg-transparent text-ink">
            <BellIcon size={21} />
            {hasUnread && <span className="absolute top-[11px] right-3 h-2 w-2 rounded-full bg-brand shadow-[0_0_0_2px_#FFFFFF]" />}
          </button>
          <AccountMenu />
          </>
        ) : (
          <button type="button" onClick={() => nav('login')} className="h-9 cursor-pointer rounded-[9px] border-0 bg-ink px-3.5 text-[13px] font-semibold text-white">
            Log in
          </button>
        )}
      </header>
    );
  }

  const links: { key: string; label: string; link: 'explore' | 'people' | 'manage' | 'how' }[] = authed
    ? [
        { key: 'explore', label: 'Explore', link: 'explore' },
        { key: 'people', label: 'People', link: 'people' },
        { key: 'teams', label: 'My Teams', link: 'manage' },
      ]
    : [
        { key: 'explore', label: 'Explore', link: 'explore' },
        { key: 'how', label: 'How it works', link: 'how' },
      ];

  return (
    <header data-topnav className="sticky top-0 z-20 border-b border-line bg-header/94 font-sans backdrop-blur-[12px]">
      <div className="mx-auto flex h-[68px] max-w-[1280px] items-center gap-6 px-8">
        <AppLink to="home" className="flex cursor-pointer items-center gap-2.5">
          <Logo size={30} />
          <span className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">
            Comp<span className="text-brand">Mate</span>
          </span>
        </AppLink>
        <nav className="flex gap-0.5">
          {links.map((l) => {
            const on = active === l.key;
            return (
              <AppLink
                key={l.key}
                to={l.link}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex h-[68px] cursor-pointer items-center px-3 text-[14px] font-semibold whitespace-nowrap transition-colors duration-150 hover:text-ink',
                  on ? 'text-ink shadow-[inset_0_-2px_0_var(--color-brand)]' : 'text-slate-500',
                )}
              >
                {l.label}
              </AppLink>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => nav('search')}
          className="ml-auto flex h-10 min-w-0 flex-[0_1_360px] cursor-pointer items-center gap-2.5 rounded-[10px] border border-card bg-header-field px-3 text-left text-[14px] font-medium text-slate-500 transition-[border-color,background-color] duration-150 hover:border-slate-300 hover:bg-white"
        >
          <SearchIcon size={16} />
          <span className="flex-1 truncate">Search competitions, skills, people</span>
          <span className="rounded-[5px] border border-slate-200 bg-white px-1.5 py-px font-mono text-[11px] font-semibold text-slate-400">/</span>
        </button>
        {authed ? (
          <div className="flex items-center gap-1">
            <AppLink to="saved" aria-label="Saved" className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] text-slate-700 hover:bg-slate-100 hover:text-slate-700">
              <BookmarkIcon size={19} />
            </AppLink>
            <button type="button" onClick={() => nav('notifications')} aria-label="Notifications" className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent text-slate-700 hover:bg-slate-100">
              <BellIcon size={19} />
              {hasUnread && <span className="absolute top-[9px] right-2.5 h-2 w-2 rounded-full bg-brand shadow-[0_0_0_2px_#FFFFFF]" />}
            </button>
            <AccountMenu />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => nav('login')} className="h-10 cursor-pointer rounded-[10px] border-0 bg-transparent px-3.5 text-[14px] font-semibold whitespace-nowrap text-ink hover:bg-slate-100">
              Log in
            </button>
            <button type="button" onClick={() => nav('login')} className="h-10 cursor-pointer rounded-[10px] border-0 bg-ink px-4 text-[14px] font-semibold whitespace-nowrap text-white hover:bg-ink-2">
              Sign up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function AccountMenu() {
  const nav = useNav();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative ml-1.5" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        ref={trigger}
        type="button"
        aria-label="Account options"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-brand text-[12px] font-bold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        MP
      </button>
      {open && (
        <div id={id} className="absolute top-full right-0 z-30 mt-2 w-[200px] rounded-[14px] border border-card bg-white p-1.5 shadow-[0_12px_32px_rgba(24,32,56,.14)]">
          <div className="border-b border-line px-3 py-2.5">
            <div className="text-[14px] font-bold text-ink">Maya</div>
            <div className="mt-1 text-[12px] text-slate-500">Sample account</div>
          </div>
          <AppLink to="profile" args={['me']} onClick={() => setOpen(false)} className="mt-1 block rounded-[8px] px-3 py-3 text-[14px] font-semibold text-ink hover:bg-canvas hover:text-ink">
            Profile
          </AppLink>
          <button type="button" onClick={() => {
            setOpen(false);
            nav('logout');
          }} className="box-border w-full cursor-pointer rounded-[8px] border-0 bg-transparent px-3 py-3 text-left text-[14px] font-semibold text-danger hover:bg-canvas">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
