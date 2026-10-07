import { comp } from '../data/model';
import { compsForMe } from '../data/matching';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';
import { BookmarkIcon, CheckIcon } from './icons';

const REASONS = new Map(compsForMe().map((x) => [x.id, x.reason]));

interface CompTileProps {
  cid: string;
  /** a = editorial grid card (chosen), b = energetic card (rejected), row = compact list row. */
  variant?: 'a' | 'b' | 'row';
  /** 16:10 poster instead of 4:3. */
  wide?: boolean;
  /** Show why it is recommended. */
  reason?: boolean;
  authed?: boolean;
}

export function CompTile({ cid, variant = 'a', wide, reason, authed }: CompTileProps) {
  const st = useAppState();
  const nav = useNav();
  const c = comp(cid);
  const saved = !!(authed || st.authed) && st.saved.includes(c.id);
  const reasonText = reason ? REASONS.get(c.id) || '' : '';
  const title = (
    <AppLink to="comp" args={[c.id]} className="stretched-link text-inherit hover:text-inherit">
      {c.title}
    </AppLink>
  );

  if (variant === 'row') {
    return (
      <article className="relative flex cursor-pointer items-center gap-3.5 border-b border-divider py-3.5 font-sans transition-[padding] duration-150 hover:pl-1">
        <div className="relative h-16 w-[52px] flex-none overflow-hidden rounded-[10px]" style={{ background: c.hueBg }}>
          {c.hasPoster ? (
            <img src={c.poster} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-[13px] font-extrabold" style={{ color: c.hueFg }}>
              {c.initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-ink">{title}</div>
          <div className="mt-0.5 truncate text-[13px] text-slate-500">
            {c.cat} · Team {c.teamShort} · {c.recruitLabel}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="text-[20px] leading-none font-extrabold tracking-[-0.02em]" style={{ color: c.dlFg }}>
            {c.leftNum}
          </div>
          <div className="mt-[3px] text-[11px] font-semibold text-slate-500">{c.leftUnit}</div>
        </div>
      </article>
    );
  }

  if (variant === 'b') {
    return (
      <article className="relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] border border-card bg-white font-sans transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-[3px] hover:border-[#C7D7FE] hover:shadow-[0_14px_30px_rgba(15,23,42,.10)]">
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: c.hueBg }}>
          {c.hasPoster ? (
            <img src={c.poster} alt={`${c.title} poster`} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : (
            <div className="poster-stripes absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-[14px] bg-white text-[18px] font-extrabold" style={{ color: c.hueFg }}>
                {c.initials}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-[linear-gradient(transparent,rgba(15,23,42,.78))]" />
          <span className="absolute top-3 left-3 inline-flex h-[26px] items-center rounded-full bg-white px-2.5 text-[12px] font-bold text-ink">{c.cat}</span>
          <div className="absolute bottom-3 left-3.5 text-white">
            <div className="text-[24px] leading-none font-extrabold tracking-[-0.02em]">{c.leftNum}</div>
            <div className="text-[12px] font-semibold opacity-90">{c.leftUnit} to register</div>
          </div>
        </div>
        <div className="px-4 pt-4">
          <h3 className="m-0 text-[18px] leading-[1.25] font-extrabold tracking-[-0.015em] text-ink">{title}</h3>
          <div className="mt-[3px] text-[13px] text-slate-500">{c.org}</div>
        </div>
        <div className="mx-4 mt-3.5 grid grid-cols-3 gap-2">
          <Fact label="Deadline" value={c.deadlineShort} color={c.dlFg} />
          <Fact label="Team" value={c.teamShort} />
          <Fact label="Format" value={c.loc} />
        </div>
        <div className="mt-4 flex items-center gap-2 bg-[#F3F6FF] px-4 py-3">
          <span className="flex pl-1.5">
            {c.faces.map((f) => (
              <span key={f.id} className="-ml-1.5 grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold shadow-[0_0_0_2px_#F3F6FF]" style={{ background: f.bg, color: f.fg }}>
                {f.initials}
              </span>
            ))}
          </span>
          <span className="flex-1 text-[13px] font-bold text-brand-deep">{c.recruitLabel}</span>
          <span className="text-[13px] font-bold text-brand">View →</span>
        </div>
      </article>
    );
  }

  return (
    <article className="relative flex cursor-pointer flex-col gap-3.5 font-sans transition-[translate] duration-200 ease-[ease] hover:-translate-y-[3px]">
      <div className={cx('relative overflow-hidden rounded-[14px] shadow-[0_0_0_1px_rgba(15,23,42,.06)]', wide ? 'aspect-[16/10]' : 'aspect-[4/3]')} style={{ background: c.hueBg }}>
        {c.hasPoster ? (
          <img src={c.poster} alt={`${c.title} poster`} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <div className="poster-stripes absolute inset-0 flex flex-col justify-between p-4">
            <span className="font-mono text-[11px] font-bold tracking-[.08em]" style={{ color: c.hueFg }}>
              {c.catUpper}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] bg-white text-[15px] font-extrabold" style={{ color: c.hueFg }}>
                {c.initials}
              </span>
              <span className="text-[12px] leading-[1.35] font-semibold" style={{ color: c.hueFg }}>
                {c.org}
              </span>
            </div>
          </div>
        )}
        {c.closing && (
          <span className="absolute top-3 left-3 inline-flex h-7 items-center gap-1.5 rounded-[8px] bg-white px-2.5 text-[12px] font-bold text-warning shadow-[0_2px_10px_rgba(15,23,42,.14)]">
            <span className="h-1.5 w-1.5 rounded-full bg-warning-dot" />
            Closing soon · <span>{c.leftLabel}</span>
          </span>
        )}
        {c.featuredOnly && (
          <span className="absolute top-3 left-3 inline-flex h-[26px] items-center rounded-[7px] bg-[rgba(15,23,42,.72)] px-[9px] text-[11px] font-bold tracking-[.02em] text-white">Featured</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nav('save', c.id);
          }}
          aria-label={saved ? 'Remove from saved' : 'Save competition'}
          aria-pressed={saved}
          className={cx(
            'absolute top-2.5 right-2.5 z-[1] grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-white/96 shadow-[0_2px_10px_rgba(15,23,42,.14)] transition-[scale] duration-150 hover:scale-[1.08] active:scale-[.85]',
            saved ? 'text-brand' : 'text-ink',
          )}
        >
          <BookmarkIcon size={17} fill={saved ? 'var(--color-brand)' : 'none'} className="transition-[fill] duration-200" />
        </button>
      </div>
      <div className="flex flex-col gap-[3px] px-0.5">
        <div className="text-[12px] font-bold text-brand">{c.cat}</div>
        <h3 className="m-0 line-clamp-2 text-[17px] leading-[1.3] font-bold tracking-[-0.01em] text-ink">{title}</h3>
        <div className="text-[13px] text-slate-500">{c.org}</div>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-slate-700">
          <span className="font-bold" style={{ color: c.dlFg }}>
            Closes {c.deadlineShort}
          </span>
          <span className="text-slate-300">·</span>
          <span>Team {c.teamShort}</span>
          <span className="text-slate-300">·</span>
          <span>{c.loc}</span>
        </div>
        {reasonText && (
          <div className="mt-2 flex gap-1.5 text-[12px] leading-[1.45] font-semibold text-indigo">
            <CheckIcon size={12} className="mt-0.5 flex-none" />
            {reasonText}
          </div>
        )}
        <div className="mt-3 flex min-h-6 items-center gap-2">
          {c.hasTeams ? (
            <>
              <span className="flex pl-0.5">
                {c.faces.map((f) => (
                  <span key={f.id} className="-ml-1.5 grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold shadow-[0_0_0_2px_#FFFFFF]" style={{ background: f.bg, color: f.fg }}>
                    {f.initials}
                  </span>
                ))}
              </span>
              <span className="text-[13px] font-bold text-ink">{c.recruitLabel}</span>
            </>
          ) : (
            <span className="text-[13px] text-slate-500">No teams yet · start the first one</span>
          )}
        </div>
      </div>
    </article>
  );
}

function Fact({ label, value, color = '#0F172A' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="text-[14px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
