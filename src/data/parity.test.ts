// Reference outputs recorded from the round 3 design prototype's data model.
// They pin every derived label, deadline and match score (with its reasons),
// so changes to the data or matching rules are deliberate.
import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/design-r3.json';
import { ALL_COMPETITIONS, PERSONS, TEAM_BY_ID, team, todayLabel, type CompetitionView, type TeamView } from './model';
import { bestFor, compsForMe, coverage, match, recsForTeam, relevance, teamsForMe, type Match } from './matching';
import { defaultState, type AppState } from './state';
import { TEAMS } from './seed';

const states: Record<string, AppState> = {
  initial: defaultState(),
  apexAccepted: (() => {
    const s = defaultState();
    s.apps.apex = { role: 'presenter', status: 'accepted', when: 'Just now' };
    s.apps.orion.status = 'withdrawn';
    return s;
  })(),
  vertexGrown: (() => {
    const s = defaultState();
    s.vx.added = ['livia'];
    s.vx.filled = ['designer'];
    s.vx.apps[0].status = 'accepted';
    s.vx.target = 4;
    return s;
  })(),
  vertexClosed: (() => {
    const s = defaultState();
    s.vx.closed = true;
    return s;
  })(),
};

const compView = (c: CompetitionView) => ({
  id: c.id, left: c.left, upcoming: c.upcoming, closing: c.closing, status: c.status, statusLabel: c.statusLabel, leftLabel: c.leftLabel, leftNum: c.leftNum, leftUnit: c.leftUnit,
  dlFg: c.dlFg, deadlineShort: c.deadlineShort, deadlineFull: c.deadlineFull, eventLabel: c.eventLabel, teamShort: c.teamShort, teamLong: c.teamLong,
  feeLabel: c.feeLabel, feeShort: c.feeShort, free: c.free, recruitLabel: c.recruitLabel, hasTeams: c.hasTeams, hasPoster: c.hasPoster,
  faces: c.faces.map((f) => [f.id, f.name, f.initials, f.bg, f.fg].join(' | ')), hueBg: c.hueBg, hueFg: c.hueFg, catUpper: c.catUpper, initials: c.initials,
  facList: c.facList.map((f) => f.code + ': ' + f.name), featuredOnly: c.featuredOnly,
  timeline: c.timelineList.map((t) => [t.label, t.date, t.past, t.next].join(' | ')), eligibility: c.eligibility, prizes: c.prizes.map((p) => [p.label, p.value].join(' | ')),
});
const teamView = (t: TeamView) => ({
  members: t.members, memberList: t.memberList.map((m) => [m.id, m.label, m.isLeader, m.isMe].join(' | ')), roleList: t.roleList.map((r) => [r.id, r.qtyLabel, r.skillsLine].join(' | ')),
  filled: t.filled, target: t.target, open: t.open, eligible: t.eligible, complete: t.complete, closed: t.closed, kind: t.kind,
  slots: t.slots.map((s) => [s.text, s.bg, s.fg, s.border, s.filled].join(' | ')), initial: t.initial, sizeLabel: t.sizeLabel, statusLabel: t.statusLabel,
  statusFg: t.statusFg, statusBg: t.statusBg, eligText: t.eligText, eligFg: t.eligFg, eligDot: t.eligDot, skillsLine: t.skillsLine, roleNames: t.roleNames,
  firstRole: t.firstRole, leaderName: t.leaderName, leaderFirst: t.leaderFirst, mine: t.mine, isMember: t.isMember, segs: t.segs.map((g) => g.bg + (g.mark ? ' mark' : '')),
});
const matchView = (m: Match | null) => m && ({ score: m.score, kind: m.kind, label: m.label, fg: m.fg, bg: m.bg, reasons: m.reasons, parts: m.parts, matched: m.matched, role: m.role.id, adds: m.adds, short: m.short });

describe('parity with the round 3 design data', () => {
  it('derives the same people', () => {
    expect(todayLabel).toBe(fixture.todayLabel);
    const people = Object.values(PERSONS).map((p) => ({
      id: p.id, bg: p.bg, fg: p.fg, initials: p.initials, first: p.first, facName: p.facName, cats: p.cats, rolesLine: p.rolesLine, mutual: p.mutual, connections: p.connections, about: p.about,
      exp: p.exp.map((e) => [e.title, e.result, e.year, e.org].join(' | ')), links: p.links.map((l) => [l.label, l.value].join(' | ')),
    }));
    expect(people).toEqual(fixture.people);
  });

  it('derives the same competition view models', () => {
    expect(ALL_COMPETITIONS.map(compView)).toEqual(fixture.comps);
  });

  it('recommends the same competitions and people', () => {
    expect(compsForMe()).toEqual(fixture.compsForMe);
    const rel = Object.keys(PERSONS).filter((id) => id !== 'me').map((id) => ({ id, ...relevance(id) }));
    expect(rel).toEqual(fixture.relevance);
  });

  it('scores every person against every role the same way', () => {
    for (const pid of Object.keys(PERSONS))
      for (const t of TEAMS)
        for (const r of TEAM_BY_ID[t.id].roles) {
          const key = `${pid}/${t.id}/${r.id}` as keyof typeof fixture.matches;
          expect(matchView(match(pid, t.id, r.id, states.initial)), key).toEqual(fixture.matches[key]);
        }
  });

  for (const [name, st] of Object.entries(states)) {
    it(`derives the same teams and recommendations (${name})`, () => {
      const expected = fixture.states[name as keyof typeof fixture.states];
      for (const t of TEAMS) {
        expect(teamView(team(t.id, st)), t.id).toEqual(expected.teams[t.id as keyof typeof expected.teams]);
        expect(matchView(bestFor('me', t.id, st)), t.id).toEqual(expected.bestForMe[t.id as keyof typeof expected.bestForMe]);
        expect(coverage(t.id, st), t.id).toEqual(expected.coverage[t.id as keyof typeof expected.coverage]);
      }
      expect(teamsForMe(st).map((x) => x.id + ' ' + x.m.score)).toEqual(expected.teamsForMe);
      const recs = Object.fromEntries(team('vertex', st).roleList.map((r) => [r.id, recsForTeam('vertex', r.id, st).map((x) => x.id + ' ' + x.m.score)]));
      expect(recs).toEqual(expected.recsForVertex);
    });
  }
});
