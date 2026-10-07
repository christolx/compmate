// Deterministic matching with published weights (max 100):
// preferred role 30 · required skills 25 · competition interest 15 ·
// availability 10 · experience preference 10 · team complementarity 5 ·
// profile completeness 5. Related skills count for half.
import { COMPETITIONS, RELATED_INTERESTS, ROLE_FAMILIES, TAXONOMY, TEAMS } from './seed';
import { PERSONS, SKILL_CATEGORY, TEAM_BY_ID, comp, team } from './model';
import type { AppState } from './state';
import type { MatchKind, Role } from './types';

export const MATCH_LABELS: Record<MatchKind, { label: string; fg: string; bg: string }> = {
  strong: { label: 'Strong match', fg: '#4338CA', bg: '#EEF0FF' },
  good: { label: 'Good match', fg: '#1D4ED8', bg: '#EFF4FF' },
  potential: { label: 'Potential match', fg: '#475569', bg: '#F1F5F9' },
};

export const MATCH_WEIGHTS: [string, number][] = [
  ['Preferred role', 30],
  ['Required skills', 25],
  ['Competition interest', 15],
  ['Availability', 10],
  ['Experience preference', 10],
  ['Team complementarity', 5],
  ['Profile completeness', 5],
];

function kindOf(score: number): MatchKind | null {
  return score >= 80 ? 'strong' : score >= 60 ? 'good' : score >= 40 ? 'potential' : null;
}

function relatedInterest(interests: string[], tag: string) {
  return interests.some((i) => (RELATED_INTERESTS[tag] || []).includes(i) || (RELATED_INTERESTS[i] || []).includes(tag));
}

export interface Match {
  score: number;
  /** null when the score is below 40: not shown as a match at all. */
  kind: MatchKind | null;
  label: string;
  fg: string;
  bg: string;
  reasons: string[];
  parts: Record<string, number>;
  matched: string[];
  role: Role;
  adds: string[];
  short: string;
}

/** How well person `pid` fits role `rid` on team `tid`. */
export function match(pid: string, tid: string, rid: string, st: AppState): Match {
  const p = PERSONS[pid];
  const t = team(tid, st);
  const role = TEAM_BY_ID[tid].roles.find((r) => r.id === rid)!;
  const c = t.c;
  const you = pid === 'me';
  const parts: Record<string, number> = {};
  const reasons: string[] = [];

  if (p.roles.includes(role.name)) {
    parts.role = 30;
    reasons.push(you ? role.name + ' is one of your preferred roles' : 'Preferred role: ' + role.name);
  } else {
    const fam = ROLE_FAMILIES.find((f) => f.includes(role.name) && p.roles.some((r) => f.includes(r)));
    parts.role = fam ? 15 : 0;
    if (fam) reasons.push((you ? 'You prefer ' : 'Prefers ') + p.roles.find((r) => fam.includes(r)) + ', a related role');
  }

  let exact = 0;
  let related = 0;
  const matched: string[] = [];
  for (const s of role.skills) {
    if (p.skills.includes(s)) {
      exact++;
      matched.push(s);
    } else if (p.skills.some((x) => SKILL_CATEGORY[x] === SKILL_CATEGORY[s])) related++;
  }
  parts.skills = Math.round((25 * (exact + related * 0.5)) / role.skills.length);
  if (exact) reasons.push((you ? '' : 'Matches ') + exact + ' of ' + role.skills.length + ' skills' + (you ? ' match' : '') + (related ? ', ' + related + ' related' : ''));

  if (p.interests.includes(c.interest)) {
    parts.interest = 15;
    reasons.push(you ? c.interest + ' is one of your interests' : 'Interested in ' + c.interest);
  } else parts.interest = relatedInterest(p.interests, c.interest) ? 8 : 0;

  if (p.avail === t.avail) {
    parts.avail = 10;
    reasons.push(t.avail + ' availability matches');
  } else parts.avail = p.avail === 'Flexible' || t.avail === 'Flexible' ? 6 : 0;

  if (t.level === 'Beginner friendly') parts.exp = 10;
  else {
    parts.exp = p.level === 'Experienced' ? 10 : p.level === 'Some experience' ? 6 : 3;
    if (p.level === 'Experienced') reasons.push('Has the competition experience the team prefers');
  }

  const teamCats = new Set<string>();
  t.members.forEach((m) => PERSONS[m].cats.forEach((k) => teamCats.add(k)));
  const adds = p.cats.filter((k) => !teamCats.has(k) && role.skills.some((s) => SKILL_CATEGORY[s] === k));
  parts.comp = adds.length ? 5 : 0;
  if (adds.length) reasons.push((you ? 'You add ' : 'Adds ') + adds[0] + ' skills ' + (you ? 'the team is missing' : 'your team currently needs'));

  parts.profile = Math.round(5 * p.complete);

  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const kind = kindOf(score);
  const L = MATCH_LABELS[kind ?? 'potential'];
  return {
    score,
    kind,
    label: L.label,
    fg: L.fg,
    bg: L.bg,
    reasons,
    parts,
    matched,
    role,
    adds,
    short: you
      ? reasons.slice(0, 2).join(' · ')
      : 'Matches your ' + role.name + ' opening' + (exact ? ' and ' + exact + ' relevant skill' + (exact > 1 ? 's' : '') : ''),
  };
}

/** The open role on `tid` that suits `pid` best, or null if none is open. */
export function bestFor(pid: string, tid: string, st: AppState): Match | null {
  return team(tid, st).roleList.map((r) => match(pid, tid, r.id, st)).sort((a, b) => b.score - a.score)[0] || null;
}

/** Teams the sample user could still join, best match first. */
export function teamsForMe(st: AppState): { id: string; m: Match }[] {
  const busy = TEAMS.filter((t) => team(t.id, st).members.includes('me')).map((t) => t.comp);
  return TEAMS.filter((t) => !busy.includes(t.comp) && !st.apps[t.id])
    .map((t) => ({ id: t.id, m: bestFor('me', t.id, st) }))
    .filter((x): x is { id: string; m: Match } => !!x.m?.kind)
    .sort((a, b) => b.m.score - a.m.score);
}

/** Open competitions for the sample user, with the reasons spelled out. */
export function compsForMe(): { id: string; s: number; reason: string }[] {
  const me = PERSONS.me;
  return COMPETITIONS.filter((c) => !comp(c.id).upcoming)
    .map((c) => {
      const exact = c.skills.filter((s) => me.skills.includes(s));
      let s = 0;
      const why: string[] = [];
      if (me.interests.includes(c.interest)) {
        s += 15;
        why.push(c.interest + ' interest');
      } else if (relatedInterest(me.interests, c.interest)) s += 8;
      s += exact.length * 6;
      if (exact.length) why.push(exact.slice(0, 2).join(', ') + ' skill' + (exact.length > 1 ? 's' : ''));
      const demand = TEAMS.filter((t) => t.comp === c.id && t.roles.some((r) => me.roles.includes(r.name))).length;
      s += demand * 4;
      if (demand && why.length < 2) why.push(demand + ' team' + (demand > 1 ? 's' : '') + ' need a ' + me.roles[0]);
      return { id: c.id, s, reason: why.length ? 'Recommended because: ' + why.join(' · ') : '' };
    })
    .sort((a, b) => b.s - a.s);
}

/** People outside the team who fit role `rid`, best first. */
export function recsForTeam(tid: string, rid: string, st: AppState): { id: string; m: Match }[] {
  const t = team(tid, st);
  return Object.keys(PERSONS)
    .filter((id) => id !== 'me' && !t.members.includes(id))
    .map((id) => ({ id, m: match(id, tid, rid, st) }))
    .filter((x) => x.m.kind)
    .sort((a, b) => b.m.score - a.m.score);
}

export interface Relevance { score: number; kind: MatchKind | null; label: string; fg: string; bg: string; reasons: string[]; short: string }

/** How relevant `pid` is to the sample user (Discover people, "For you"). */
export function relevance(pid: string): Relevance {
  const p = PERSONS[pid];
  const me = PERSONS.me;
  let s = 0;
  const why: string[] = [];
  const shared = p.interests.filter((i) => me.interests.includes(i));
  s += Math.min(40, shared.length * 20);
  if (shared.length) why.push('Shares your ' + shared.join(' & ') + ' interest' + (shared.length > 1 ? 's' : ''));
  const brings = p.cats.filter((k) => !me.cats.includes(k));
  s += Math.min(20, brings.length * 10);
  if (brings.length) why.push('Brings ' + brings.slice(0, 2).join(' & ') + ' skills');
  if (p.avail === me.avail) s += 15;
  else if (p.avail === 'Flexible') s += 8;
  s += Math.round(5 * p.complete) + (p.level === 'Experienced' ? 10 : p.level === 'Some experience' ? 6 : 3);
  const kind = kindOf(s);
  const L = MATCH_LABELS[kind ?? 'potential'];
  return { score: s, kind, label: L.label, fg: L.fg, bg: L.bg, reasons: why, short: why[0] || 'Studies ' + p.program };
}

export interface Coverage { name: string; covered: boolean; who: string; missing: boolean }

/** Skill areas the team covers today versus what its open roles need. */
export function coverage(tid: string, st: AppState): Coverage[] {
  const t = team(tid, st);
  const have: Record<string, string[]> = {};
  t.members.forEach((m) => PERSONS[m].cats.forEach((k) => (have[k] = have[k] || []).push(m === 'me' ? 'You' : PERSONS[m].first)));
  const need = [...new Set(t.roleList.flatMap((r) => r.skills.map((s) => SKILL_CATEGORY[s])))];
  return Object.keys(TAXONOMY)
    .filter((k) => have[k] || need.includes(k))
    .map((k) => ({ name: k, covered: !!have[k], who: have[k] ? [...new Set(have[k])].join(', ') : 'Nobody yet', missing: !have[k] && need.includes(k) }));
}
