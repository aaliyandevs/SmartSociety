import { describe, expect, it } from 'vitest';

import {
  formatCurrency,
  formatNumber,
  humanise,
  initials,
  minutesToLabel,
  toDateInputValue,
  toNumber,
  truncate,
} from '@/lib/utils';

describe('formatting helpers', () => {
  it('formats rupee amounts from numbers, strings and Decimal-like values', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.5');
    expect(formatCurrency('890')).toContain('890');
    expect(formatCurrency({ toString: () => '4500.25' })).toContain('4,500.25');
  });

  it('treats null and undefined amounts as zero rather than throwing', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('not-a-number')).toBe(0);
  });

  it('groups numbers in the Indian numbering system', () => {
    expect(formatNumber(1234567)).toBe('12,34,567');
  });

  it('turns enum values into readable labels', () => {
    expect(humanise('MAINTENANCE_STAFF')).toBe('Maintenance Staff');
    expect(humanise('PENDING')).toBe('Pending');
    expect(humanise(null)).toBe('—');
  });

  it('derives at most two initials from a name', () => {
    expect(initials('Ananya Sharma')).toBe('AS');
    expect(initials('Rajesh Kumar Deshmukh')).toBe('RK');
    expect(initials('Prakash')).toBe('P');
  });

  it('converts minutes-from-midnight into a 12-hour label', () => {
    expect(minutesToLabel(0)).toBe('12:00 AM');
    expect(minutesToLabel(360)).toBe('06:00 AM');
    expect(minutesToLabel(720)).toBe('12:00 PM');
    expect(minutesToLabel(1320)).toBe('10:00 PM');
  });

  it('formats a date input value in local time, not UTC', () => {
    // A late-evening date must not roll back a day, which toISOString would do
    // for timezones ahead of UTC.
    const date = new Date(2026, 2, 18, 23, 30);
    expect(toDateInputValue(date)).toBe('2026-03-18');
  });

  it('truncates long text with an ellipsis and leaves short text alone', () => {
    expect(truncate('short', 20)).toBe('short');
    expect(truncate('a'.repeat(30), 10)).toHaveLength(10);
    expect(truncate('a'.repeat(30), 10).endsWith('…')).toBe(true);
  });
});
