import { COMPETITION_BY_ID, PERSONS, TEAM_BY_ID } from '../data/model';
import { NOTIFICATIONS } from '../data/seed';
import { defaultState, type AppState, type Application, type VertexApplication, type VertexState } from '../data/state';
import type { ApplicationStatus, ConnState } from '../data/types';

/**
 * Version of the saved state's shape. Data saved before versioning uses the
 * version 1 shape. When AppState changes shape, bump this and upgrade older
 * data before it is sanitized.
 */
export const PERSISTED_VERSION = 1;

export interface LoadedState {
  state: AppState;
  /** True when storage should be rewritten with `state`. */
  repaired: boolean;
}

type JsonObject = Record<string, unknown>;

const STATUSES: readonly unknown[] = ['pending', 'accepted', 'declined', 'withdrawn'] satisfies ApplicationStatus[];
const CONN_STATES: readonly unknown[] = ['none', 'sent', 'incoming', 'connected'] satisfies ConnState[];
const NOTIFICATION_IDS = new Set(NOTIFICATIONS.map((n) => n.id));

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is ApplicationStatus => STATUSES.includes(value);
const isConnState = (value: unknown): value is ConnState => CONN_STATES.includes(value);
// Own keys only, so ids like "constructor" never match.
const isPerson = (id: string) => Object.hasOwn(PERSONS, id);
const isCompetition = (id: string) => Object.hasOwn(COMPETITION_BY_ID, id);
const isTeam = (id: string) => Object.hasOwn(TEAM_BY_ID, id);
const isRoleOf = (teamId: string, role: unknown): role is string => typeof role === 'string' && TEAM_BY_ID[teamId].roles.some((r) => r.id === role);

/** Reads saved demo state. Never throws: anything unusable falls back to the defaults. */
export function loadPersistedState(raw: string | null): LoadedState {
  if (!raw) return { state: defaultState(), repaired: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: defaultState(), repaired: true };
  }
  if (!isObject(data)) return { state: defaultState(), repaired: true };
  const version = data.version === undefined ? 1 : data.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { state: defaultState(), repaired: true };
  // Saved by a newer build, such as another deployment: start fresh but leave that data alone.
  if (version > PERSISTED_VERSION) return { state: defaultState(), repaired: false };
  const state = sanitizeState(data);
  return { state, repaired: !sameJson(data, stored(state)) };
}

/** The JSON the store saves. */
export function serializeState(state: AppState): string {
  return JSON.stringify(stored(state));
}

function stored(state: AppState) {
  return { version: PERSISTED_VERSION, ...state };
}

/**
 * Keeps saved values that still match the sample data. Ids that no longer
 * exist are dropped, values of the wrong type fall back to the field's
 * default, and missing fields are filled in.
 */
export function sanitizeState(data: JsonObject): AppState {
  const d = defaultState();
  return {
    authed: typeof data.authed === 'boolean' ? data.authed : d.authed,
    saved: idList(data.saved, isCompetition) ?? d.saved,
    apps: record(data.apps, application) ?? d.apps,
    conns: record(data.conns, (pid, value) => (isPerson(pid) && isConnState(value) ? value : undefined)) ?? d.conns,
    invites: record(data.invites, invite) ?? d.invites,
    read: idList(data.read, (id) => NOTIFICATION_IDS.has(id)) ?? d.read,
    vx: vertex(data.vx, d.vx),
  };
}

/** Known ids without duplicates, or undefined when `value` isn't a list. */
function idList(value: unknown, known: (id: string) => boolean): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && known(id)))];
}

/** The valid entries of an id-keyed object, or undefined when `value` isn't one. */
function record<T>(value: unknown, parse: (key: string, entry: unknown) => T | undefined): Record<string, T> | undefined {
  if (!isObject(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const parsed = parse(key, entry);
      return parsed === undefined ? [] : [[key, parsed] as const];
    }),
  );
}

function application(teamId: string, value: unknown): Application | undefined {
  if (!isTeam(teamId) || !isObject(value)) return undefined;
  const { role, status, when } = value;
  return isRoleOf(teamId, role) && isStatus(status) && typeof when === 'string' ? { role, status, when } : undefined;
}

function invite(pid: string, value: unknown): AppState['invites'][string] | undefined {
  if (!isPerson(pid) || !isObject(value)) return undefined;
  const { tid, rid } = value;
  return typeof tid === 'string' && isTeam(tid) && isRoleOf(tid, rid) ? { tid, rid } : undefined;
}

/** The sample user's team, checked field by field so a partial roster keeps its valid parts. */
function vertex(value: unknown, d: VertexState): VertexState {
  const team = TEAM_BY_ID.vertex;
  if (!team || !isObject(value)) return d;
  const { min, max } = COMPETITION_BY_ID[team.comp];
  const { target, closed } = value;
  return {
    target: typeof target === 'number' && Number.isInteger(target) && target >= min && target <= max ? target : d.target,
    closed: typeof closed === 'boolean' ? closed : d.closed,
    added: idList(value.added, (id) => isPerson(id) && !team.members.includes(id)) ?? d.added,
    filled: idList(value.filled, (id) => isRoleOf(team.id, id)) ?? d.filled,
    apps: vertexApplications(value.apps) ?? d.apps,
  };
}

function vertexApplications(value: unknown): VertexApplication[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (!isObject(entry)) return [];
    const { id, pid, role, status, when, msg } = entry;
    const valid = typeof id === 'string' && !seen.has(id) && typeof pid === 'string' && isPerson(pid) && isRoleOf('vertex', role) && isStatus(status) && typeof when === 'string' && typeof msg === 'string';
    if (!valid) return [];
    seen.add(id);
    return [{ id, pid, role, status, when, msg }];
  });
}

/** Structural equality for JSON values; object key order doesn't matter. */
function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
  }
  return a === b;
}
