import { TEAM_BY_ID, TEAMS_BY_COMP, comp, getClock, team, type CompetitionView, type TeamView } from './model';
import type { AppState } from './state';
import type { Team } from './types';

/**
 * Returns true if a competition is currently open for registration
 * (not expired, not closed, and already opened).
 */
export function isCompetitionRecruiting(cid: string, clock = getClock()): boolean {
  const c = comp(cid, clock);
  return c.left >= 0 && c.status !== 'closed' && !c.upcoming;
}

/**
 * P1-4 Shared selector: determines if a team is actively recruiting members.
 * A team is recruiting if:
 * 1. Its competition registration has not closed/expired (left >= 0, status != 'closed')
 * 2. The team has not manually closed recruitment (!closed)
 * 3. The team is not full / complete (!complete, filled < target, open > 0)
 * 4. The team has at least one open role with remaining capacity
 * 5. The team is not moderated or hidden
 */
export function isRecruiting(
  teamOrId: TeamView | Team | string,
  st?: AppState,
  clock = getClock(),
): boolean {
  let tv: TeamView;
  if (typeof teamOrId === 'string') {
    if (!st) return false;
    tv = team(teamOrId, st);
  } else if ('memberList' in teamOrId) {
    tv = teamOrId;
  } else {
    if (!st) return false;
    tv = team(teamOrId.id, st);
  }

  // Guard missing team
  if (!tv || tv.name === 'Team not found') return false;

  // 1. Competition not expired
  const cv = comp(tv.comp, clock);
  if (cv.left < 0 || cv.status === 'closed') return false;

  // 2. Team recruitment not closed
  if (tv.closed || tv.recruiting === false) return false;

  // 3. Team is not full / complete
  if (tv.complete || tv.filled >= tv.target || tv.open <= 0) return false;

  // 4. Team has open roles
  if (!tv.roleList.length || !tv.roleList.some((r) => r.qty > 0)) return false;

  // 5. Moderation check
  if ((tv as unknown as { moderated?: boolean }).moderated) return false;

  return true;
}

export interface CanApplyResult {
  ok: boolean;
  reason?: string;
  block?: 'member' | 'applied' | 'full' | 'closed';
}

/**
 * P1-4 Shared selector: determines if the current user can apply to a team.
 * Replaces disparate checks in Team.tsx, matching.ts, and ApplySheet.
 */
export function canApply(
  teamId: string,
  st: AppState,
  roleId?: string,
  clock = getClock(),
): CanApplyResult {
  const t = TEAM_BY_ID[teamId];
  if (!t) return { ok: false, reason: 'Team not found' };

  const tv = team(teamId, st);
  const cv = comp(t.comp, clock);

  // Competition expired
  if (cv.left < 0 || cv.status === 'closed') {
    return { ok: false, reason: 'Registration has closed', block: 'closed' };
  }

  // Team closed
  if (tv.closed || tv.recruiting === false) {
    return { ok: false, reason: 'Team is not recruiting', block: 'closed' };
  }

  // Team complete / full
  if (tv.complete || tv.filled >= tv.target || tv.open <= 0) {
    return { ok: false, reason: 'This team has reached its member target', block: 'full' };
  }

  // Own team
  if (tv.mine) {
    return { ok: false, reason: 'This is your own team' };
  }

  // Already a member
  if (tv.isMember) {
    return { ok: false, reason: "You're already on this team", block: 'member' };
  }

  // Already applied (pending or accepted)
  const existingApp = st.apps[teamId];
  if (existingApp && (existingApp.status === 'pending' || existingApp.status === 'accepted')) {
    return {
      ok: false,
      reason: 'Application ' + existingApp.status,
      block: 'applied',
    };
  }

  // Already in another team for the same competition
  const compTeams = TEAMS_BY_COMP[t.comp] || [];
  const inOtherTeam = compTeams.some(
    (otherId) => otherId !== teamId && team(otherId, st).isMember,
  );
  if (inOtherTeam) {
    return {
      ok: false,
      reason: 'You are already a member of another team for this competition',
      block: 'member',
    };
  }

  // Role availability
  if (roleId) {
    const role = tv.roleList.find((r) => r.id === roleId);
    if (!role || role.qty <= 0) {
      return { ok: false, reason: 'This role is already filled', block: 'full' };
    }
  } else if (!tv.roleList.length || !tv.roleList.some((r) => r.qty > 0)) {
    return { ok: false, reason: 'No open roles available', block: 'full' };
  }

  return { ok: true };
}

/**
 * Returns the deadline status of a competition with clock injection.
 */
export function getCompetitionStatus(
  cid: string,
  clock = getClock(),
): 'upcoming' | 'closing' | 'open' | 'closed' {
  const c = comp(cid, clock);
  return c.status;
}

/**
 * Filter competitions by deadline keyword with lower bound protection
 * so expired competitions (left < 0) are never included.
 */
export function testDeadlineFilter(
  c: CompetitionView,
  range: 'week' | '2w' | 'month',
): boolean {
  if (c.left < 0) return false;
  if (range === 'week') return c.left <= 7;
  if (range === '2w') return c.left <= 14;
  if (range === 'month') return c.left <= 31;
  return false;
}
