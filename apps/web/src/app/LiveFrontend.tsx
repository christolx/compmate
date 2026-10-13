import { useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import { StoreContext, useAppState, type Store } from '../store/store';
import { createApiStore } from '../store/apiStore';
import { createPersistentStore } from '../store/store';
import { hydrateCatalog } from '../data/model';
import { COMPETITIONS as SEED_COMPS, NOTIFICATIONS as SEED_NOTIFS, PEOPLE as SEED_PEOPLE, TEAMS as SEED_TEAMS } from '../data/seed';

function Runtime({ store }: { store: Store }) {
  const st = useAppState();
  useEffect(() => {
    void store.refresh?.();
    const timer = setInterval(() => { void store.refresh?.(); }, 30000);
    return () => clearInterval(timer);
  }, [store]);
  if (!st.loaded && store.live && 'refresh' in store) {
    return <div role="status" className="grid min-h-dvh place-items-center bg-canvas font-sans text-ink">Loading CompMate…</div>;
  }
  return <AppShell />;
}

export function LiveFrontend() {
  const [store, setStore] = useState<Store>(createApiStore);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      const state = store.get();
      if (state.error?.includes('Network unavailable') || state.error?.includes('API unavailable')) {
        hydrateCatalog([...SEED_COMPS], [...SEED_TEAMS], { ...SEED_PEOPLE }, [...SEED_NOTIFS]);
        setStore(createPersistentStore());
      }
    });
    return unsub;
  }, [store]);

  return (
    <StoreContext.Provider value={store}>
      <Runtime store={store} />
    </StoreContext.Provider>
  );
}
