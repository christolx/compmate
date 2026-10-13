import type { ApplicationStatus, ConnState } from './types';

export interface Application {
  id?: string;
  role: string;
  status: ApplicationStatus;
  when: string;
  msg?: string;
  shareContact?: boolean;
}

export interface VertexApplication extends Application {
  id: string;
  pid: string;
  msg: string;
  shareContact?: boolean;
}

/** The sample user leads Vertex, so its roster lives in app state. */
export interface VertexState {
  target: number;
  closed: boolean;
  added: string[];
  filled: string[];
  apps: VertexApplication[];
}

export interface AppState {
  loaded?: boolean;
  error?: string;
  account?: import("../store/apiStore").Account | null;
  actorId?: string;
  incomingInvites?: {id:string;team_id:string;role_id:string}[];
  managed?: Record<string, VertexState>;
  authed: boolean;
  saved: string[];
  /** The sample user's applications, keyed by team id. */
  apps: Record<string, Application>;
  conns: Record<string, ConnState>;
  invites: Record<string, { tid: string; rid: string }>;
  /** Notification ids already read. */
  read: string[];
  vx: VertexState;
}

export function defaultState(): AppState {
  return {
    authed: false,
    saved: ['nbcc', 'techno', 'nuiux'],
    apps: { orion: { role: 'researcher', status: 'pending', when: '2 days ago' } },
    conns: { nadia: 'incoming', clara: 'sent', kevin: 'connected', bima: 'connected', rizky: 'connected' },
    invites: {},
    read: [],
    vx: {
      target: 5,
      closed: false,
      added: [],
      filled: [],
      apps: [
        { id: 'v1', pid: 'livia', role: 'designer', status: 'pending', when: '1 hour ago', msg: 'I designed a mobile banking flow for my HCI course and ran six usability tests on it. Happy to own the demo screens and keep them consistent.' },
        { id: 'v2', pid: 'fikri', role: 'presenter', status: 'pending', when: 'Yesterday', msg: 'I MC campus events and pitched at our faculty startup day. Free every weekend and happy to rehearse a lot.' },
      ],
    },
  };
}
