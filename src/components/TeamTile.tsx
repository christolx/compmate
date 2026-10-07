import { team } from '../data/model';
import { bestFor } from '../data/matching';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useAppState } from '../store/store';
import { CheckIcon } from './icons';

interface TeamTileProps {
  tid: string;
  /** b = people-first card (chosen), rec = card with reasons and Apply, a = editorial row (rejected). */
  variant?: 'b' | 'rec' | 'a';
  showComp?: boolean;
  authed?: boolean;
}

export function TeamTile({ tid, variant = 'b', showComp, authed }: TeamTileProps) {
  const st = useAppState();
  const nav = useNav();
  const t = team(tid, st);
  const name = (
    <AppLink to="team" args={[t.id]} className="stretched-link text-inherit hover:text-inherit">
      {t.name}
    </AppLink>
  );

  if (variant === 'a') {
    return (
      <article className="relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-divider px-1 py-[18px] font-sans hover:bg-[#FAFBFD]">
        <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-ink text-[17px] font-extrabold text-white">{t.initial}</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-bold text-ink">{name}</span>
            <span className="text-[12px] font-semibold" style={{ color: t.statusFg }}>
              {t.statusLabel}
            </span>
          </div>
          <div className="mt-0.5 text-[14px] text-ink-2">Looking for {t.roleNames}</div>
          <div className="mt-0.5 text-[13px] text-slate-500">{t.skillsLine}</div>
        </div>
        <div className="text-right">
          <div className="flex justify-end gap-1">
            {t.segs.map((g, i) => (
              <span key={i} className="h-2 w-2 rounded-full" style={{ background: g.bg }} />
            ))}
          </div>
          <div className="mt-1.5 text-[13px] font-bold text-ink">
            {t.filled} / {t.target}
          </div>
        </div>
      </article>
    );
  }

  const m = (authed || st.authed) && !t.isMember && t.roleList.length ? bestFor('me', t.id, st) : null;
  const rec = variant === 'rec' && m;

  return (
    <article className="relative box-border flex h-full cursor-pointer flex-col gap-4 rounded-[16px] border border-card bg-white p-5 font-sans transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-[#BFD3FE] hover:shadow-[0_12px_28px_rgba(15,23,42,.07)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center pl-2">
          {t.slots.map((s, i) => (
            <span key={i} className="-ml-2 box-border grid h-10 w-10 place-items-center rounded-full text-[13px] font-bold shadow-[0_0_0_3px_#FFFFFF]" style={{ background: s.bg, color: s.fg, border: s.border }}>
              {s.text}
            </span>
          ))}
        </div>
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold" style={{ background: t.statusBg, color: t.statusFg }}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t.statusLabel}
        </span>
      </div>
      <div>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h3 className="m-0 text-[19px] font-extrabold tracking-[-0.02em] text-ink">{name}</h3>
          <span className="text-[13px] font-semibold text-slate-600">{t.sizeLabel}</span>
        </div>
        {showComp && <div className="mt-[3px] truncate text-[13px] text-slate-500">{t.c.title}</div>}
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-[12px] font-semibold text-slate-500">Looking for</div>
        <div className="flex flex-wrap gap-1.5">
          {t.roleList.map((r) => (
            <span key={r.id} className="inline-flex h-7 items-center rounded-[8px] bg-brand-tint px-2.5 text-[13px] font-bold text-brand-hover">
              {r.name}
            </span>
          ))}
        </div>
        <div className="text-[13px] leading-[1.5] text-slate-600">{t.skillsLine}</div>
      </div>
      {m?.kind && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-full px-[9px] text-[12px] font-bold" style={{ background: m.bg, color: m.fg }}>
            {m.label}
          </span>
          {!rec && <span className="text-[12px] text-slate-600">{m.short}</span>}
        </div>
      )}
      {rec && (
        <div className="rounded-[12px] bg-[#F7F7FE] p-3.5">
          <div className="mb-2 text-[12px] font-bold text-indigo">Why this matches you</div>
          <div className="flex flex-col gap-1.5">
            {rec.reasons.slice(0, 4).map((w) => (
              <div key={w} className="flex gap-2 text-[13px] leading-[1.4] text-ink-2">
                <CheckIcon size={13} stroke="#4F46E5" className="mt-0.5 flex-none" />
                {w}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-hairline pt-3.5">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: t.eligFg }}>
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: t.eligDot }} />
          {t.eligText}
        </span>
        {rec ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nav('apply', { team: t.id, role: rec.role.id });
            }}
            className="relative z-[1] h-9 flex-none cursor-pointer rounded-[10px] border-0 bg-brand px-3.5 text-[13px] font-bold text-white hover:bg-brand-hover"
          >
            Apply
          </button>
        ) : (
          <span className="flex-none text-[13px] font-bold text-brand">View team →</span>
        )}
      </div>
    </article>
  );
}
