import type { PersonSeed } from '../data/types';

type ProfileFields = Pick<PersonSeed, 'program' | 'roles' | 'skills' | 'interests' | 'about' | 'links'>;

/** What a profile still needs, in the order the editor shows fields. */
export function profileGaps(p: ProfileFields): string[] {
  const gaps: string[] = [];
  if (!p.program || p.program === 'Student') gaps.push('study program');
  if (!p.roles.length) gaps.push('preferred roles');
  if (!p.skills.length) gaps.push('skills');
  if (!p.interests.length) gaps.push('competition interests');
  if ((p.about || '').trim().length < 20) gaps.push('a short introduction');
  if (!p.links?.some((l) => !l.example)) gaps.push('a public link');
  return gaps;
}

const CHECKS = 6;

/** Profile completeness 0–1, derived from real fields (never self-reported). */
export function profileCompleteness(p: ProfileFields): number {
  return (CHECKS - profileGaps(p).length) / CHECKS;
}
