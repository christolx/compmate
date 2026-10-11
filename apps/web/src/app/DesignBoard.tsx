import { Suspense, lazy, useState } from 'react';
import { StoreContext, createPersistentStore } from '../store/store';

const Board = lazy(() => import('../board/Board').then(m => ({ default: m.Board })));
/** Historical reference only; product routes never use prototype state. */
export function DesignBoard() {
  const [store] = useState(createPersistentStore);
  return <StoreContext.Provider value={store}><Suspense fallback={<p>Loading design board…</p>}><Board /></Suspense></StoreContext.Provider>;
}
