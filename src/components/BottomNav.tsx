import { AppLink } from '../app/AppLink';
import { cx } from '../lib/cx';

export type BottomNavActive = 'explore' | 'people' | 'teams' | 'saved' | 'profile';

const ITEMS = [
  { key: 'explore', label: 'Explore', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z', to: 'explore' },
  { key: 'people', label: 'People', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', to: 'people' },
  { key: 'teams', label: 'Teams', icon: 'M12 2l9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5', to: 'manage' },
  { key: 'saved', label: 'Saved', icon: 'M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z', to: 'saved' },
  { key: 'profile', label: 'Profile', icon: 'M20 21a8 8 0 0 0-16 0M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', to: 'profile' },
] as const;

export function BottomNav({ active }: { active: BottomNavActive }) {
  return (
    <>
      {/* Fixed so it stays docked on screens taller than the page; the spacer
          (64px + 8px padding + 1px border) keeps the last content clear of it. */}
      <div aria-hidden="true" className="h-[73px]" />
      <nav className="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-5 border-t border-line bg-white/97 pb-2 font-sans backdrop-blur-[12px]">
        {ITEMS.map((i) => {
          const on = active === i.key;
          const props = {
            'aria-current': on ? ('page' as const) : undefined,
            className: cx(
              'flex cursor-pointer flex-col items-center justify-center gap-[3px] text-[11px] font-semibold',
              on ? 'text-brand hover:text-brand' : 'text-slate-500 hover:text-slate-500',
            ),
            children: (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={on && i.key === 'saved' ? '#2563EB' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={i.icon} />
                </svg>
                {i.label}
              </>
            ),
          };
          return i.to === 'profile' ? <AppLink key={i.key} to="profile" args={['me']} {...props} /> : <AppLink key={i.key} to={i.to} {...props} />;
        })}
      </nav>
    </>
  );
}
