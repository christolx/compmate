import { createContext, useContext, useSyncExternalStore } from 'react';
import { defaultState, type AppState } from '../data/state';

export interface Store {
  /** False for the read-only sample state the design board renders. */
  readonly live: boolean;
  get(): AppState;
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = 'compmate-v2';

/** The prototype's state, persisted in localStorage like the design's demo. */
export function createPersistentStore(storage: Storage | undefined = globalThis.localStorage): Store {
  let state: AppState;
  try {
    state = { ...defaultState(), ...JSON.parse(storage?.getItem(STORAGE_KEY) || '{}') };
  } catch {
    state = defaultState();
  }
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    live: true,
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage can be full or blocked (private mode); the session still works.
      }
      emit();
    },
    reset() {
      state = defaultState();
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // See set().
      }
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A frozen snapshot: writes are ignored. */
export function createStaticStore(state: AppState = defaultState()): Store {
  return { live: false, get: () => state, set() {}, reset() {}, subscribe: () => () => {} };
}

export const StoreContext = createContext<Store>(createStaticStore());

export function useStore() {
  return useContext(StoreContext);
}

export function useAppState(): AppState {
  const store = useContext(StoreContext);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
