import { useRef } from 'react';
import { addDays, daysSinceEpoch } from '../../lib/date';

export type DragMode = 'move' | 'resizeStart' | 'resizeEnd';

export function computeDragDelta(startX: number, currentX: number, dayWidth: number): number {
  return Math.round((currentX - startX) / dayWidth);
}

export function applyDrag(
  startDate: string,
  endDate: string,
  deltaDays: number,
  mode: DragMode,
): { startDate: string; endDate: string } {
  if (mode === 'move') {
    return { startDate: addDays(startDate, deltaDays), endDate: addDays(endDate, deltaDays) };
  }
  if (mode === 'resizeStart') {
    const proposed = addDays(startDate, deltaDays);
    return {
      startDate: daysSinceEpoch(proposed) > daysSinceEpoch(endDate) ? endDate : proposed,
      endDate,
    };
  }
  const proposed = addDays(endDate, deltaDays);
  return {
    startDate,
    endDate: daysSinceEpoch(proposed) < daysSinceEpoch(startDate) ? startDate : proposed,
  };
}

export function useBarDrag(opts: {
  dayWidth: number;
  onCommit: (startDate: string, endDate: string) => void;
}) {
  const state = useRef<{
    mode: DragMode;
    startX: number;
    initial: { startDate: string; endDate: string };
    el: HTMLDivElement;
    baseWidth: number;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, initial: { startDate: string; endDate: string }) {
    const target = e.target as HTMLElement;
    const handle = target.getAttribute('data-handle');
    const mode: DragMode = handle === 'start' ? 'resizeStart' : handle === 'end' ? 'resizeEnd' : 'move';
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    state.current = { mode, startX: e.clientX, initial, el, baseWidth: el.clientWidth };
    el.style.willChange = 'transform';
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!state.current) return;
    const { mode, startX, el, baseWidth } = state.current;
    const delta = computeDragDelta(startX, e.clientX, opts.dayWidth);
    const px = delta * opts.dayWidth;
    if (mode === 'move') {
      el.style.transform = `translateX(${px}px)`;
    } else if (mode === 'resizeStart') {
      el.style.transform = `translateX(${px}px)`;
      el.style.width = `${Math.max(8, baseWidth - px)}px`;
    } else {
      el.style.width = `${Math.max(8, baseWidth + px)}px`;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!state.current) return;
    const { mode, startX, initial, el } = state.current;
    el.style.transform = '';
    el.style.width = '';
    el.style.willChange = '';
    state.current = null;
    const delta = computeDragDelta(startX, e.clientX, opts.dayWidth);
    if (delta === 0) return;
    const next = applyDrag(initial.startDate, initial.endDate, delta, mode);
    opts.onCommit(next.startDate, next.endDate);
  }

  return { onPointerDown, onPointerMove, onPointerUp };
}
