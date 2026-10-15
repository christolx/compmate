import { exampleRegistrationUrl } from '../lib/exampleLinks';
import { externalUrl } from '../lib/externalUrl';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { COMPETITION_BY_ID, TEAM_BY_ID, team } from '../data/model';


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
  | { kind: 'login'; reason?: string; then?: () => void; signup?: boolean }
  | { kind: 'notif'; top: number; right: number }
  | { kind: 'apply'; team: string; role: string };

const PHONE_PREVIEW_KEY = 'compmate-v2-phone-preview';
const GATED = ['/for-you', '/people', '/u/', '/teams/vertex/manage', '/saved'];


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
  const [phonePreview, setPhonePreview] = useState(false);
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
      const command = (path: string, method: string, body: unknown, success: string) => {
        void store.request?.(path,method,body).then(()=>flash(success)).catch(e=>flash(e.message));
      };

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
          return go(paths.home());
        case 'forYou':
          return gate("see what's next for you", () => go(paths.forYou()));
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
          return gate('manage your team', () => {const tid=(a[0] as string)||Object.keys(store.get().managed||{})[0];go(tid?paths.manage(tid):paths.forYou())});
        case 'saved':
          return gate('see saved competitions', () => go(paths.saved()));
        case 'search':
          return setOverlay({ kind: 'search' });
        case 'login':
          return setOverlay({ kind: 'login', signup: !!a[0] });
        case 'logout':
          void store.request?.('/logout','POST',{}).then(()=>{setOverlay(null);navigate(paths.home(),{replace:true,state:null});flash('Logged out')}).catch(e=>flash(e.message));return;
        case 'notifications':
          return gate('see notifications', () => setOverlay({ kind: 'notif', ...notifPosition() }));
        case 'save': {
          const cid = a[0] as string;
          return gate('save competitions', () => {
            const has=store.get().saved.includes(cid);
            command('/saved/'+cid,has?'DELETE':'PUT',{},has?'Removed from Saved':'Saved competition');
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
        case 'applied': return;
        case 'closeApply': return setOverlay(null);
        case 'acceptApex': return;
        case 'connect': command('/connections/'+a[0],'POST',{},'Connection request sent');return;
        case 'withdraw': case 'ignoreConn': case 'removeConn': command('/connections/'+a[0],'DELETE',{},'Connection updated');return;
        case 'acceptConn': command('/connections/'+a[0]+'/accept','POST',{},'Connection accepted');return;
        case 'invite': {const v=a[0] as {pid:string;tid:string;rid:string};command('/teams/'+v.tid+'/invitations','POST',{user_id:v.pid,role_id:v.rid},'Team invitation sent');return;}
        case 'create': return gate('create a team',()=>go('/teams/new?competition='+a[0]));
        case 'official':
          { const cid=a[0] as string;const url=externalUrl(COMPETITION_BY_ID[cid]?.url)??exampleRegistrationUrl(cid);window.open(url,'_blank','noopener,noreferrer');return; }
        case 'toast':
          return flash(a[0] as string);
      }
    },
    [store, navigate, flash, framed, mobile],
  );

  const login = () => {
    const then = overlay?.kind === 'login' ? overlay.then : undefined;

    setOverlay(null);
    if (loginRequest) navigate(loginRequest.next, { replace: true });
    else if (then) setTimeout(then, 60);
    else navigate(paths.home());
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

  useEffect(() => {
    if (!overlayOpen) return;
    const previous=document.activeElement as HTMLElement|null;
    const root=document.querySelector('[data-page-content]') as HTMLElement|null;
    if(root)root.inert=true;
    const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const dialog=document.querySelector('[role="dialog"]')||document.querySelector('[aria-modal="true"]');
      const controls=dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,a[href],[tabindex="0"]');if(!controls?.length)return;
      const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&(document.activeElement===first||!dialog?.contains(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!dialog?.contains(document.activeElement))){e.preventDefault();first.focus()}};
    document.addEventListener('keydown',trap);return()=>{if(root)root.inert=false;document.removeEventListener('keydown',trap);previous?.focus()};
  },[overlayOpen]);

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
    <div data-page-content key={location.pathname} className="relative min-h-full animate-[cm-route_.25s_ease-out]">
      <AppRoutes />
    </div>
  );
  const overlays = (
    <>
      {active?.kind === 'search' && <SearchOverlay onClose={close} />}
      {active?.kind === 'login' && <LoginOverlay reason={active.reason} signup={active.signup} onClose={close} onLogin={login} />}
      {active?.kind === 'notif' && (
        <NotificationsPanel
          onClose={close}
          position={active}
          onRead={(id) => {void store.request?.('/notifications/'+id+'/read','POST',{}).catch(e=>flash(e.message))}}
          onReadAll={() => {void store.request?.('/notifications/read','POST',{}).catch(e=>flash(e.message))}}
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
        {st.error && <div role="alert" className="sticky top-0 z-[70] bg-danger p-3 text-center text-[14px] text-white">{st.error} <button onClick={()=>{void store.refresh?.()}} className="cursor-pointer rounded border border-white bg-transparent px-3 py-1 text-white">Retry</button></div>}
        {framed ? (
          <div className="flex h-dvh flex-col bg-[#E5E9F0]">
            <div className="flex min-h-0 flex-1 items-center justify-center p-5">
              <div
                ref={stageRef}
                className="relative h-[844px] max-h-full w-[390px] overflow-hidden rounded-[30px] bg-canvas shadow-[0_0_0_10px_#0F172A,0_30px_60px_rgba(15,23,42,.3)] [transform:translateZ(0)]"
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
        {!store.request && !overlayOpen && (
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
