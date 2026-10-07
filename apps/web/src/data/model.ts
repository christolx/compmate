// View models: everything the screens render is derived here from the seed
// data plus the current app state, so components stay presentational.
import { COMPETITIONS, FACULTIES, GROUPS, HUES, PEOPLE, TAXONOMY, TEAMS, TODAY } from './seed';
import type { AppState } from './state';
import type { Avatar, Competition, FacultyCode, Person, Prize, Role, Slot, Team } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** "17 Oct 2026" */
export function formatDate(iso: string) {
  const x = parseDate(iso);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}
/** "17 Oct" */
export function formatShortDate(iso: string) {
  const x = parseDate(iso);
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
}
export function daysUntil(iso: string) {
  return Math.round((parseDate(iso).getTime() - TODAY.getTime()) / 864e5);
}
/** "Tuesday, 6 October" */
export const todayLabel = `${WEEKDAYS[TODAY.getDay()]}, ${TODAY.getDate()} ${LONG_MONTHS[TODAY.getMonth()]}`;

/** Skill → category, e.g. Pitching → Communication. */
export const SKILL_CATEGORY: Record<string, string> = {};
for (const [cat, skills] of Object.entries(TAXONOMY)) for (const s of skills) SKILL_CATEGORY[s] = cat;

export const PERSONS: Record<string, Person> = {};
Object.entries(PEOPLE).forEach(([id, p], i) => {
  const [hueBg, hueFg] = HUES[i % HUES.length];
  PERSONS[id] = {
    ...p,
    id,
    bg: id === 'me' ? '#2563EB' : hueBg,
    fg: id === 'me' ? '#FFFFFF' : hueFg,
    initials: p.name.split(' ').map((w) => w[0]).slice(0, 2).join(''),
    first: p.name.split(' ')[0],
    facName: FACULTIES[p.fac],
    cats: [...new Set(p.skills.map((s) => SKILL_CATEGORY[s]))],
    rolesLine: p.roles.join(' · '),
    mutual: p.mutual || 0,
    connections: p.connections || 20 + ((i * 7) % 60),
    about: p.about || `Interested in ${p.interests.join(' and ').toLowerCase().replace('ui/ux', 'UI/UX')} competitions.`,
    exp: p.exp || [],
    links: p.links || [{ label: 'LinkedIn', value: 'linkedin.com/in/' + p.name.toLowerCase().replace(/ /g, '') }],
  };
});

export const COMPETITION_BY_ID: Record<string, Competition> = Object.fromEntries(COMPETITIONS.map((c) => [c.id, c]));
export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
/** Team ids per competition, in seed order. */
export const TEAMS_BY_COMP: Record<string, string[]> = {};
for (const c of COMPETITIONS) TEAMS_BY_COMP[c.id] = TEAMS.filter((t) => t.comp === c.id).map((t) => t.id);

export function avatar(id: string): Avatar {
  const p = PERSONS[id];
  return { id, name: id === 'me' ? 'You' : p.name, initials: p.initials, bg: p.bg, fg: p.fg };
}

export interface TimelineItem { label: string; date: string; past: boolean; next: boolean }

export interface CompetitionView extends Omit<Competition, 'eligibility' | 'prizes'> {
  left: number;
  upcoming: boolean;
  closing: boolean;
  hasPoster: boolean;
  status: 'upcoming' | 'closing' | 'open';
  statusLabel: string;
  leftLabel: string;
  leftNum: string;
  leftUnit: string;
  /** Deadline text color: amber while closing soon. */
  dlFg: string;
  deadlineShort: string;
  deadlineFull: string;
  eventLabel: string;
  teamShort: string;
  teamLong: string;
  feeLabel: string;
  feeShort: string;
  free: boolean;
  recruitLabel: string;
  hasTeams: boolean;
  faces: Avatar[];
  hueBg: string;
  hueFg: string;
  catUpper: string;
  initials: string;
  facList: { code: FacultyCode; name: string }[];
  featuredOnly: boolean;
  timelineList: TimelineItem[];
  eligibility: string[];
  prizes: Prize[];
}

const compCache = new Map<string, CompetitionView>();

export function comp(id: string): CompetitionView {
  const cached = compCache.get(id);
  if (cached) return cached;
  const c = COMPETITION_BY_ID[id];
  const left = daysUntil(c.deadline);
  const upcoming = daysUntil(c.open) > 0;
  const closing = !upcoming && left >= 0 && left <= 7;
  const hue = HUES[(GROUPS.indexOf(c.group) + 6) % HUES.length];
  const faceIds = [...new Set(TEAMS.filter((t) => t.comp === id).flatMap((t) => t.members).filter((x) => x !== 'me'))]
    .concat(['raka', 'nadia', 'rizky', 'sarah'])
    .slice(0, 3);
  const milestones = c.timeline || [{ label: 'Registration closes', date: c.deadline }, { label: 'Event', date: c.event }];
  const vm: CompetitionView = {
    ...c,
    left,
    upcoming,
    closing,
    hasPoster: !!c.poster,
    status: upcoming ? 'upcoming' : closing ? 'closing' : 'open',
    statusLabel: upcoming ? 'Opens ' + formatShortDate(c.open) : closing ? 'Closing soon' : 'Registration open',
    leftLabel: upcoming ? 'Opens ' + formatShortDate(c.open) : left === 0 ? 'Closes today' : left === 1 ? '1 day left' : left + ' days left',
    leftNum: upcoming ? formatShortDate(c.open) : String(left),
    leftUnit: upcoming ? 'opens' : left === 1 ? 'day left' : 'days left',
    dlFg: closing ? '#B45309' : '#0F172A',
    deadlineShort: formatShortDate(c.deadline),
    deadlineFull: formatDate(c.deadline),
    eventLabel: formatDate(c.event),
    teamShort: c.part === 'either' ? 'Solo–' + c.max : c.min === c.max ? String(c.min) : c.min + '–' + c.max,
    teamLong: c.part === 'either' ? 'Solo or teams up to ' + c.max : c.min === c.max ? 'Teams of ' + c.min : c.min + '–' + c.max + ' people',
    feeLabel: c.fee ? 'Rp' + c.fee.toLocaleString('id-ID') + ' / team' : 'Free',
    feeShort: c.fee ? 'Rp' + c.fee / 1000 + 'k' : 'Free',
    free: !c.fee,
    recruitLabel: c.teamsCount ? c.teamsCount + ' teams recruiting' : 'No teams yet',
    hasTeams: c.teamsCount > 0,
    faces: faceIds.map(avatar),
    hueBg: hue[0],
    hueFg: hue[1],
    catUpper: c.cat.toUpperCase(),
    initials: c.org.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    facList: c.facs.map((code) => ({ code, name: FACULTIES[code] })),
    featuredOnly: !!c.featured && !closing,
    timelineList: milestones.map(({ label, date }, i, arr) => ({
      label,
      date: formatDate(date),
      past: daysUntil(date) < 0,
      next: daysUntil(date) >= 0 && (i === 0 || daysUntil(arr[i - 1].date) < 0),
    })),
    eligibility: c.eligibility || ['Active university students in Indonesia', 'Members may come from any faculty'],
    prizes: c.prizes || [],
  };
  compCache.set(id, vm);
  return vm;
}

export const ALL_COMPETITIONS: CompetitionView[] = COMPETITIONS.map((c) => comp(c.id));

export interface RoleView extends Role { qtyLabel: string; skillsLine: string }
export interface MemberView extends Person { label: string; isLeader: boolean; isMe: boolean }

export interface TeamView extends Omit<Team, 'members' | 'target'> {
  c: CompetitionView;
  members: string[];
  memberList: MemberView[];
  /** Roles still open. `roles` keeps every role the team ever listed. */
  roleList: RoleView[];
  filled: number;
  target: number;
  open: number;
  eligible: boolean;
  complete: boolean;
  closed: boolean;
  kind: 'closed' | 'complete' | 'recruiting';
  slots: Slot[];
  initial: string;
  sizeLabel: string;
  statusLabel: string;
  statusFg: string;
  statusBg: string;
  eligText: string;
  eligFg: string;
  eligDot: string;
  skillsLine: string;
  roleNames: string;
  firstRole: string;
  leaderName: string;
  leaderFirst: string;
  /** The sample user leads this team. */
  mine: boolean;
  isMember: boolean;
  segs: { bg: string; mark: boolean }[];
}

export function team(id: string, st: AppState): TeamView {
  const t = TEAM_BY_ID[id];
  const c = comp(t.comp);
  let members = t.members.slice();
  let filledRoles: string[] = [];
  let target = t.target;
  let closed = false;
  if (id === 'apex' && st.apps.apex?.status === 'accepted') {
    members.push('me');
    filledRoles.push('presenter');
  }
  if (id === 'vertex') {
    members = members.concat(st.vx.added);
    filledRoles = st.vx.filled;
    target = st.vx.target;
    closed = st.vx.closed;
  }
  const roles = t.roles.filter((r) => !filledRoles.includes(r.id));
  const filled = members.length;
  const open = Math.max(0, target - filled);
  const eligible = filled >= c.min;
  const complete = filled >= target;
  const need = c.min - filled;
  const slots: Slot[] = [];
  for (let i = 0; i < target; i++) {
    if (i < filled) {
      const a = avatar(members[i]);
      slots.push({ text: a.initials, bg: a.bg, fg: a.fg, border: '0', filled: true });
    } else slots.push({ text: '+', bg: '#FFFFFF', fg: '#94A3B8', border: '1.5px dashed #A3AEC2', filled: false });
  }
  return {
    ...t,
    c,
    members,
    memberList: members.map((m) => ({ ...PERSONS[m], label: m === 'me' ? 'You' : PERSONS[m].name, isLeader: m === t.leader, isMe: m === 'me' })),
    roleList: roles.map((r) => ({ ...r, qtyLabel: r.qty + (r.qty > 1 ? ' openings' : ' opening'), skillsLine: r.skills.join(' · ') })),
    filled,
    target,
    open,
    eligible,
    complete,
    closed,
    kind: closed ? 'closed' : complete ? 'complete' : 'recruiting',
    slots,
    initial: t.name[0],
    sizeLabel: filled + ' of ' + target + ' members',
    statusLabel: closed ? 'Closed' : complete ? 'Team complete' : 'Recruiting',
    statusFg: closed ? '#475569' : complete ? '#15803D' : '#1D4ED8',
    statusBg: closed ? '#F1F5F9' : complete ? '#ECFDF3' : '#EFF4FF',
    eligText: complete
      ? 'Team complete'
      : eligible
        ? 'Competition eligible · ' + open + (open === 1 ? ' spot' : ' spots') + ' left'
        : need + ' more member' + (need > 1 ? 's' : '') + ' needed to become eligible',
    eligFg: eligible ? '#15803D' : '#B45309',
    eligDot: eligible ? '#22C55E' : '#F59E0B',
    skillsLine: [...new Set(roles.flatMap((r) => r.skills))].slice(0, 4).join(' · '),
    roleNames: roles.map((r) => r.name).join(', '),
    firstRole: roles.length ? roles[0].name : '',
    leaderName: t.leader === 'me' ? 'you' : PERSONS[t.leader].name,
    leaderFirst: t.leader === 'me' ? 'You' : PERSONS[t.leader].first,
    mine: t.leader === 'me',
    isMember: members.includes('me'),
    segs: Array.from({ length: target }, (_, i) => ({ bg: i < filled ? '#2563EB' : '#E2E8F0', mark: i === c.min - 1 && c.min < target })),
  };
}

/** Teams recruiting for a competition, in seed order. */
export function teamsFor(compId: string, st: AppState): TeamView[] {
  return TEAMS.filter((t) => t.comp === compId).map((t) => team(t.id, st));
}
