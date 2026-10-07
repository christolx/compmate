import { useState } from 'react';
import { cx } from '../lib/cx';

interface DemoDockProps {
  path: string;
  authed: boolean;
  /** The phone preview is only offered on wide screens. */
  canPreviewPhone: boolean;
  phonePreview: boolean;
  /** Lift above the mobile tab bar. */
  liftForTabBar: boolean;
  onToggleAuth: () => void;
  onReset: () => void;
  onPhonePreview: (on: boolean) => void;
}

/** Prototype controls (sign in as the sample user, reset, phone preview). */
export function DemoDock({ path, authed, canPreviewPhone, phonePreview, liftForTabBar, onToggleAuth, onReset, onPhonePreview }: DemoDockProps) {
  const [open, setOpen] = useState(false);
  const btn = 'h-8 cursor-pointer rounded-[8px] border border-slate-700 bg-transparent px-3 text-[12px] font-semibold whitespace-nowrap text-slate-200';
  return (
    <div className={cx('fixed left-4 z-[70] flex flex-col items-start font-sans', liftForTabBar ? 'bottom-[84px]' : 'bottom-4')}>
      {open && (
        <div id="demo-dock" className="mb-2 box-border w-[300px] max-w-[calc(100vw-32px)] rounded-[14px] bg-ink p-3.5 text-[13px] text-slate-300 shadow-[0_20px_50px_rgba(15,23,42,.35)]">
          <div className="font-mono text-[11px] font-bold tracking-[.06em] text-white">COMPMATE · PROTOTYPE R3</div>
          <div className="mt-1 truncate font-mono text-[12px] text-slate-500">{path}</div>
          {canPreviewPhone && (
            <div className="mt-3 flex rounded-[8px] bg-ink-2 p-[3px]">
              {(
                [
                  [false, 'Desktop'],
                  [true, 'Mobile 390'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onPhonePreview(v)}
                  aria-pressed={phonePreview === v}
                  className={cx('h-7 flex-1 cursor-pointer rounded-[6px] border-0 text-[12px] font-semibold', phonePreview === v ? 'bg-white text-ink' : 'bg-transparent text-slate-300')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={onToggleAuth} className={cx(btn, 'mt-2 w-full')}>
            {authed ? 'Logged in as Maya (sample user)' : 'Visitor · not logged in'}
          </button>
          <button type="button" onClick={onReset} className={cx(btn, 'mt-2 w-full')}>
            Reset demo
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="demo-dock"
        aria-label={`Prototype controls · ${authed ? 'signed in as Maya' : 'visitor'}`}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-full border-0 bg-ink pr-3.5 pl-3 text-[12px] font-semibold text-white shadow-[0_8px_24px_rgba(15,23,42,.3)]"
      >
        <span className="h-2 w-2 rounded-full" style={{ background: authed ? '#22C55E' : '#94A3B8' }} />
        {liftForTabBar ? 'Demo' : `Prototype · ${authed ? 'Maya' : 'Visitor'}`}
      </button>
    </div>
  );
}
