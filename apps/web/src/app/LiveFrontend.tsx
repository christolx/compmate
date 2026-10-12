import { useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import { StoreContext, useAppState, type Store } from '../store/store';
import { createApiStore } from '../store/apiStore';
function Runtime({store}:{store:Store}){const st=useAppState();useEffect(()=>{void store.refresh?.();const timer=setInterval(()=>{void store.refresh?.()},30000);return()=>clearInterval(timer)},[store]);
 if(!st.loaded)return <div role="status" className="grid min-h-dvh place-items-center bg-canvas font-sans text-ink">Loading CompMate…</div>;
 return <AppShell/>;
}
export function LiveFrontend(){const [store]=useState(createApiStore);return <StoreContext.Provider value={store}><Runtime store={store}/></StoreContext.Provider>}
