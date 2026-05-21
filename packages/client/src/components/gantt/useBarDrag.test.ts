import { describe, it, expect } from 'vitest';
import { computeDragDelta, applyDrag } from './useBarDrag';

describe('drag math', () => {
  it('snaps to whole days', () => {
    expect(computeDragDelta(0, 41, 40)).toBe(1);
    expect(computeDragDelta(0, 19, 40)).toBe(0);
    expect(computeDragDelta(0, 80, 40)).toBe(2);
    expect(computeDragDelta(0, -41, 40)).toBe(-1);
  });

  it('move shifts both dates equally', () => {
    expect(applyDrag('2026-05-20', '2026-05-22', 3, 'move'))
      .toEqual({ startDate: '2026-05-23', endDate: '2026-05-25' });
  });

  it('resizeStart changes start only and clamps to end', () => {
    expect(applyDrag('2026-05-20', '2026-05-25', 3, 'resizeStart'))
      .toEqual({ startDate: '2026-05-23', endDate: '2026-05-25' });
    expect(applyDrag('2026-05-20', '2026-05-22', 5, 'resizeStart'))
      .toEqual({ startDate: '2026-05-22', endDate: '2026-05-22' });
  });

  it('resizeEnd changes end only and clamps to start', () => {
    expect(applyDrag('2026-05-20', '2026-05-25', -3, 'resizeEnd'))
      .toEqual({ startDate: '2026-05-20', endDate: '2026-05-22' });
    expect(applyDrag('2026-05-20', '2026-05-22', -5, 'resizeEnd'))
      .toEqual({ startDate: '2026-05-20', endDate: '2026-05-20' });
  });
});
