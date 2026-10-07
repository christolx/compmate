import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PERSONS, TEAM_BY_ID, team } from '../data/model';
import type { AppState } from '../data/state';
import type { ConnState } from '../data/types';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useAppState, useStore } from '../store/store';
import type { LoginRequest } from './AppRoutes';
import { AppRoutes } from './AppRoutes';
import { DemoDock } from './DemoDock';
import { NavContext, paths, type ExploreQuery, type Nav, type NavRoute, type PeopleRank } from './nav';
import { ApplyOverlay, LoginOverlay, NotificationsPanel, SearchOverlay, Toast } from './overlays';
import { ViewportContext } from './viewport';

type Overlay =
  | { kind: 'search' }
  | { kind: 'login'; reason?: string; then?: () => void }
  | { kind: 'notif'; top: number; right: number }
  | { kind: 'apply'; team: string; role: string };

const PHONE_PREVIEW_KEY = 'compmate-v2-phone-preview';
const GATED = ['/for-you', '/people', '/u/', '/teams/vertex/manage', '/saved'];

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * The prototype shell: routes, sign-in gates, overlays (search, sign in,
 * notifications, apply), toasts with undo, and the demo controls.
 */
export function AppShell() {
  const store = useStore();
  const st = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  // The design defines desktop (1440) and mobile (390); tablets in portrait get mobile.
  const narrow = useMediaQuery('(max-width: 1023px)');
  const [phonePreview, setPhonePreview] = useState(() => readFlag(PHONE_PREVIEW_KEY));
  const framed = phonePreview && !narrow;
  const mobile = narrow || framed;
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number; undo?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // A gated URL opened while signed out lands on Discover with this request.
  const loginRequest = (location.state as Partial<LoginRequest> | null)?.login;
  const active: Overlay | null = overlay ?? (loginRequest ? { kind: 'login', reason: loginRequest.reason } : null);

  const flash = useCallback((message: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToast((t) => ({ message, id: (t?.id ?? 0) + 1, undo }));
    toastTimer.current = setTimeout(() => setToast(null), undo ? 5000 : 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const close = useCallback(() => {
    setOverlay(null);
    if (loginRequest) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [loginRequest, navigate, location.pathname, location.search]);

  const nav = useCallback<Nav>(
    (route, ...args) => {
      const a = args as unknown[];
      const go = (to: string) => {
        setOverlay(null);
        navigate(to);
      };
      const gate = (reason: string, then: () => void) => {
        if (store.get().authed) then();
        else setOverlay({ kind: 'login', reason, then });
      };
      const setConn = (pid: string, value: ConnState) => store.set((s) => ({ conns: { ...s.conns, [pid]: value } }));
      const first = (pid: string) => PERSONS[pid].first;
      const notifPosition = () => {
        const root = framed ? stageRef.current : document.body;
        const header = root?.querySelector('[data-topnav]');
        const bell = header?.querySelector('[aria-label="Notifications"]');
        const stage = framed && stageRef.current ? stageRef.current.getBoundingClientRect() : { top: 0, right: window.innerWidth };
        const h = header?.getBoundingClientRect();
        const b = bell?.getBoundingClientRect();
        return {
          top: h ? (mobile ? h.bottom + 3 : h.bottom - 5) - stage.top : mobile ? 60 : 64,
          right: b ? Math.max(12, stage.right - b.right - 28) : 96,
        };
      };

      switch (route as NavRoute) {
        case 'home':
          return go(store.get().authed ? paths.forYou() : paths.home());
        case 'explore':
          return go(paths.explore(a[0] as ExploreQuery | undefined));
        case 'comp':
          return go(paths.comp(a[0] as string));
        case 'team':
          return go(paths.team(a[0] as string));
        case 'how':
          return go(paths.how());
        case 'back':
          setOverlay(null);
          if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
          else navigate(store.get().authed ? paths.forYou() : paths.home());
          return;
        case 'people':
          return gate('see student profiles', () => go(paths.people(a[0] as { rank?: PeopleRank } | undefined)));
        case 'profile':
          return gate('see student profiles', () => go(paths.profile(a[0] as string)));
        case 'manage':
          return gate('manage your team', () => go(paths.manage()));
        case 'saved':
          return gate('see saved competitions', () => go(paths.saved()));
        case 'search':
          return setOverlay({ kind: 'search' });
        case 'login':
          return setOverlay({ kind: 'login' });
        case 'notifications':
          return gate('see notifications', () => setOverlay({ kind: 'notif', ...notifPosition() }));
        case 'save': {
          const cid = a[0] as string;
          return gate('save competitions', () => {
            const cur = store.get().saved;
            const has = cur.includes(cid);
            store.set({ saved: has ? cur.filter((x) => x !== cid) : cur.concat(cid) });
            flash(has ? 'Removed from Saved' : "Saved. We'll remind you before registration closes.", () => store.set({ saved: cur }));
          });
        }
        case 'apply': {
          const target = a[0] as { team: string; role: string };
          return gate('apply to ' + TEAM_BY_ID[target.team].name, () => {
            const s = store.get();
            if (team(target.team, s).mine) return flash('This is your own team.');
            if (s.apps[target.team]) return flash('This application has already been submitted.');
            setOverlay({ kind: 'apply', ...target });
          });
        }
        case 'applied': {
          const target = a[0] as { team: string; role: string };
          return store.set((s) => ({ apps: { ...s.apps, [target.team]: { role: target.role, status: 'pending', when: 'Just now' } } }));
        }
        case 'closeApply':
          return setOverlay(null);
        case 'acceptApex':
          store.set((s) => {
            const apps: AppState['apps'] = { ...s.apps, apex: { ...s.apps.apex, status: 'accepted' } };
            for (const k of Object.keys(apps)) {
              if (k !== 'apex' && TEAM_BY_ID[k].comp === 'nbcc' && apps[k].status === 'pending') apps[k] = { ...apps[k], status: 'withdrawn' };
            }
            return { apps };
          });
          return flash('Dimas accepted you. Apex is now 3 of 3 and your Orion application was withdrawn.');
        case 'connect': {
          const pid = a[0] as string;
          setConn(pid, 'sent');
          return flash('Connection request sent to ' + first(pid), () => setConn(pid, 'none'));
        }
        case 'withdraw':
          setConn(a[0] as string, 'none');
          return flash('Request withdrawn');
        case 'acceptConn':
          setConn(a[0] as string, 'connected');
          return flash('You and ' + first(a[0] as string) + ' are now connected');
        case 'ignoreConn':
          setConn(a[0] as string, 'none');
          return flash('Request ignored. ' + first(a[0] as string) + " won't be notified.");
        case 'removeConn':
          setConn(a[0] as string, 'none');
          return flash('Connection removed');
        case 'invite': {
          const { pid, tid, rid } = a[0] as { pid: string; tid: string; rid: string };
          const roleName = TEAM_BY_ID[tid].roles.find((r) => r.id === rid)!.name;
          store.set((s) => ({ invites: { ...s.invites, [pid]: { tid, rid } } }));
          return flash(`Invited ${first(pid)} to join Vertex as ${roleName}`, () =>
            store.set((s) => {
              const invites = { ...s.invites };
              delete invites[pid];
              return { invites };
            }),
          );
        }
        case 'create':
          return gate('create a team', () => flash('The guided Create team flow is part of the next round.'));
        case 'official':
          return flash("Opens the organizer's registration page in a new tab");
        case 'toast':
          return flash(a[0] as string);
      }
    },
    [store, navigate, flash, framed, mobile],
  );

  const login = () => {
    const then = overlay?.kind === 'login' ? overlay.then : undefined;
    store.set({ authed: true });
    setOverlay(null);
    if (loginRequest) navigate(loginRequest.next, { replace: true });
    else if (then) setTimeout(then, 60);
    else navigate(paths.forYou());
    flash('Logged in');
  };

  const overlayOpen = active !== null;

  // Escape closes overlays; "/" opens search unless you are typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overlayOpen) close();
        return;
      }
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if (e.key === '/' && !overlayOpen && !typing) {
        e.preventDefault();
        setOverlay({ kind: 'search' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayOpen, close]);

  // The page behind an open overlay should not scroll.
  useEffect(() => {
    if (!overlayOpen || framed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen, framed]);

  // New page: start at the top (or at the #anchor).
  useLayoutEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (framed) scrollerRef.current?.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }, [location.pathname, location.search, location.hash, framed]);

  const navValue = useMemo(() => ({ nav, inert: false }), [nav]);

  const toggleAuth = () => {
    const authed = !store.get().authed;
    setOverlay(null);
    store.set({ authed });
    if (!authed && GATED.some((p) => location.pathname.startsWith(p))) navigate(paths.home());
  };
  const reset = () => {
    store.reset();
    setOverlay(null);
    setToast(null);
    navigate(paths.home());
  };
  const changePhonePreview = (on: boolean) => {
    setPhonePreview(on);
    try {
      localStorage.setItem(PHONE_PREVIEW_KEY, on ? '1' : '0');
    } catch {
      // Preference only; ignore blocked storage.
    }
  };

  const routes = (
    <div key={location.pathname} className="relative min-h-full animate-[cm-route_.25s_ease-out]">
      <AppRoutes />
    </div>
  );
  const overlays = (
    <>
      {active?.kind === 'search' && <SearchOverlay onClose={close} />}
      {active?.kind === 'login' && <LoginOverlay reason={active.reason} onClose={close} onLogin={login} />}
      {active?.kind === 'notif' && (
        <NotificationsPanel
          onClose={close}
          position={active}
          onRead={(id) => store.set((s) => ({ read: s.read.includes(id) ? s.read : s.read.concat(id) }))}
          onReadAll={() => store.set({ read: ['n1', 'n2', 'n3', 'n4', 'n5'] })}
        />
      )}
      {active?.kind === 'apply' && <ApplyOverlay team={active.team} role={active.role} onClose={close} />}
      <div role="status" aria-live="polite">
        {toast && (
          <Toast
            key={toast.id}
            message={toast.message}
            mobile={mobile}
            onUndo={
              toast.undo &&
              (() => {
                toast.undo?.();
                setToast(null);
              })
            }
          />
        )}
      </div>
    </>
  );

  return (
    <ViewportContext.Provider value={mobile}>
      <NavContext.Provider value={navValue}>
        {framed ? (
          <div className="flex h-dvh flex-col bg-[#E5E9F0]">
            <div className="flex min-h-0 flex-1 items-center justify-center p-5">
              <div
                ref={stageRef}
                className="relative h-[844px] max-h-full w-[390px] overflow-hidden rounded-[30px] bg-white shadow-[0_0_0_10px_#0F172A,0_30px_60px_rgba(15,23,42,.3)] [transform:translateZ(0)]"
              >
                <div ref={scrollerRef} className="absolute inset-0 overflow-x-hidden overflow-y-auto">
                  {routes}
                </div>
                {overlays}
              </div>
            </div>
          </div>
        ) : (
          <>
            {routes}
            {overlays}
          </>
        )}
        {/* Hidden while a dialog or sheet is open so it never covers one. */}
        {!overlayOpen && (
          <DemoDock
            path={location.pathname + location.search}
            authed={st.authed}
            canPreviewPhone={!narrow}
            phonePreview={framed}
            liftForTabBar={narrow}
            onToggleAuth={toggleAuth}
            onReset={reset}
            onPhonePreview={changePhonePreview}
          />
        )}
      </NavContext.Provider>
    </ViewportContext.Provider>
  );
}
