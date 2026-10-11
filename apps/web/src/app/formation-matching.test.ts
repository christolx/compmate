import { describe, expect, it } from 'vitest';
import { rankEligibleTeams } from './formation-matching';
const team = (id: string, skills: string, eligible = true, filled = 0) => ({ id, eligible, roles: [{ skills, capacity: 1, filled }] });
describe('real team recommendations', () => {
    it('filters eligibility before scoring', () => {
        const result = rankEligibleTeams([team('closed', 'Go, Design', false), team('open', 'Design')], 'Go, Design');
        expect(result.map(x => x.team.id)).toEqual(['open']);
    });
    it('ranks by exact skills and explains matches', () => {
        const result = rankEligibleTeams([team('partial', 'MongoDB'), team('fit', 'Go, Design'), team('other', 'Design')], 'GO, Design');
        expect(result.map(x => x.team.id)).toEqual(['fit', 'other', 'partial']);
        expect(result[0].skills).toEqual(['go', 'design']);
        expect(result[2].skills).toEqual([]);
    });
    it('does not rank a filled role as a match', () => {
        expect(rankEligibleTeams([team('filled', 'Go', true, 1)], 'Go')[0].skills).toEqual([]);
    });
    it('deduplicates profile skills and trims whitespace', () => {
        expect(rankEligibleTeams([team('fit', ' Go , Design ')], ' go, GO, ,Design ')[0].skills).toEqual(['go', 'design']);
    });
    it('handles empty skills with stable ordering', () => {
        expect(rankEligibleTeams([team('first', ''), team('second', 'Go')], '').map(x => x.team.id)).toEqual(['first', 'second']);
    });
});
