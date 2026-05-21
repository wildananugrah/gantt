import { describe, it, expect, vi } from 'vitest';
import { computeDragDelta, applyDrag, DRAG_THRESHOLD_PX, useBarDrag } from './useBarDrag';
import { renderHook, act } from '@testing-library/react';

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

function mockBar(): HTMLDivElement {
  const el = document.createElement('div');
  el.setPointerCapture = vi.fn();
  Object.defineProperty(el, 'clientWidth', { value: 200 });
  return el;
}

function ptr(el: HTMLDivElement, clientX: number): React.PointerEvent<HTMLDivElement> {
  return {
    button: 0,
    clientX,
    pointerId: 1,
    currentTarget: el,
    target: el,
  } as unknown as React.PointerEvent<HTMLDivElement>;
}

function nativePtr(clientX: number): PointerEvent {
  return { clientX, pointerId: 1 } as unknown as PointerEvent;
}

describe('useBarDrag click-vs-drag arbitration', () => {
  it('calls onSelect (not onCommit) when pointer moves less than threshold', () => {
    const onSelect = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useBarDrag({ dayWidth: 40, onCommit, onSelect }));
    const el = mockBar();

    act(() => result.current.onPointerDown(ptr(el, 100), { startDate: '2026-05-20', endDate: '2026-05-22' }));
    // wiggle 3px — under the threshold
    act(() => result.current.onPointerMove(nativePtr(103)));
    act(() => result.current.onPointerUp(nativePtr(102)));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('calls onCommit (not onSelect) when pointer moves at least threshold + a full day', () => {
    const onSelect = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useBarDrag({ dayWidth: 40, onCommit, onSelect }));
    const el = mockBar();

    act(() => result.current.onPointerDown(ptr(el, 100), { startDate: '2026-05-20', endDate: '2026-05-22' }));
    // 50 px ≥ DRAG_THRESHOLD_PX, rounds to 1 day at dayWidth=40
    act(() => result.current.onPointerMove(nativePtr(150)));
    act(() => result.current.onPointerUp(nativePtr(150)));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('2026-05-21', '2026-05-23');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not commit when drag activates but settles back to 0 days', () => {
    const onSelect = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useBarDrag({ dayWidth: 40, onCommit, onSelect }));
    const el = mockBar();

    act(() => result.current.onPointerDown(ptr(el, 100), { startDate: '2026-05-20', endDate: '2026-05-22' }));
    // cross threshold but return to ~origin before release
    act(() => result.current.onPointerMove(nativePtr(110)));
    act(() => result.current.onPointerUp(nativePtr(101)));

    expect(onCommit).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled(); // drag activated, so no select either
  });

  it(`DRAG_THRESHOLD_PX is ${DRAG_THRESHOLD_PX}`, () => {
    expect(DRAG_THRESHOLD_PX).toBeGreaterThanOrEqual(3);
    expect(DRAG_THRESHOLD_PX).toBeLessThanOrEqual(10);
  });
});
