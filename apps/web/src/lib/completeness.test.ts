import { describe, expect, it } from 'vitest';
import { profileCompleteness, profileGaps } from './completeness';

const empty = { program: 'Student', roles: [], skills: [], interests: [], about: '', links: [] };

describe('profile completeness', () => {
  it('scores an empty profile as 0 and lists every gap', () => {
    expect(profileCompleteness(empty)).toBe(0);
    expect(profileGaps(empty)).toHaveLength(6);
  });

  it('ignores example links and short introductions', () => {
    const p = { ...empty, about: 'Hi', links: [{ label: 'LinkedIn', value: 'https://www.linkedin.com/', example: true }] };
    expect(profileGaps(p)).toContain('a public link');
    expect(profileGaps(p)).toContain('a short introduction');
  });

  it('scores a full profile as 1', () => {
    const full = {
      program: 'Computer Science',
      roles: ['Developer'],
      skills: ['React'],
      interests: ['Hackathon'],
      about: 'I build web apps for student hackathons.',
      links: [{ label: 'Portfolio', value: 'https://me.dev' }],
    };
    expect(profileCompleteness(full)).toBe(1);
    expect(profileGaps(full)).toEqual([]);
  });
});
