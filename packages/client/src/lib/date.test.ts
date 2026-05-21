import { describe, it, expect } from 'vitest';
import { EPOCH, daysSinceEpoch, addDays, parseDate, formatDate, daysBetween, computeInitialRange } from './date';

describe('date math', () => {
  it('EPOCH is 2020-01-01', () => {
    expect(EPOCH).toBe('2020-01-01');
  });

  it('daysSinceEpoch is 0 at epoch', () => {
    expect(daysSinceEpoch('2020-01-01')).toBe(0);
  });

  it('daysSinceEpoch advances correctly', () => {
    expect(daysSinceEpoch('2020-01-02')).toBe(1);
    expect(daysSinceEpoch('2021-01-01')).toBe(366);
  });

  it('addDays adds days', () => {
    expect(addDays('2026-05-20', 5)).toBe('2026-05-25');
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
  });

  it('daysBetween counts inclusive-exclusive', () => {
    expect(daysBetween('2026-05-20', '2026-05-22')).toBe(2);
  });

  it('parseDate round-trips formatDate', () => {
    expect(formatDate(parseDate('2026-05-20'))).toBe('2026-05-20');
  });

  it('computeInitialRange falls back when no tasks', () => {
    const r = computeInitialRange([], '2026-05-20');
    expect(daysSinceEpoch(r.end) - daysSinceEpoch(r.start)).toBe(120);
  });

  it('computeInitialRange covers tasks with buffer', () => {
    const r = computeInitialRange(
      [{ startDate: '2026-04-01', endDate: '2026-06-30' }],
      '2026-05-20',
    );
    expect(r.start <= '2026-04-01').toBe(true);
    expect(r.end >= '2026-06-30').toBe(true);
  });
});
