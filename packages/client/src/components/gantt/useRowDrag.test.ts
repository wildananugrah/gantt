import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { computeDropIndex, reorderArray, useRowDrag } from './useRowDrag';

const rowTops = [0, 36, 72, 108, 144]; // 5 rows of height 36

describe('computeDropIndex', () => {
  it('above first row → index 0', () => {
    expect(computeDropIndex(2, -10, rowTops, 36)).toBe(0);
  });
  it('inside row i (top half) → index i', () => {
    expect(computeDropIndex(0, 40, rowTops, 36)).toBe(1); // pointer in row 1 top half → insertion before row 1 = index 1
  });
  it('inside row i (bottom half) → index i+1', () => {
    expect(computeDropIndex(0, 60, rowTops, 36)).toBe(2);
  });
  it('below last row → rowTops.length', () => {
    expect(computeDropIndex(0, 500, rowTops, 36)).toBe(5);
  });
});

function mockRow(): HTMLDivElement {
  const el = document.createElement('div');
  el.setPointerCapture = vi.fn();
  return el;
}

function ptrDown(el: HTMLDivElement, y: number): React.PointerEvent<HTMLElement> {
  return { button: 0, clientY: y, pointerId: 1, currentTarget: el, target: el } as unknown as React.PointerEvent<HTMLElement>;
}
function ptrMove(y: number): PointerEvent {
  return { clientY: y, pointerId: 1 } as unknown as PointerEvent;
}

describe('useRowDrag end-to-end', () => {
  it('onPointerUp commits with the latest dropIndex from pointermove (not the stale render closure)', () => {
    const onCommit = vi.fn();
    const onSelect = vi.fn();
    const rowTops = [0, 36, 72, 108, 144];
    const { result } = renderHook(() =>
      useRowDrag({
        rowHeight: 36,
        rowCount: 5,
        getRowTops: () => rowTops,
        getContainerY: () => 0,
        onCommit,
        onSelect,
      }),
    );
    const el = mockRow();

    act(() => result.current.onPointerDown(ptrDown(el, 0), 0));
    // Move past threshold, then far below last row (y=300 → after row 4 → index 5)
    act(() => result.current.onPointerMove(ptrMove(20)));
    act(() => result.current.onPointerMove(ptrMove(300)));
    act(() => result.current.onPointerUp(ptrMove(300)));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0, 5);
  });

  it('onPointerUp without movement past threshold calls onSelect, not onCommit', () => {
    const onCommit = vi.fn();
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useRowDrag({
        rowHeight: 36,
        rowCount: 5,
        getRowTops: () => [0, 36, 72, 108, 144],
        getContainerY: () => 0,
        onCommit,
        onSelect,
      }),
    );
    const el = mockRow();
    act(() => result.current.onPointerDown(ptrDown(el, 50), 2));
    act(() => result.current.onPointerMove(ptrMove(52))); // 2px — below threshold
    act(() => result.current.onPointerUp(ptrMove(52)));
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('reorderArray', () => {
  it('returns original when dst equals src', () => {
    const a = ['a', 'b', 'c'];
    expect(reorderArray(a, 1, 1)).toBe(a);
  });
  it('returns original when dst equals src+1 (no-op same slot)', () => {
    const a = ['a', 'b', 'c'];
    expect(reorderArray(a, 1, 2)).toBe(a);
  });
  it('moves item down', () => {
    expect(reorderArray(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves item up', () => {
    expect(reorderArray(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('moves item to end', () => {
    expect(reorderArray(['a', 'b', 'c', 'd'], 0, 4)).toEqual(['b', 'c', 'd', 'a']);
  });
});
