import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

describe('original compact timestamps', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it.each([
    ['2026-10-15T12:00:00Z', 'Just now'],
    ['2026-10-15T11:59:00Z', '1 minute ago'],
    ['2026-10-15T11:30:00Z', '30 minutes ago'],
    ['2026-10-15T11:00:00Z', '1 hour ago'],
    ['2026-10-14T12:00:00Z', 'Yesterday'],
    ['2026-10-13T12:00:00Z', '2 days ago'],
  ])('formats %s as %s', (date, label) => {
    expect(relativeTime(date, now)).toBe(label);
  });
  it('handles invalid and future timestamps without displaying NaN or negative ages', () => {
    expect(relativeTime('bad', now)).toBe('');
    expect(relativeTime('2026-10-16T12:00:00Z', now)).toBe('Just now');
  });
});
