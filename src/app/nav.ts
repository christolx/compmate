import { createContext, useContext } from 'react';

export interface ExploreQuery {
  q?: string;
  cat?: string;
}
export type PeopleRank = 'you' | 'vertex';

/** Every navigation or action a screen can ask the app shell for. */
export type NavArgs = {
  home: [];
  explore: [query?: ExploreQuery];
  comp: [id: string];
  team: [id: string];
  people: [opts?: { rank?: PeopleRank }];
  profile: [id: string];
  manage: [];
  saved: [];
  how: [];
  back: [];
  search: [];
  login: [];
  notifications: [];
  save: [cid: string];
  apply: [target: { team: string; role: string }];
  applied: [target: { team: string; role: string }];
  closeApply: [];
  acceptApex: [];
  connect: [pid: string];
  withdraw: [pid: string];
  acceptConn: [pid: string];
  ignoreConn: [pid: string];
  removeConn: [pid: string];
  invite: [target: { pid: string; tid: string; rid: string }];
  create: [cid: string];
  official: [cid: string];
  toast: [message: string];
};
export type NavRoute = keyof NavArgs;
export type Nav = <K extends NavRoute>(route: K, ...args: NavArgs[K]) => void;

interface NavValue {
  nav: Nav;
  /** True on the design board: previews render, but nothing navigates. */
  inert: boolean;
}

export const NavContext = createContext<NavValue>({ nav: () => {}, inert: true });

export function useNav() {
  return useContext(NavContext).nav;
}

export const paths = {
  home: () => '/',
  forYou: () => '/for-you',
  explore: (query?: ExploreQuery) => {
    const sp = new URLSearchParams();
    if (query?.q) sp.set('q', query.q);
    if (query?.cat) sp.set('cat', query.cat);
    const s = sp.toString();
    return '/competitions' + (s ? '?' + s : '');
  },
  comp: (id: string) => '/competitions/' + id,
  team: (id: string) => '/teams/' + id,
  people: (opts?: { rank?: PeopleRank }) => '/people' + (opts?.rank === 'vertex' ? '?rank=vertex' : ''),
  profile: (id: string) => '/u/' + id,
  manage: () => '/teams/vertex/manage',
  saved: () => '/saved',
  how: () => '/#how',
  board: () => '/board',
};

export type PageRoute = 'home' | 'explore' | 'comp' | 'team' | 'people' | 'profile' | 'manage' | 'saved' | 'how';

export function hrefFor(route: PageRoute, args: unknown[]): string {
  const fn = paths[route] as (...a: unknown[]) => string;
  return fn(...args);
}
