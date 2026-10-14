import { describe, expect, it } from 'vitest';
import { exampleRegistrationUrl, profileLinkDestination } from './exampleLinks';

describe('profile and registration destinations', () => {
  it('opens Instagram handles externally', () => {
    expect(profileLinkDestination({ label: 'Instagram', value: '@student.design' })).toEqual({
      href: 'https://www.instagram.com/student.design/', example: false,
    });
  });
  it('uses labeled examples for invalid or missing profile URLs', () => {
    expect(profileLinkDestination({ label: 'LinkedIn', value: '' })).toEqual({ href: 'https://www.linkedin.com/', example: true });
    expect(profileLinkDestination({ label: 'Portfolio', value: 'javascript:alert(1)' })).toEqual({ href: 'https://example.com/', example: true });
  });
  it('keeps supplied URLs and encodes placeholder competition IDs', () => {
    expect(profileLinkDestination({ label: 'Portfolio', value: 'https://example.edu/work' }).example).toBe(false);
    expect(exampleRegistrationUrl('demo & one')).toBe('https://example.com/?competition=demo%20%26%20one');
  });
});
