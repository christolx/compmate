import { describe, expect, it } from 'vitest';
import { externalUrl } from './externalUrl';

describe('external web links', () => {
  it('preserves URLs and normalizes bare domains', () => {
    expect(externalUrl('example.edu/event')).toBe('https://example.edu/event');
    expect(externalUrl(' http://example.edu/event ')).toBe('http://example.edu/event');
    expect(externalUrl('//example.edu/event')).toBe('https://example.edu/event');
  });
  it('rejects executable, malformed and credential-bearing links', () => {
    for (const value of [undefined, '', 'javascript:alert(1)', 'data:text/html,test', 'https://', 'https://user:password@example.edu']) {
      expect(externalUrl(value)).toBeNull();
    }
  });
});
