import { createContext, useContext, useSyncExternalStore } from 'react';
import { defaultState, type AppState } from '../data/state';
import { loadPersistedState, serializeState } from './persisted';

export interface Store {
  /** False for the read-only sample state the design board renders. */
  readonly live: boolean;
  get(): AppState;
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = 'compmate-v2';

/** localStorage, or undefined when the browser blocks access to it. */
function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The prototype's state, persisted in localStorage like the design's demo.
 * Saved data is validated on load, and a repaired copy is written back once.
 */
export function createPersistentStore(storage: Storage | undefined = browserStorage()): Store {
  let saved: string | null = null;
  try {
    saved = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // Unreadable storage behaves like empty storage.
  }
  const loaded = loadPersistedState(saved);
  let state = loaded.state;
  const save = () => {
    try {
      storage?.setItem(STORAGE_KEY, serializeState(state));
    } catch {
      // Storage can be full or blocked (private mode); the session still works.
    }
  };
  if (loaded.repaired) save();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    live: true,
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      save();
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
