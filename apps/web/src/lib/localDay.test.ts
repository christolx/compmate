import { describe, expect, it } from 'vitest';
import { localDay } from './localDay';

describe('localDay', () => {
  it('uses the local calendar date, not the serialized offset', () => {
    const instant = new Date(2026, 11, 5, 23, 59, 59);
    expect(localDay(instant.toISOString())).toBe('2026-12-05');
    expect(localDay('2026-12-05T23:59:59+07:00')).toBe(localDay(new Date('2026-12-05T16:59:59Z')));
  });

  it('falls back to the raw date prefix for unparseable input', () => {
    expect(localDay('not-a-date')).toBe('not-a-date');
  });
});
