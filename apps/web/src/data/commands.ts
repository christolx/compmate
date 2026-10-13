import { TEAM_BY_ID, TEAMS_BY_COMP, comp, team } from './model';
import type { AppState, Application, VertexApplication, VertexState } from './state';
import type { ApplicationStatus } from './types';

export interface CommandError extends Error {
  status?: number;
}

function bad(msg: string, status = 400): CommandError {
  const err = new Error(msg) as CommandError;
  err.status = status;
  return err;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface ApplyInput {
  teamId: string;
  roleId: string;
  message: string;
  shareContact?: boolean;
  actorId?: string;
}

export interface DecisionInput {
  applicationId: string;
  action: 'accept' | 'decline' | 'withdraw';
  actorId?: string;
}

export interface InviteInput {
  teamId: string;
  userId: string;
  roleId: string;
  actorId?: string;
}

export interface AnswerInviteInput {
  invitationId: string;
  action: 'accept' | 'decline';
  shareContact?: boolean;
  actorId?: string;
}

function ensureManaged(st: AppState, tid: string): VertexState {
  if (st.managed && st.managed[tid]) {
    return { ...st.managed[tid] };
  }
  if (tid === 'vertex' && st.vx) {
    return {
      target: st.vx.target ?? 5,
      closed: st.vx.closed ?? false,
      added: [...(st.vx.added ?? [])],
      filled: [...(st.vx.filled ?? [])],
      apps: [...(st.vx.apps ?? [])],
    };
  }
  const t = TEAM_BY_ID[tid];
  return {
    target: t ? t.target : 2,
    closed: t ? t.recruiting === false : false,
    added: [],
    filled: [],
    apps: [],
  };
}

/**
 * P0-1: apply command with commit-time validation:
 * - permission (must be signed in, not leader, not existing member)
 * - status pending (cannot re-apply if pending or accepted)
 * - seat role (role exists and has open slots)
 * - deadline / recruitment (deadline not passed, team not closed)
 * - capacity <= target (team not complete)
 * - one membership per competition
 * - message length 10–2000 chars, stores message and shareContact preference
 */
export function executeApply(
  st: AppState,
  input: ApplyInput,
): { nextState: AppState; applicationId: string } {
  if (!st.authed) throw bad('Sign in required', 401);

  const msg = input.message?.trim() ?? '';
  if (msg.length < 10 || input.message.length > 2000) {
    throw bad('Application message needs 10–2000 chars');
  }

  const tid = input.teamId;
  const t = TEAM_BY_ID[tid];
  if (!t) throw bad('Team not found', 404);

  const tv = team(tid, st);
  if (tv.mine) throw bad('This is your own team.');
  if (tv.isMember) throw bad('Already a member of this team.');

  const existing = st.apps[tid];
  if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
    throw bad('This application has already been submitted.');
  }

  const cv = comp(t.comp);
  if (cv.left < 0) throw bad('Registration has closed.', 409);
  if (tv.closed) throw bad('Team recruitment is closed.', 409);
  if (tv.complete || tv.filled >= tv.target) throw bad('Team has reached its member target.', 409);

  const role = t.roles.find((r) => r.id === input.roleId);
  if (!role) throw bad('Role not found on this team.');

  const roleOpen = tv.roleList.find((r) => r.id === input.roleId);
  if (!roleOpen || roleOpen.qty <= 0) throw bad('This role is already filled.', 409);

  const compTeams = TEAMS_BY_COMP[t.comp] || [];
  const inOtherTeam = compTeams.some((otherId) => otherId !== tid && team(otherId, st).isMember);
  if (inOtherTeam) {
    throw bad('You are already a member of another team for this competition.', 409);
  }

  const aid = genId('app');
  const newApp: Application = {
    id: aid,
    role: input.roleId,
    status: 'pending',
    when: 'Just now',
    msg: input.message,
    shareContact: !!input.shareContact,
  };

  const nextApps = { ...st.apps, [tid]: newApp };
  const teamManaged = ensureManaged(st, tid);
  const vxApp: VertexApplication = {
    id: aid,
    pid: input.actorId || 'me',
    role: input.roleId,
    status: 'pending',
    when: 'Just now',
    msg: input.message,
    shareContact: !!input.shareContact,
  };

  const nextTeamManaged = {
    ...teamManaged,
    apps: [vxApp, ...teamManaged.apps.filter((a) => a.id !== aid)],
  };

  const nextManaged = {
    ...(st.managed ?? {}),
    [tid]: nextTeamManaged,
  };

  const nextState: AppState = {
    ...st,
    apps: nextApps,
    managed: nextManaged,
    vx: tid === 'vertex' ? nextTeamManaged : st.vx,
  };

  return { nextState, applicationId: aid };
}

/**
 * P0-1: decision command (accept, decline, withdraw):
 * - permission (leader for accept/decline, applicant for withdraw)
 * - status pending (final transitions cannot change; double accept is idempotent)
 * - accept is ATOMIC: member added + role assigned + request status accepted
 *   + competing pending requests in same competition withdrawn!
 * - rechecks capacity, role seats, deadline, team recruitment, one membership per comp
 */
export function executeDecision(
  st: AppState,
  input: DecisionInput,
): { nextState: AppState } {
  if (!st.authed) throw bad('Sign in required', 401);

  const { applicationId: aid, action } = input;
  const actor = input.actorId || 'me';

  // Search application across outgoing apps and managed team inboxes
  let targetTeamId: string | undefined;
  let applicantPid: string = 'me';
  let targetRole: string = '';
  let curStatus: ApplicationStatus | undefined;
  let inOutgoing = false;

  for (const [tid, app] of Object.entries(st.apps)) {
    if (app.id === aid || tid === aid) {
      targetTeamId = tid;
      applicantPid = 'me';
      targetRole = app.role;
      curStatus = app.status;
      inOutgoing = true;
      break;
    }
  }

  const managedRecords = {
    ...(st.managed ?? {}),
    vertex: st.managed?.vertex ?? st.vx,
  };

  for (const [tid, mState] of Object.entries(managedRecords)) {
    if (!mState?.apps) continue;
    const found = mState.apps.find((a) => a.id === aid);
    if (found) {
      targetTeamId = tid;
      applicantPid = found.pid;
      targetRole = found.role;
      curStatus = found.status;
      break;
    }
  }

  if (!targetTeamId || !curStatus) {
    throw bad('Application not found', 404);
  }

  const t = TEAM_BY_ID[targetTeamId];
  if (!t) throw bad('Team not found', 404);

  const isLeader = t.leader === actor || team(targetTeamId, st).mine;
  const isApplicant = applicantPid === actor;

  if (action === 'withdraw') {
    if (!isApplicant) throw bad('Permission denied', 403);
    if (curStatus === 'withdrawn') return { nextState: st };
    if (curStatus !== 'pending') {
      throw bad('Only pending applications may change; accepted members cannot withdraw', 409);
    }
  } else {
    if (!isLeader) throw bad('Permission denied', 403);
    const targetStatus = action === 'accept' ? 'accepted' : 'declined';
    if (curStatus === targetStatus) return { nextState: st }; // Idempotent
    if (curStatus !== 'pending') {
      throw bad('Only pending applications may change; accepted members cannot withdraw', 409);
    }
  }

  const nextApps = { ...st.apps };
  const nextManaged = { ...(st.managed ?? {}) };
  let nextVx = { ...st.vx };

  if (action === 'accept') {
    const tv = team(targetTeamId, st);
    if (tv.filled >= tv.target || tv.complete) {
      throw bad('Team has reached member target', 409);
    }
    const cv = comp(t.comp);
    if (cv.left < 0) throw bad('Registration has closed', 409);
    if (tv.closed) throw bad('Team recruitment is closed', 409);

    const roleOpen = tv.roleList.find((r) => r.id === targetRole);
    if (!roleOpen || roleOpen.qty <= 0) {
      throw bad('Role is already filled', 409);
    }

    const compTeams = TEAMS_BY_COMP[t.comp] || [];
    const inOtherTeam = compTeams.some(
      (otherId) => otherId !== targetTeamId && team(otherId, st).members.includes(applicantPid),
    );
    if (inOtherTeam) {
      throw bad('Applicant is already a member of another team for this competition', 409);
    }

    // Update managed team: add member, fill role, mark accepted
    const mState = ensureManaged(st, targetTeamId);
    const updatedAdded = mState.added.includes(applicantPid)
      ? mState.added
      : [...mState.added, applicantPid];
    const updatedFilled = [...mState.filled, targetRole];
    const updatedInbox = mState.apps.map((a) =>
      a.id === aid ? { ...a, status: 'accepted' as const } : a,
    );

    const updatedMState: VertexState = {
      ...mState,
      added: updatedAdded,
      filled: updatedFilled,
      apps: updatedInbox,
    };
    nextManaged[targetTeamId] = updatedMState;
    if (targetTeamId === 'vertex') nextVx = updatedMState;

    // Update applicant's outgoing application if it's the current user
    if (inOutgoing || applicantPid === 'me') {
      const existingOut = nextApps[targetTeamId];
      if (existingOut) {
        nextApps[targetTeamId] = { ...existingOut, status: 'accepted' };
      }
    }

    // ATOMIC: Withdraw competing pending applications for the same competition
    for (const otherTid of compTeams) {
      if (otherTid === targetTeamId) continue;
      // Withdraw in outgoing apps
      if (applicantPid === 'me' && nextApps[otherTid]?.status === 'pending') {
        nextApps[otherTid] = { ...nextApps[otherTid], status: 'withdrawn' };
      }
      // Withdraw in any managed team inbox
      const otherM = nextManaged[otherTid] || (otherTid === 'vertex' ? nextVx : undefined);
      if (otherM?.apps) {
        const hasCompeting = otherM.apps.some(
          (a) => a.pid === applicantPid && a.status === 'pending',
        );
        if (hasCompeting) {
          const updatedOtherM: VertexState = {
            ...otherM,
            apps: otherM.apps.map((a) =>
              a.pid === applicantPid && a.status === 'pending'
                ? { ...a, status: 'withdrawn' as const }
                : a,
            ),
          };
          nextManaged[otherTid] = updatedOtherM;
          if (otherTid === 'vertex') nextVx = updatedOtherM;
        }
      }
    }
  } else {
    // Decline or withdraw
    const newStatus = action === 'withdraw' ? 'withdrawn' : 'declined';
    if (inOutgoing) {
      nextApps[targetTeamId] = { ...nextApps[targetTeamId], status: newStatus };
    }
    const mState = nextManaged[targetTeamId] || (targetTeamId === 'vertex' ? nextVx : undefined);
    if (mState?.apps) {
      const updatedInbox = mState.apps.map((a) =>
        a.id === aid ? { ...a, status: newStatus as ApplicationStatus } : a,
      );
      const updatedMState: VertexState = { ...mState, apps: updatedInbox };
      nextManaged[targetTeamId] = updatedMState;
      if (targetTeamId === 'vertex') nextVx = updatedMState;
    }
  }

  const nextState: AppState = {
    ...st,
    apps: nextApps,
    managed: nextManaged,
    vx: nextVx,
  };

  return { nextState };
}

/**
 * P0-1 & P0-2: team invitations with unique IDs so invites don't overwrite each other.
 */
export function executeInvite(
  st: AppState,
  input: InviteInput,
): { nextState: AppState; invitationId: string } {
  if (!st.authed) throw bad('Sign in required', 401);

  const { teamId: tid, userId: pid, roleId: rid } = input;
  const actor = input.actorId || 'me';
  const t = TEAM_BY_ID[tid];
  if (!t) throw bad('Team not found', 404);

  const isLeader = t.leader === actor || team(tid, st).mine;
  if (!isLeader) throw bad('Permission denied', 403);

  const tv = team(tid, st);
  if (tv.closed) throw bad('Team is closed for recruitment', 409);
  if (tv.complete || tv.filled >= tv.target) throw bad('Team has reached member target', 409);
  if (tv.members.includes(pid)) throw bad('Student is already a member', 409);

  const roleOpen = tv.roleList.find((r) => r.id === rid);
  if (!roleOpen || roleOpen.qty <= 0) throw bad('Role is already filled', 409);

  const compTeams = TEAMS_BY_COMP[t.comp] || [];
  const inOtherTeam = compTeams.some(
    (otherId) => otherId !== tid && team(otherId, st).members.includes(pid),
  );
  if (inOtherTeam) throw bad('Student is already in a team for this competition', 409);

  const iid = genId('inv');
  // Store invite keyed by unique invitation ID to prevent overwriting
  const nextInvites = {
    ...st.invites,
    [iid]: { tid, rid, pid },
    // Also keep pid mapping for backwards compatibility if needed
    [pid]: { tid, rid },
  };

  const nextState: AppState = {
    ...st,
    invites: nextInvites,
  };

  return { nextState, invitationId: iid };
}

/**
 * P0-1 & P0-2: answer team invitation (accept/decline).
 */
export function executeAnswerInvite(
  st: AppState,
  input: AnswerInviteInput,
): { nextState: AppState } {
  if (!st.authed) throw bad('Sign in required', 401);

  const { invitationId: iid, action } = input;
  const incoming = (st.incomingInvites || []).find((i) => i.id === iid);
  if (!incoming) throw bad('Invitation not found', 404);

  const tid = incoming.team_id;
  const rid = incoming.role_id;
  const remaining = (st.incomingInvites || []).filter((i) => i.id !== iid);

  if (action === 'accept') {
    const t = TEAM_BY_ID[tid];
    if (!t) throw bad('Team not found', 404);
    const tv = team(tid, st);
    if (tv.filled >= tv.target || tv.complete) throw bad('Team has reached member target', 409);

    const mState = ensureManaged(st, tid);
    const updatedAdded = mState.added.includes('me') ? mState.added : [...mState.added, 'me'];
    const updatedFilled = [...mState.filled, rid];
    const updatedMState: VertexState = {
      ...mState,
      added: updatedAdded,
      filled: updatedFilled,
    };

    const nextManaged = {
      ...(st.managed ?? {}),
      [tid]: updatedMState,
    };

    const nextApps = {
      ...st.apps,
      [tid]: {
        id: genId('app'),
        role: rid,
        status: 'accepted' as const,
        when: 'Just now',
        shareContact: !!input.shareContact,
      },
    };

    // Withdraw competing pending applications for the same competition
    const compTeams = TEAMS_BY_COMP[t.comp] || [];
    for (const otherTid of compTeams) {
      if (otherTid !== tid && nextApps[otherTid]?.status === 'pending') {
        nextApps[otherTid] = { ...nextApps[otherTid], status: 'withdrawn' };
      }
    }

    const nextState: AppState = {
      ...st,
      incomingInvites: remaining,
      apps: nextApps,
      managed: nextManaged,
      vx: tid === 'vertex' ? updatedMState : st.vx,
    };

    return { nextState };
  } else {
    // Decline
    return {
      nextState: {
        ...st,
        incomingInvites: remaining,
      },
    };
  }
}

/**
 * Handle HTTP-style route dispatch in store.request for client-side prototype store.
 */
export function handleStoreRequest(
  st: AppState,
  path: string,
  method = 'GET',
  body?: unknown,
): { nextState: AppState; response: unknown } {
  // Normalize path without leading /api/v1 if present
  const route = path.replace(/^\/api\/v1/, '');

  if (method === 'POST') {
    // POST /teams/:id/applications
    const applyMatch = route.match(/^\/teams\/([^/]+)\/applications$/);
    if (applyMatch) {
      const b = (body as { role_id?: string; message?: string; share_contact?: boolean }) || {};
      const res = executeApply(st, {
        teamId: applyMatch[1],
        roleId: b.role_id ?? '',
        message: b.message ?? '',
        shareContact: b.share_contact,
      });
      return { nextState: res.nextState, response: { id: res.applicationId } };
    }

    // POST /applications/:id/:action
    const decisionMatch = route.match(/^\/applications\/([^/]+)\/(accept|decline|withdraw)$/);
    if (decisionMatch) {
      const res = executeDecision(st, {
        applicationId: decisionMatch[1],
        action: decisionMatch[2] as 'accept' | 'decline' | 'withdraw',
      });
      return { nextState: res.nextState, response: {} };
    }

    // POST /teams/:id/invitations
    const inviteMatch = route.match(/^\/teams\/([^/]+)\/invitations$/);
    if (inviteMatch) {
      const b = (body as { user_id?: string; role_id?: string }) || {};
      const res = executeInvite(st, {
        teamId: inviteMatch[1],
        userId: b.user_id ?? '',
        roleId: b.role_id ?? '',
      });
      return { nextState: res.nextState, response: { id: res.invitationId } };
    }

    // POST /invitations/:id/:action
    const answerMatch = route.match(/^\/invitations\/([^/]+)\/(accept|decline)$/);
    if (answerMatch) {
      const b = (body as { share_contact?: boolean }) || {};
      const res = executeAnswerInvite(st, {
        invitationId: answerMatch[1],
        action: answerMatch[2] as 'accept' | 'decline',
        shareContact: b.share_contact,
      });
      return { nextState: res.nextState, response: {} };
    }

    // POST /connections/:id
    const connMatch = route.match(/^\/connections\/([^/]+)$/);
    if (connMatch) {
      const pid = connMatch[1];
      const nextConns = { ...st.conns, [pid]: 'sent' as const };
      return { nextState: { ...st, conns: nextConns }, response: {} };
    }

    // POST /connections/:id/accept
    const connAcceptMatch = route.match(/^\/connections\/([^/]+)\/accept$/);
    if (connAcceptMatch) {
      const pid = connAcceptMatch[1];
      const nextConns = { ...st.conns, [pid]: 'connected' as const };
      return { nextState: { ...st, conns: nextConns }, response: {} };
    }

    // POST /notifications/:id/read
    const notifReadMatch = route.match(/^\/notifications\/([^/]+)\/read$/);
    if (notifReadMatch) {
      const nid = notifReadMatch[1];
      const nextRead = st.read.includes(nid) ? st.read : [...st.read, nid];
      return { nextState: { ...st, read: nextRead }, response: {} };
    }

    // POST /notifications/read
    if (route === '/notifications/read') {
      return { nextState: { ...st, read: ['n1', 'n2', 'n3', 'n4', 'n5'] }, response: {} };
    }

    // POST /login or /signup
    if (route === '/login' || route === '/signup') {
      return { nextState: { ...st, authed: true }, response: {} };
    }

    // POST /logout
    if (route === '/logout') {
      return { nextState: { ...st, authed: false }, response: {} };
    }
  }

  if (method === 'PATCH') {
    // PATCH /teams/:id
    const teamPatchMatch = route.match(/^\/teams\/([^/]+)$/);
    if (teamPatchMatch) {
      const tid = teamPatchMatch[1];
      const b = (body as { recruiting?: boolean; capacity?: number }) || {};
      const mState = ensureManaged(st, tid);
      const t = TEAM_BY_ID[tid];
      const cv = t ? comp(t.comp) : undefined;

      let nextTarget = mState.target;
      if (typeof b.capacity === 'number') {
        if (cv && (b.capacity < cv.min || b.capacity > cv.max)) {
          throw bad(`Capacity must be between ${cv.min} and ${cv.max}`);
        }
        const memberCount = (t?.members.length ?? 0) + mState.added.length;
        if (b.capacity < memberCount) {
          throw bad(`Capacity cannot be less than current member count (${memberCount})`);
        }
        nextTarget = b.capacity;
      }

      let nextClosed = mState.closed;
      if (typeof b.recruiting === 'boolean') {
        nextClosed = !b.recruiting;
      }

      const updatedMState: VertexState = {
        ...mState,
        target: nextTarget,
        closed: nextClosed,
      };

      const nextManaged = {
        ...(st.managed ?? {}),
        [tid]: updatedMState,
      };

      const nextState: AppState = {
        ...st,
        managed: nextManaged,
        vx: tid === 'vertex' ? updatedMState : st.vx,
      };

      return { nextState, response: {} };
    }
  }

  if (method === 'PUT') {
    // PUT /saved/:id
    const saveMatch = route.match(/^\/saved\/([^/]+)$/);
    if (saveMatch) {
      const cid = saveMatch[1];
      const nextSaved = st.saved.includes(cid) ? st.saved : [...st.saved, cid];
      return { nextState: { ...st, saved: nextSaved }, response: {} };
    }
  }

  if (method === 'DELETE') {
    // DELETE /saved/:id
    const unsaveMatch = route.match(/^\/saved\/([^/]+)$/);
    if (unsaveMatch) {
      const cid = unsaveMatch[1];
      const nextSaved = st.saved.filter((x) => x !== cid);
      return { nextState: { ...st, saved: nextSaved }, response: {} };
    }

    // DELETE /connections/:id
    const delConnMatch = route.match(/^\/connections\/([^/]+)$/);
    if (delConnMatch) {
      const pid = delConnMatch[1];
      const nextConns = { ...st.conns };
      delete nextConns[pid];
      return { nextState: { ...st, conns: nextConns }, response: {} };
    }
  }

  return { nextState: st, response: {} };
}
