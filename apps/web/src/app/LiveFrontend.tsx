import { useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import { StoreContext, useAppState, type Store } from '../store/store';
import { createApiStore } from '../store/apiStore';
import { ALL_COMPETITIONS } from '../data/model';

function Runtime({ store }: { store: Store }) {
  const st = useAppState();
  useEffect(() => {
    void store.refresh?.();
    const timer = setInterval(() => { void store.refresh?.(); }, 30000);
    return () => clearInterval(timer);
  }, [store]);
  if (!st.loaded) return <div role="status" className="grid min-h-dvh place-items-center bg-canvas font-sans text-ink">Loading CompMate…</div>;
  if (st.error && !ALL_COMPETITIONS.length) {
    return <div className="grid min-h-dvh place-items-center bg-canvas p-6 font-sans text-ink">
      <div role="alert" className="text-center">
        <h1 className="text-xl font-bold">Unable to load CompMate</h1>
        <p>{st.error}</p>
        <button type="button" onClick={() => { void store.refresh?.(); }} className="cursor-pointer rounded-lg bg-brand px-5 py-3 font-bold text-white">Retry</button>
      </div>
    </div>;
  }
  return <AppShell />;
}

export function LiveFrontend() {
  const [store] = useState(createApiStore);
  return <StoreContext.Provider value={store}><Runtime store={store} /></StoreContext.Provider>;
}
