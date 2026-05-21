import { useRef, useState } from 'react';

export const ROW_DRAG_THRESHOLD_PX = 5;

export type RowDragState = {
  sourceIndex: number;
  dropIndex: number;
};

export function computeDropIndex(
  _sourceIndex: number,
  pointerY: number,
  rowTops: number[],
  rowHeight: number,
): number {
  if (rowTops.length === 0) return 0;
  const last = rowTops.length - 1;
  if (pointerY < rowTops[0]!) return 0;
  if (pointerY > rowTops[last]! + rowHeight) return rowTops.length;
  for (let i = 0; i < rowTops.length; i++) {
    const mid = rowTops[i]! + rowHeight / 2;
    if (pointerY < mid) return i;
  }
  return rowTops.length;
}

export function reorderArray<T>(arr: T[], sourceIndex: number, dropIndex: number): T[] {
  if (sourceIndex === dropIndex || sourceIndex + 1 === dropIndex) return arr;
  const next = arr.slice();
  const [moved] = next.splice(sourceIndex, 1);
  const adjusted = dropIndex > sourceIndex ? dropIndex - 1 : dropIndex;
  next.splice(adjusted, 0, moved!);
  return next;
}

export function useRowDrag(opts: {
  rowHeight: number;
  rowCount: number;
  getRowTops: () => number[];
  getContainerY: () => number;
  onCommit: (sourceIndex: number, dropIndex: number) => void;
  onSelect: (index: number) => void;
}) {
  // Ref holds the live drag state; React state is only for re-rendering the indicator.
  const state = useRef<{
    sourceIndex: number;
    startY: number;
    activated: boolean;
    el: HTMLElement;
    dropIndex: number;
  } | null>(null);
  const [preview, setPreview] = useState<RowDragState | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLElement>, sourceIndex: number) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    state.current = {
      sourceIndex,
      startY: e.clientY,
      activated: false,
      el,
      dropIndex: sourceIndex,
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (!state.current) return;
    const moved = e.clientY - state.current.startY;
    if (!state.current.activated) {
      if (Math.abs(moved) < ROW_DRAG_THRESHOLD_PX) return;
      state.current.activated = true;
    }
    const pointerY = e.clientY - opts.getContainerY();
    const dropIndex = computeDropIndex(state.current.sourceIndex, pointerY, opts.getRowTops(), opts.rowHeight);
    state.current.dropIndex = dropIndex;
    setPreview({ sourceIndex: state.current.sourceIndex, dropIndex });
  }

  function onPointerUp(_e: PointerEvent) {
    if (!state.current) return;
    const { sourceIndex, activated, dropIndex } = state.current;
    state.current = null;
    setPreview(null);
    if (!activated) {
      opts.onSelect(sourceIndex);
      return;
    }
    if (dropIndex !== sourceIndex && dropIndex !== sourceIndex + 1) {
      opts.onCommit(sourceIndex, dropIndex);
    }
  }

  return { preview, onPointerDown, onPointerMove, onPointerUp };
}
