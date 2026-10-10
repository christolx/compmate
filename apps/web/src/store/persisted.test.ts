// Saved demo state must never crash the app: stale, partial or corrupt data
// is repaired on load and the repaired copy is written back once.
import { describe, expect, it } from 'vitest';
import { defaultState, type AppState } from '../data/state';
import { PERSISTED_VERSION, loadPersistedState, serializeState } from './persisted';
import { createPersistentStore } from './store';

const KEY = 'compmate-v2';

/** A state with every field changed from the defaults, all of it valid. */
const active: AppState = {
  authed: true,
  saved: ['techno', 'dsc'],
  apps: {
    orion: { role: 'researcher', status: 'withdrawn', when: '2 days ago' },
    apex: { role: 'presenter', status: 'accepted', when: 'Just now' },
  },
  conns: { nadia: 'connected', clara: 'none' },
  invites: { livia: { tid: 'vertex', rid: 'designer' } },
  read: ['n1', 'n3'],
  vx: {
    target: 4,
    closed: true,
    added: ['livia'],
    filled: ['designer'],
    apps: defaultState().vx.apps.map((a) => (a.id === 'v1' ? { ...a, status: 'accepted' as const } : a)),
  },
};

const load = (data: unknown) => loadPersistedState(JSON.stringify(data));

function memoryStorage(saved?: string) {
  const items = new Map<string, string>(saved === undefined ? [] : [[KEY, saved]]);
  const writes: string[] = [];
  const storage = {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => [...items.keys()][index] ?? null,
    removeItem: (key: string) => void items.delete(key),
    setItem: (key: string, value: string) => {
      writes.push(value);
      items.set(key, value);
    },
  } satisfies Storage;
  return { storage, items, writes };
}

describe('loadPersistedState', () => {
  it('loads a valid saved state unchanged', () => {
    expect(loadPersistedState(serializeState(active))).toEqual({ state: active, repaired: false });
  });

  it('starts from the defaults when nothing is saved', () => {
    expect(loadPersistedState(null)).toEqual({ state: defaultState(), repaired: false });
  });

  it('falls back to the defaults when the saved data is not a JSON object', () => {
    for (const raw of ['{not json', '[]', '"text"', 'null', '42']) {
      expect(loadPersistedState(raw), raw).toEqual({ state: defaultState(), repaired: true });
    }
  });

  it('replaces values of the wrong type with the field default', () => {
    const data = { version: 1, authed: 'yes', saved: 'nbcc', apps: [], conns: 'connected', invites: 5, read: {}, vx: [] };
    expect(load(data)).toEqual({ state: defaultState(), repaired: true });
  });

  it('fills in a half-filled roster and keeps its valid fields', () => {
    expect(load({ authed: true, vx: {} }).state).toEqual({ ...defaultState(), authed: true });
    expect(load({ vx: { target: 4, closed: 'no', added: ['ghost', 'livia', 'livia', 'kevin'] } }).state.vx).toEqual({
      ...defaultState().vx,
      target: 4,
      added: ['livia'],
    });
    expect(load({ vx: { target: 9 } }).state.vx.target).toBe(defaultState().vx.target);
  });

  it('drops saved competitions that no longer exist', () => {
    const { state, repaired } = load({ ...active, saved: ['removed-competition', 'nbcc', 'nbcc'] });
    expect(state.saved).toEqual(['nbcc']);
    expect(repaired).toBe(true);
  });

  it('drops applications to teams or roles that no longer exist', () => {
    const apps = {
      ghost: { role: 'presenter', status: 'pending', when: 'Today' },
      orion: { role: 'pilot', status: 'pending', when: 'Today' },
      kinara: { role: 'analyst', status: 'maybe', when: 'Today' },
      nexus: 'pending',
      apex: { role: 'presenter', status: 'pending', when: 'Just now' },
    };
    expect(load({ ...active, apps }).state.apps).toEqual({ apex: { role: 'presenter', status: 'pending', when: 'Just now' } });
  });

  it('repairs malformed read notifications', () => {
    expect(load({ ...active, read: 5 }).state.read).toEqual(defaultState().read);
    expect(load({ ...active, read: ['n1', 7, 'n1', 'gone'] }).state.read).toEqual(['n1']);
  });

  it('repairs malformed connections', () => {
    expect(load({ ...active, conns: null }).state.conns).toEqual(defaultState().conns);
    expect(load({ ...active, conns: { kevin: 'connected', nadia: 'best friends', ghost: 'sent' } }).state.conns).toEqual({ kevin: 'connected' });
  });

  it('drops invitations and applicants that point at missing people or roles', () => {
    const { state } = load({
      ...active,
      invites: { ghost: { tid: 'vertex', rid: 'designer' }, nadia: { tid: 'vertex', rid: 'pilot' }, livia: { tid: 'vertex', rid: 'designer' } },
      vx: { ...active.vx, filled: ['designer', 'pilot'], apps: [...active.vx.apps, { id: 'v9', pid: 'ghost', role: 'designer', status: 'pending', when: 'Today', msg: 'Hi' }] },
    });
    expect(state.invites).toEqual({ livia: { tid: 'vertex', rid: 'designer' } });
    expect(state.vx.filled).toEqual(['designer']);
    expect(state.vx.apps).toEqual(active.vx.apps);
  });

  it('ignores ids that only exist on Object.prototype', () => {
    const { state } = loadPersistedState('{"saved":["constructor"],"conns":{"__proto__":"connected","toString":"sent"}}');
    expect(state.saved).toEqual([]);
    expect(state.conns).toEqual({});
    expect(Object.getPrototypeOf(state.conns)).toBe(Object.prototype);
  });

  it('upgrades unversioned data in the current shape', () => {
    expect(loadPersistedState(JSON.stringify(active))).toEqual({ state: active, repaired: true });
  });

  it('falls back to the defaults for data saved by a newer version, without rewriting it', () => {
    expect(load({ ...active, version: PERSISTED_VERSION + 1 })).toEqual({ state: defaultState(), repaired: false });
  });

  it('treats an invalid version as corrupt', () => {
    expect(load({ ...active, version: 'two' })).toEqual({ state: defaultState(), repaired: true });
  });
});

describe('createPersistentStore', () => {
  it('writes the current version once after repairing saved data', () => {
    const { storage, writes } = memoryStorage(JSON.stringify(active));
    expect(createPersistentStore(storage).get()).toEqual(active);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0])).toEqual({ version: PERSISTED_VERSION, ...active });
    createPersistentStore(storage);
    expect(writes).toHaveLength(1);
  });

  it('does not rewrite valid saved data on startup', () => {
    const { storage, writes } = memoryStorage(serializeState(active));
    createPersistentStore(storage);
    expect(writes).toHaveLength(0);
  });

  it('saves the version with every change', () => {
    const { storage, items } = memoryStorage();
    createPersistentStore(storage).set({ saved: ['dsc'] });
    expect(JSON.parse(items.get(KEY)!)).toMatchObject({ version: PERSISTED_VERSION, saved: ['dsc'] });
  });

  it('leaves data from a newer version in storage', () => {
    const newer = JSON.stringify({ version: PERSISTED_VERSION + 1, layout: 'unknown' });
    const { storage, items, writes } = memoryStorage(newer);
    expect(createPersistentStore(storage).get()).toEqual(defaultState());
    expect(writes).toHaveLength(0);
    expect(items.get(KEY)).toBe(newer);
  });

  it('keeps working when storage is blocked', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    const store = createPersistentStore({ ...memoryStorage().storage, getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(store.get()).toEqual(defaultState());
    store.set({ authed: true });
    expect(store.get().authed).toBe(true);
    store.reset();
    expect(store.get()).toEqual(defaultState());
  });

  it('reset clears the saved state', () => {
    const { storage, items } = memoryStorage(serializeState(active));
    const store = createPersistentStore(storage);
    store.reset();
    expect(store.get()).toEqual(defaultState());
    expect(items.has(KEY)).toBe(false);
  });
});
