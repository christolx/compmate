import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from './state';
import { setClock, getClock, comp, team, type CompetitionView } from './model';
import { isRecruiting, canApply, getCompetitionStatus, testDeadlineFilter } from './selectors';
import { compsForMe, teamsForMe } from './matching';

describe('P1-4 Shared selectors and clock injection', () => {
  beforeEach(() => {
    // Reset clock to 6 Oct 2026 (baseline fixture date)
    setClock(new Date(2026, 9, 6));
  });

  describe('isRecruiting', () => {
    it('returns true for a team with open seats and active competition', () => {
      const st = defaultState();
      expect(isRecruiting('vertex', st)).toBe(true);
      expect(isRecruiting('apex', st)).toBe(true);
    });

    it('returns false when a team is full / complete', () => {
      const st = defaultState();
      // Simulate vertex reaching capacity
      const fullVertex = {
        ...team('vertex', st),
        complete: true,
        filled: 4,
        target: 4,
        open: 0,
      };
      expect(isRecruiting(fullVertex, st)).toBe(false);
    });

    it('returns false when recruitment is closed', () => {
      const st = defaultState();
      const closedVertex = {
        ...team('vertex', st),
        closed: true,
      };
      expect(isRecruiting(closedVertex, st)).toBe(false);
    });

    it('returns false when the competition registration deadline has passed', () => {
      const st = defaultState();
      // Fast forward clock to 2027
      const futureClock = new Date(2027, 0, 1);
      expect(isRecruiting('vertex', st, futureClock)).toBe(false);
    });
  });

  describe('canApply', () => {
    it('allows applying to a valid open team', () => {
      const st = defaultState();
      // apex is in comp: nbcc, where me has no membership
      const res = canApply('apex', st);
      expect(res.ok).toBe(true);
    });

    it('blocks applying if applicant is already on another team in the same competition', () => {
      const st = defaultState();
      // Me is on vertex (comp: techno), so cannot apply to lumen (also comp: techno)
      const res = canApply('lumen', st);
      expect(res.ok).toBe(false);
      expect(res.block).toBe('member');
    });

    it('blocks applying if already applied (pending or accepted)', () => {
      const st = defaultState();
      st.apps['nexus'] = {
        id: 'nexus',
        role: 'Frontend',
        status: 'pending',
        when: '2026-10-06',
      };
      const res = canApply('nexus', st);
      expect(res.ok).toBe(false);
      expect(res.block).toBe('applied');
    });

    it('blocks applying if the team is complete / full', () => {
      const st = defaultState();
      st.managed = {
        apex: {
          added: ['other1'],
          filled: ['designer'],
          target: 2,
          closed: false,
          apps: [],
        },
      };
      const res = canApply('apex', st);
      expect(res.ok).toBe(false);
      expect(res.block).toBe('full');
    });

    it('blocks applying if a specific requested role is filled', () => {
      const st = defaultState();
      const res = canApply('apex', st, 'nonexistent-role');
      expect(res.ok).toBe(false);
      expect(res.block).toBe('full');
    });

    it('blocks applying when competition has expired', () => {
      const st = defaultState();
      const futureClock = new Date(2027, 0, 1);
      const res = canApply('apex', st, undefined, futureClock);
      expect(res.ok).toBe(false);
      expect(res.block).toBe('closed');
    });
  });

  describe('Clock injection & deadline filters', () => {
    it('allows updating global clock via setClock', () => {
      expect(getClock().getFullYear()).toBe(2026);
      setClock(new Date(2027, 5, 1));
      expect(getClock().getFullYear()).toBe(2027);

      const c = comp('icpc-2026');
      expect(c.left).toBeLessThan(0);
      expect(c.status).toBe('closed');
      expect(getCompetitionStatus('icpc-2026')).toBe('closed');
    });

    it('excludes expired competitions from testDeadlineFilter', () => {
      const expiredComp = {
        id: 'old-comp',
        title: 'Old Comp',
        deadline: '2025-01-01',
        left: -10,
        status: 'closed' as const,
      } as unknown as CompetitionView;

      expect(testDeadlineFilter(expiredComp, 'week')).toBe(false);
      expect(testDeadlineFilter(expiredComp, '2w')).toBe(false);
      expect(testDeadlineFilter(expiredComp, 'month')).toBe(false);
    });

    it('excludes expired competitions from compsForMe and teamsForMe recommendations', () => {
      const st = defaultState();
      // With clock in 2027, all 2026 competitions are expired
      setClock(new Date(2027, 0, 1));
      const comps = compsForMe();
      expect(comps.length).toBe(0);

      const teams = teamsForMe(st);
      expect(teams.length).toBe(0);
    });
  });
});
