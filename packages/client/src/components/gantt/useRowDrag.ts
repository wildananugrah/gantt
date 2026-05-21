import { useRef, useState } from 'react';

export const ROW_DRAG_THRESHOLD_PX = 5;

export type RowDragState = {
  /** Index being dragged (source). */
  sourceIndex: number;
  /** Drop position: insertion index (0..rowCount). */
  dropIndex: number;
};

export function computeDropIndex(
  sourceIndex: number,
  pointerY: number,
  rowTops: number[],
  rowHeight: number,
): number {
  // rowTops[i] is the y of row i's top, in the same coordinate system as pointerY.
  // Insertion index = where the row would land. Above row i = index i; below row i = index i+1.
  // Skip the source row's own slot (no-op).
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

/** Returns the new ordered array after moving `sourceIndex` to `dropIndex` (insertion semantics). */
export function reorderArray<T>(arr: T[], sourceIndex: number, dropIndex: number): T[] {
  if (sourceIndex === dropIndex || sourceIndex + 1 === dropIndex) return arr;
  const next = arr.slice();
  const [moved] = next.splice(sourceIndex, 1);
  // dropIndex was computed before removal; if we removed from before the target, shift left.
  const adjusted = dropIndex > sourceIndex ? dropIndex - 1 : dropIndex;
  next.splice(adjusted, 0, moved!);
  return next;
}

export function useRowDrag(opts: {
  rowHeight: number;
  rowCount: number;
  /** Resolved row Y coordinates (top of each row), relative to the container the pointer reports in. */
  getRowTops: () => number[];
  /** Container Y to convert from clientY. */
  getContainerY: () => number;
  onCommit: (sourceIndex: number, dropIndex: number) => void;
  onSelect: (index: number) => void;
}) {
  const state = useRef<{
    sourceIndex: number;
    startY: number;
    activated: boolean;
    el: HTMLElement;
  } | null>(null);
  const [preview, setPreview] = useState<RowDragState | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLElement>, sourceIndex: number) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    state.current = { sourceIndex, startY: e.clientY, activated: false, el };
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
    setPreview({ sourceIndex: state.current.sourceIndex, dropIndex });
  }

  function onPointerUp(_e: PointerEvent) {
    if (!state.current) return;
    const { sourceIndex, activated } = state.current;
    state.current = null;
    if (!activated) {
      setPreview(null);
      opts.onSelect(sourceIndex);
      return;
    }
    const final = preview;
    setPreview(null);
    if (!final) return;
    if (final.dropIndex !== final.sourceIndex && final.dropIndex !== final.sourceIndex + 1) {
      opts.onCommit(final.sourceIndex, final.dropIndex);
    }
  }

  return { preview, onPointerDown, onPointerMove, onPointerUp };
}
