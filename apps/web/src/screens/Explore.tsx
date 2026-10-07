import { useEffect, useRef, useState } from 'react';
import { ALL_COMPETITIONS, type CompetitionView } from '../data/model';
import { GROUPS, POPULAR_SEARCHES } from '../data/seed';
import { useNav } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { BottomNav } from '../components/BottomNav';
import { CompTile } from '../components/CompTile';
import { CheckIcon, ChevronDownIcon, CloseIcon, FiltersIcon, SearchIcon } from '../components/icons';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';

type FilterKey = 'dl' | 'size' | 'fmt' | 'fee';
type Sort = 'rec' | 'deadline' | 'teams' | 'new';

interface FilterOption { value: string; label: string; test: (c: CompetitionView) => boolean }

const FILTERS: Record<FilterKey, { title: string; opts: FilterOption[] }> = {
  dl: {
    title: 'Deadline',
    opts: [
      { value: 'week', label: 'This week', test: (c) => c.left <= 7 },
      { value: '2w', label: 'Next 2 weeks', test: (c) => c.left <= 14 },
      { value: 'month', label: 'This month', test: (c) => c.left <= 31 },
    ],
  },
  size: {
    title: 'Team size',
    opts: [
      { value: 'solo', label: 'Solo allowed', test: (c) => c.part === 'either' },
      { value: '2-3', label: '2–3 people', test: (c) => c.max <= 3 && c.max >= 2 },
      { value: '4+', label: 'Up to 4–5', test: (c) => c.max >= 4 },
    ],
  },
  fmt: {
    title: 'Format',
    opts: [
      { value: 'Online', label: 'Online', test: (c) => c.loc === 'Online' },
      { value: 'Offline', label: 'Offline', test: (c) => c.loc === 'Offline' },
      { value: 'Hybrid', label: 'Hybrid', test: (c) => c.loc === 'Hybrid' },
    ],
  },
  fee: {
    title: 'Fee',
    opts: [
      { value: 'free', label: 'Free', test: (c) => c.free },
      { value: 'paid', label: 'Paid', test: (c) => !c.free },
    ],
  },
};
const FILTER_KEYS = Object.keys(FILTERS) as FilterKey[];

const SORTS: Record<Sort, (a: CompetitionView, b: CompetitionView) => number> = {
  rec: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.teamsCount - a.teamsCount,
  deadline: (a, b) => a.left - b.left,
  teams: (a, b) => b.teamsCount - a.teamsCount,
  new: (a, b) => (a.open < b.open ? 1 : -1),
};

interface Query {
  q: string;
  cat: string;
  filters: Partial<Record<FilterKey, string>>;
  sort: Sort;
}

interface ExploreProps {
  mode?: 'all' | 'saved';
  /** Initial search and category, e.g. from Discover. */
  q?: string;
  cat?: string;
  /** Start with the mobile filter sheet open (design board). */
  sheet?: boolean;
  authed?: boolean;
}

export function Explore({ mode = 'all', q: initialQ = '', cat: initialCat = 'All', sheet: initialSheet = false, authed: authedProp }: ExploreProps) {
  const st = useAppState();
  const authed = authedProp ?? st.authed;
  const m = useIsMobile();
  const nav = useNav();
  const saved = mode === 'saved';
  const [query, setQuery] = useState<Query>({ q: initialQ, cat: initialCat, filters: {}, sort: saved ? 'deadline' : 'rec' });
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(initialSheet);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!openFilter && !sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenFilter(null);
      setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openFilter, sheetOpen]);

  /** Every change shows a short skeleton, like a real results fetch. */
  const update = (patch: Partial<Query>) => {
    setQuery((cur) => ({ ...cur, ...patch }));
    setOpenFilter(null);
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoading(false), 260);
  };
  const clearAll = () => update({ q: '', cat: 'All', filters: {} });

  const all = ALL_COMPETITIONS.filter((c) => !saved || st.saved.includes(c.id));
  const q = query.q.trim().toLowerCase();
  const textOk = (c: CompetitionView) => !q || [c.title, c.org, c.cat, c.group].concat(c.skills).join(' ').toLowerCase().includes(q);
  const option = (k: FilterKey) => FILTERS[k].opts.find((o) => o.value === query.filters[k])!;
  const pass = (c: CompetitionView, skip?: 'cat') =>
    textOk(c) && (query.cat === 'All' || c.group === query.cat || skip === 'cat') && FILTER_KEYS.every((k) => !query.filters[k] || option(k).test(c));
  const results = all.filter((c) => pass(c)).sort(SORTS[query.sort]);

  // Active search, category and filters, each removable as a chip.
  const chips: { key: 'q' | 'cat' | FilterKey; label: string }[] = [];
  if (q) chips.push({ key: 'q', label: '“' + query.q.trim() + '”' });
  if (query.cat !== 'All') chips.push({ key: 'cat', label: query.cat });
  for (const k of FILTER_KEYS) if (query.filters[k]) chips.push({ key: k, label: option(k).label });
  const removeChip = (key: 'q' | 'cat' | FilterKey) => {
    if (key === 'q') update({ q: '' });
    else if (key === 'cat') update({ cat: 'All' });
    else update({ filters: { ...query.filters, [key]: undefined } });
  };

  const n = results.length;
  const countLabel = n + (n === 1 ? ' competition' : ' competitions');
  const nothingSaved = saved && !all.length;
  const sub = saved
    ? all.length
      ? all.length + ' saved · we remind you before registration closes'
      : 'Competitions you save show up here.'
    : all.filter((c) => !c.upcoming).length + ' competitions open for registration · ' + all.reduce((a, c) => a + c.teamsCount, 0) + ' teams recruiting';
  const cols = m ? 'grid-cols-[repeat(auto-fill,minmax(300px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(268px,1fr))]';
  const pick = (k: FilterKey, value: string) => update({ filters: { ...query.filters, [k]: query.filters[k] === value ? undefined : value } });

  return (
    <div data-screen-label={saved ? 'Saved' : 'Explore'} className="relative min-h-full bg-canvas font-sans text-ink">
      <TopNav authed={authed} active={saved ? '' : 'explore'} />
      <div className={cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-5' : 'px-8 pt-10')}>
        <h1 className={cx('m-0 font-extrabold tracking-[-0.03em]', m ? 'text-[26px]' : 'text-[34px]')}>{saved ? 'Saved' : 'Explore competitions'}</h1>
        <p className="mt-1.5 mb-0 text-[15px] text-slate-500">{sub}</p>
        {!saved && (
          <label className="mt-5 flex h-[52px] max-w-[640px] items-center gap-2.5 rounded-[14px] border border-field bg-white px-4 text-slate-500 focus-within:border-[#93C5FD]">
            <SearchIcon size={19} />
            <input
              value={query.q}
              onChange={(e) => update({ q: e.target.value })}
              aria-label="Search competitions"
              placeholder="Search competitions, organizers, skills..."
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-ink outline-0"
            />
            {q && (
              <button type="button" onClick={() => update({ q: '' })} aria-label="Clear search" className="grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-full border-0 bg-slate-100 text-slate-600">
                <CloseIcon size={12} sw={3} />
              </button>
            )}
          </label>
        )}
        <div className={cx('mt-5 flex overflow-x-auto border-b border-line', m ? '-mx-5 gap-5 px-5' : 'gap-7')}>
          {['All', ...GROUPS].map((g) => {
            const on = query.cat === g;
            const count = all.filter((c) => pass(c, 'cat') && (g === 'All' || c.group === g)).length;
            return (
              <button
                key={g}
                type="button"
                onClick={() => update({ cat: g })}
                aria-pressed={on}
                className={cx(
                  'h-[46px] flex-none cursor-pointer border-0 bg-transparent px-0.5 text-[14px] font-semibold whitespace-nowrap transition-colors duration-150',
                  on ? 'text-ink shadow-[inset_0_-2px_0_#0F172A]' : 'text-slate-500',
                )}
              >
                {g}
                <span className="ml-[5px] text-[12px] font-semibold text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cx('sticky z-10 bg-white/96 backdrop-blur-[10px]', m ? 'top-14' : 'top-[68px]')}>
        <div className={cx('mx-auto box-border flex max-w-[1280px] flex-wrap items-center gap-2 py-3', m ? 'px-5' : 'px-8')}>
          {m ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className={cx('flex h-[38px] cursor-pointer items-center gap-2 rounded-[10px] border bg-white px-3.5 text-[13px] font-semibold text-ink', chips.length ? 'border-ink' : 'border-card')}
            >
              <FiltersIcon size={15} />
              Filters<span>{chips.length ? ' · ' + chips.length : ''}</span>
            </button>
          ) : (
            FILTER_KEYS.map((k) => {
              const on = !!query.filters[k];
              const open = openFilter === k;
              return (
                <div key={k} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenFilter(open ? null : k)}
                    aria-expanded={open}
                    className={cx(
                      'flex h-[38px] cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold text-ink transition-[border-color,background-color] duration-150',
                      on ? 'border-ink bg-slate-50' : 'border-card bg-white',
                    )}
                  >
                    {on ? option(k).label : FILTERS[k].title}
                    <ChevronDownIcon size={14} />
                  </button>
                  {open && (
                    <div className="absolute top-11 left-0 z-30 min-w-[220px] rounded-[12px] border border-card bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,.14)]">
                      {FILTERS[k].opts.map((o) => {
                        const sel = query.filters[k] === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => pick(k, o.value)}
                            aria-pressed={sel}
                            className={cx(
                              'flex h-[38px] w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] border-0 px-2.5 text-left text-[14px] font-medium text-ink hover:bg-canvas',
                              sel ? 'bg-[#F3F6FF]' : 'bg-transparent',
                            )}
                          >
                            {o.label}
                            {sel && <CheckIcon size={14} stroke="var(--color-brand)" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div className="ml-auto flex items-center gap-2.5">
            <span className="text-[13px] text-slate-500" aria-live="polite">
              {countLabel}
            </span>
            <select
              value={query.sort}
              onChange={(e) => update({ sort: e.target.value as Sort })}
              aria-label="Sort"
              className="h-[38px] cursor-pointer rounded-[10px] border border-card bg-white px-2 text-[13px] font-semibold text-ink"
            >
              <option value="rec">Recommended</option>
              <option value="deadline">Deadline soon</option>
              <option value="teams">Most teams</option>
              <option value="new">Newest</option>
            </select>
          </div>
        </div>
        {chips.length > 0 && (
          <div className={cx('mx-auto box-border flex max-w-[1280px] flex-wrap items-center gap-1.5 pb-3', m ? 'px-5' : 'px-8')}>
            {chips.map((ch) => (
              <button
                key={ch.key}
                type="button"
                onClick={() => removeChip(ch.key)}
                aria-label={'Remove ' + ch.label}
                className="inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border-0 bg-ink pr-2 pl-3 text-[12px] font-semibold text-white"
              >
                {ch.label}
                <CloseIcon size={12} sw={3} />
              </button>
            ))}
            <button type="button" onClick={clearAll} className="h-[30px] cursor-pointer border-0 bg-transparent px-2 text-[12px] font-semibold text-slate-600 underline">
              Clear all
            </button>
          </div>
        )}
      </div>
      {openFilter && <div onClick={() => setOpenFilter(null)} className="fixed inset-0 z-[5]" />}

      <div className={cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-2 pb-8' : 'px-8 pt-3 pb-[72px]')}>
        {loading ? (
          <div className={cx('grid gap-x-6 gap-y-8', cols)} aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-[cm-pulse_1s_ease-in-out_infinite]">
                <div className={cx('rounded-[14px] bg-divider', m ? 'aspect-[16/10]' : 'aspect-[4/3]')} />
                <div className="mt-3.5 h-2.5 w-2/5 rounded-[5px] bg-divider" />
                <div className="mt-2.5 h-3.5 w-[85%] rounded-[5px] bg-divider" />
                <div className="mt-2 h-2.5 w-3/5 rounded-[5px] bg-divider" />
              </div>
            ))}
          </div>
        ) : n > 0 ? (
          <div className={cx('grid gap-x-6 gap-y-9', cols)}>
            {results.map((c) => (
              <CompTile key={c.id} cid={c.id} wide={m} authed={authed} />
            ))}
          </div>
        ) : (
          <div className="px-5 pt-14 pb-[72px] text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-[#F3F6FB] text-slate-500">
              <SearchIcon size={24} sw={2} />
            </div>
            <div className="mt-4 text-[18px] font-bold">{nothingSaved ? 'Nothing saved yet.' : 'No competitions match these filters.'}</div>
            <p className="mx-auto mt-1.5 mb-0 max-w-[420px] text-[14px] leading-[1.55] text-slate-500">
              {nothingSaved
                ? 'Save competitions and come back to them later. We remind you before registration closes.'
                : 'Try removing a filter, or search for a skill like “Presentation” or an organizer.'}
            </p>
            <div className="mt-[18px] flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => (nothingSaved ? nav('explore') : clearAll())}
                className="h-[42px] cursor-pointer rounded-[10px] border-0 bg-brand px-[18px] text-[14px] font-bold text-white"
              >
                {nothingSaved ? 'Explore competitions' : 'Clear filters'}
              </button>
            </div>
            {!saved && (
              <div className="mt-[18px] flex flex-wrap justify-center gap-1.5">
                <span className="self-center text-[13px] text-slate-500">Try:</span>
                {POPULAR_SEARCHES.slice(0, 4).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => update({ q: label, cat: 'All', filters: {} })}
                    className="h-[30px] cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {m && sheetOpen && (
        <div onClick={() => setSheetOpen(false)} className="fixed inset-0 z-40 flex items-end bg-[rgba(15,23,42,.4)]">
          <div
            role="dialog"
            aria-label="Filters"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86%] w-full animate-[cm-up_.22s_ease-out] overflow-y-auto rounded-t-[20px] bg-white"
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-[2px] bg-slate-300" />
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[18px] font-extrabold">Filters</span>
              <button type="button" onClick={clearAll} className="cursor-pointer border-0 bg-transparent text-[14px] font-semibold text-slate-600">
                Reset
              </button>
            </div>
            {FILTER_KEYS.map((k) => (
              <div key={k} className="border-t border-hairline px-5 py-3.5">
                <div className="mb-2.5 text-[14px] font-bold">{FILTERS[k].title}</div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS[k].opts.map((o) => {
                    const sel = query.filters[k] === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => pick(k, o.value)}
                        aria-pressed={sel}
                        className={cx(
                          'h-10 cursor-pointer rounded-[10px] border-[1.5px] px-3.5 text-[14px] font-semibold',
                          sel ? 'border-brand bg-brand-tint text-brand-hover' : 'border-slate-200 bg-white text-ink',
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="sticky bottom-0 border-t border-hairline bg-white px-5 pt-3 pb-5">
              <button type="button" onClick={() => setSheetOpen(false)} className="h-[50px] w-full cursor-pointer rounded-[12px] border-0 bg-brand text-[15px] font-bold text-white">
                Show {countLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {m && <BottomNav active={saved ? 'saved' : 'explore'} />}
    </div>
  );
}
