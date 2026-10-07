import { useEffect, useState } from 'react';
import { PERSONS, SKILL_CATEGORY, team } from '../data/model';
import { match, relevance } from '../data/matching';
import { FACULTIES } from '../data/seed';
import type { Person } from '../data/types';
import type { PeopleRank } from '../app/nav';
import { useIsMobile } from '../app/viewport';
import { BottomNav } from '../components/BottomNav';
import { ChevronDownIcon, SearchIcon } from '../components/icons';
import { PersonTile } from '../components/PersonTile';
import { TopNav } from '../components/TopNav';
import { cx } from '../lib/cx';
import { useAppState } from '../store/store';

type FilterKey = 'role' | 'skill' | 'interest' | 'fac' | 'level' | 'avail';
const FILTER_KEYS: FilterKey[] = ['role', 'skill', 'interest', 'fac', 'level', 'avail'];

/** Search and filter teammates, ranked for you or for Vertex's open roles. */
export function People({ rank: initialRank = 'you' }: { rank?: PeopleRank }) {
  const st = useAppState();
  const m = useIsMobile();
  const [q, setQ] = useState('');
  const [rank, setRank] = useState<PeopleRank>(initialRank);
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const vx = team('vertex', st);
  const ids = Object.keys(PERSONS).filter((id) => id !== 'me' && !vx.members.includes(id));
  const uniq = (a: string[]) => [...new Set(a)].sort();
  const options: Record<FilterKey, { title: string; values: string[] }> = {
    role: { title: 'Preferred role', values: uniq(ids.flatMap((i) => PERSONS[i].roles)) },
    skill: { title: 'Skill', values: uniq(ids.flatMap((i) => PERSONS[i].skills)) },
    interest: { title: 'Interest', values: uniq(ids.flatMap((i) => PERSONS[i].interests)) },
    fac: { title: 'Faculty', values: Object.keys(FACULTIES) },
    level: { title: 'Experience', values: ['Beginner', 'Some experience', 'Experienced'] },
    avail: { title: 'Availability', values: ['Weekends', 'Weekday evenings', 'Flexible'] },
  };
  const label = (k: FilterKey, v: string) => (k === 'fac' ? FACULTIES[v as keyof typeof FACULTIES] : v);

  const query = q.trim().toLowerCase();
  // Searching a skill also surfaces people with skills in the same category.
  const queryCat = Object.keys(SKILL_CATEGORY).find((k) => k.toLowerCase() === query);
  const ok = (p: Person) =>
    (!query || [p.name, p.program].concat(p.roles, p.skills).join(' ').toLowerCase().includes(query) || (!!queryCat && p.cats.includes(SKILL_CATEGORY[queryCat]))) &&
    (!filters.role || p.roles.includes(filters.role)) &&
    (!filters.skill || p.skills.includes(filters.skill) || p.cats.includes(SKILL_CATEGORY[filters.skill])) &&
    (!filters.interest || p.interests.includes(filters.interest)) &&
    (!filters.fac || p.fac === filters.fac) &&
    (!filters.level || p.level === filters.level) &&
    (!filters.avail || p.avail === filters.avail);
  const teamMode = rank === 'vertex' && vx.roleList.length > 0;
  const results = ids
    .map((id) => PERSONS[id])
    .filter(ok)
    .map((p) => {
      if (teamMode) {
        const best = vx.roleList.map((r) => match(p.id, 'vertex', r.id, st)).sort((a, b) => b.score - a.score)[0];
        return { id: p.id, rid: best.role.id, score: best.score };
      }
      return { id: p.id, rid: undefined, score: relevance(p.id).score };
    })
    .sort((a, b) => b.score - a.score);
  const requests = Object.keys(st.conns).filter((k) => st.conns[k] === 'incoming');
  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length;
  const countLabel = results.length + (results.length === 1 ? ' person' : ' people');
  const pick = (k: FilterKey, v: string) => {
    setFilters((f) => ({ ...f, [k]: f[k] === v ? undefined : v }));
    setOpenFilter(null);
  };
  const clear = () => {
    setFilters({});
    setQ('');
  };

  return (
    <div data-screen-label="People" className="relative min-h-full bg-white font-sans text-ink">
      <TopNav authed active="people" />
      <div className={cx('mx-auto box-border max-w-[1280px]', m ? 'px-5 pt-5 pb-8' : 'px-8 pt-10 pb-20')}>
        <h1 className={cx('m-0 font-extrabold tracking-[-0.035em]', m ? 'text-[28px]' : 'text-[36px]')}>Discover people</h1>
        <p className="mt-1.5 mb-0 max-w-[620px] text-[15px] leading-[1.55] text-slate-600">
          Find teammates by skill, role or program. Profiles only show what matters for competitions; contact details stay private.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <label className="flex h-[50px] max-w-[560px] flex-[1_1_360px] items-center gap-2.5 rounded-[14px] border border-field px-4 text-slate-500 focus-within:border-[#93C5FD]">
            <SearchIcon size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search people"
              placeholder="Search by name, skill, role or program"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-ink outline-0"
            />
          </label>
          <div role="group" aria-label="Rank results" className="flex rounded-[12px] bg-slate-100 p-1">
            {(
              [
                ['you', 'For you'],
                ['vertex', "For Vertex's open roles"],
              ] as const
            ).map(([k, l]) => {
              const on = rank === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRank(k)}
                  aria-pressed={on}
                  className={cx(
                    'h-10 cursor-pointer rounded-[9px] border-0 px-3.5 text-[13px] font-bold whitespace-nowrap',
                    on ? 'bg-white text-ink shadow-[0_1px_3px_rgba(15,23,42,.1)]' : 'bg-transparent text-slate-500',
                  )}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
        {m ? (
          <button type="button" onClick={() => setSheetOpen(true)} className="mt-3 h-[38px] cursor-pointer rounded-[10px] border border-card bg-white px-3.5 text-[13px] font-semibold text-ink">
            Filters<span>{activeCount ? ' · ' + activeCount : ''}</span>
          </button>
        ) : (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {FILTER_KEYS.map((k) => {
              const open = openFilter === k;
              return (
                <div key={k} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenFilter(open ? null : k)}
                    aria-expanded={open}
                    className={cx('flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border bg-white px-3 text-[13px] font-semibold text-ink', filters[k] ? 'border-ink' : 'border-card')}
                  >
                    {filters[k] ? label(k, filters[k]) : options[k].title}
                    <ChevronDownIcon size={13} />
                  </button>
                  {open && (
                    <div className="absolute top-[42px] left-0 z-30 max-h-[300px] min-w-[220px] overflow-y-auto rounded-[12px] border border-card bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,.14)]">
                      {options[k].values.map((v) => {
                        const on = filters[k] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => pick(k, v)}
                            aria-pressed={on}
                            className={cx(
                              'flex h-9 w-full cursor-pointer items-center justify-between rounded-[8px] border-0 px-2.5 text-left text-[14px] font-medium text-ink hover:bg-canvas',
                              on ? 'bg-[#F3F6FF]' : 'bg-transparent',
                            )}
                          >
                            {label(k, v)}
                            {on && <span className="font-extrabold text-brand">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {activeCount > 0 && (
              <button type="button" onClick={clear} className="h-9 cursor-pointer border-0 bg-transparent px-2 text-[13px] font-semibold text-slate-600 underline">
                Clear
              </button>
            )}
          </div>
        )}
        {openFilter && <div onClick={() => setOpenFilter(null)} className="fixed inset-0 z-[5]" />}
        {requests.length > 0 && (
          <section className="mt-7">
            <h2 className="m-0 text-[15px] font-extrabold">
              Connection requests <span className="font-semibold text-slate-500">· {requests.length}</span>
            </h2>
            <div className="max-w-[560px]">
              {requests.map((pid) => (
                <PersonTile key={pid} pid={pid} variant="mini" />
              ))}
            </div>
          </section>
        )}
        {teamMode && (
          <div className="mt-7 flex flex-wrap items-center gap-3 rounded-[14px] border border-match-line bg-match px-4 py-3.5 text-[14px] text-ink-2">
            <strong>Ranking for Vertex.</strong>
            <span>Open roles: {vx.roleList.map((r) => r.name).join(', ')}. People who add skills the team is missing rank higher.</span>
          </div>
        )}
        <div className="mt-6 flex items-baseline justify-between">
          <span className="text-[14px] font-bold" aria-live="polite">
            {countLabel}
          </span>
          <span className="text-[12px] text-slate-500">BINUS University · fictional sample profiles</span>
        </div>
        <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {results.map((r) => (
            <PersonTile key={r.id} pid={r.id} tid={teamMode ? 'vertex' : undefined} rid={r.rid} canInvite={teamMode} />
          ))}
        </div>
        {results.length === 0 && (
          <div className="px-5 py-12 text-center">
            <div className="text-[17px] font-bold">No one matches these filters.</div>
            <p className="mt-1.5 mb-0 text-[14px] text-slate-500">Try a related skill. Searching “Presentation” also surfaces people with Pitching or Public Speaking.</p>
            <button type="button" onClick={clear} className="mt-4 h-[42px] cursor-pointer rounded-[10px] border-0 bg-brand px-[18px] text-[14px] font-bold text-white">
              Clear filters
            </button>
          </div>
        )}
      </div>
      {m && sheetOpen && (
        <div onClick={() => setSheetOpen(false)} className="fixed inset-0 z-40 flex items-end bg-[rgba(15,23,42,.4)]">
          <div role="dialog" aria-label="Filters" onClick={(e) => e.stopPropagation()} className="max-h-[86%] w-full animate-[cm-up_.22s_ease-out] overflow-y-auto rounded-t-[20px] bg-white">
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-[2px] bg-slate-300" />
            <div className="px-5 py-3 text-[18px] font-extrabold">Filters</div>
            {FILTER_KEYS.map((k) => (
              <div key={k} className="border-t border-hairline px-5 py-3.5">
                <div className="mb-2.5 text-[14px] font-bold">{options[k].title}</div>
                <div className="flex flex-wrap gap-2">
                  {options[k].values.map((v) => {
                    const on = filters[k] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => pick(k, v)}
                        aria-pressed={on}
                        className={cx('h-[38px] cursor-pointer rounded-[10px] border-[1.5px] px-3 text-[13px] font-semibold', on ? 'border-brand bg-brand-tint text-brand-hover' : 'border-slate-200 bg-white text-ink')}
                      >
                        {label(k, v)}
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
      {m && <BottomNav active="people" />}
    </div>
  );
}
