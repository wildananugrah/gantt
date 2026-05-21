import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, Dependency, User } from '@app/shared';
import {
  addDays, computeInitialRange, daysBetween, dayWidthFor, expandRangeIfNearEdge, today, type DateRange, type Zoom,
} from '../../lib/date';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { ROW_HEIGHT, LEFT_COLUMN_WIDTH } from './types';
import { DateHeader } from './DateHeader';
import { GridLayer } from './GridLayer';
import { TodayLine } from './TodayLine';
import { GanttBar } from './GanttBar';
import { ArrowsLayer } from './ArrowsLayer';
import { useRowDrag, reorderArray } from './useRowDrag';

export type GanttControl = { scrollToToday: () => void };

type Props = {
  tasks: Task[];
  dependencies: Dependency[];
  members: User[];
  zoom: Zoom;
  projectId: string;
};

export const GanttChart = forwardRef<GanttControl, Props>(function GanttChart(
  { tasks, dependencies, members, zoom, projectId },
  ref,
) {
  const nav = useNavigate();
  const search = useSearch({ strict: false }) as { task?: string };
  const selectedId = search.task;

  const qc = useQueryClient();
  const toast = useToast();
  const [range, setRange] = useState<DateRange>(() => computeInitialRange(tasks));
  const dayWidth = dayWidthFor(zoom);
  const totalDays = daysBetween(range.start, range.end);
  const contentWidth = totalDays * dayWidth;
  const scrollerRef = useRef<HTMLDivElement>(null);

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate)),
    [tasks],
  );
  const bodyHeight = sortedTasks.length * ROW_HEIGHT;

  useImperativeHandle(ref, () => ({
    scrollToToday: () => {
      const el = scrollerRef.current;
      if (!el) return;
      const todayLeft = daysBetween(range.start, today()) * dayWidth;
      el.scrollLeft = Math.max(0, todayLeft - el.clientWidth / 2);
    },
  }), [range, dayWidth]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const visibleStart = addDays(range.start, Math.floor(el.scrollLeft / dayWidth));
      const visibleEnd = addDays(range.start, Math.ceil((el.scrollLeft + el.clientWidth) / dayWidth));
      const next = expandRangeIfNearEdge(range, visibleStart, visibleEnd);
      if (next.start !== range.start || next.end !== range.end) {
        const leftExtendDays = daysBetween(next.start, range.start);
        setRange(next);
        if (leftExtendDays > 0) {
          requestAnimationFrame(() => { el.scrollLeft += leftExtendDays * dayWidth; });
        }
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [range, dayWidth]);

  const reorder = useMutation({
    mutationFn: (taskIds: string[]) =>
      api.post(`/projects/${projectId}/tasks/reorder`, { taskIds }),
    onMutate: async (taskIds) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const prev = qc.getQueryData<{ tasks: Task[]; dependencies: Dependency[] }>(['tasks', projectId]);
      if (prev) {
        const byId = new Map(prev.tasks.map((t) => [t.id, t]));
        qc.setQueryData(['tasks', projectId], {
          ...prev,
          tasks: taskIds.map((id, i) => ({ ...(byId.get(id)!), sortOrder: i })),
        });
      }
      return { prev };
    },
    onSuccess: () => toast.success('Tasks reordered'),
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['tasks', projectId], ctx.prev);
      toast.error(`Couldn't reorder: ${e.message ?? 'unknown error'}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const leftColumnRef = useRef<HTMLDivElement>(null);
  const headerOffset = 48; // h-12 header inside the left column
  const rowDrag = useRowDrag({
    rowHeight: ROW_HEIGHT,
    rowCount: sortedTasks.length,
    getRowTops: () => sortedTasks.map((_, i) => headerOffset + i * ROW_HEIGHT),
    getContainerY: () => {
      const r = leftColumnRef.current?.getBoundingClientRect();
      return (r?.top ?? 0) - (leftColumnRef.current?.scrollTop ?? 0);
    },
    onCommit: (src, dst) => {
      const reordered = reorderArray(sortedTasks, src, dst);
      reorder.mutate(reordered.map((t) => t.id));
    },
    onSelect: (i) => nav({ to: '.', search: { task: sortedTasks[i]!.id }, replace: true }),
  });

  return (
    <div className="h-full flex border-t border-rule">
      <div
        ref={leftColumnRef}
        className="flex-shrink-0 border-r border-rule bg-paper overflow-y-auto relative"
        style={{ width: LEFT_COLUMN_WIDTH }}
      >
        <div className="h-12 border-b border-rule px-3 flex items-center text-[11px] text-muted uppercase tracking-wider">
          Task / PIC
        </div>
        {sortedTasks.map((t, i) => {
          const pic = members.find((m) => m.id === t.picUserId);
          const isDragging = rowDrag.preview?.sourceIndex === i;
          return (
            <div
              key={t.id}
              onPointerDown={(e) => {
                rowDrag.onPointerDown(e, i);
                const el = e.currentTarget;
                const move = rowDrag.onPointerMove;
                const up = (ev: PointerEvent) => {
                  rowDrag.onPointerUp(ev);
                  el.removeEventListener('pointermove', move);
                };
                el.addEventListener('pointermove', move);
                el.addEventListener('pointerup', up, { once: true });
              }}
              className={`px-3 border-b border-rule flex items-center gap-2 cursor-grab active:cursor-grabbing select-none hover:bg-mist ${
                selectedId === t.id ? 'bg-mist' : ''
              } ${isDragging ? 'opacity-40' : ''}`}
              style={{ height: ROW_HEIGHT }}
            >
              <span className="text-muted text-[11px] flex-shrink-0">⋮⋮</span>
              <span className="text-[13px] truncate flex-1">{t.title}</span>
              {pic && (
                <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-paper text-ink border border-rule text-[9px] font-semibold">
                  {pic.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              )}
            </div>
          );
        })}
        {rowDrag.preview && rowDrag.preview.dropIndex !== rowDrag.preview.sourceIndex && rowDrag.preview.dropIndex !== rowDrag.preview.sourceIndex + 1 && (
          <div
            className="absolute left-2 right-2 h-0.5 bg-focus pointer-events-none"
            style={{ top: headerOffset + rowDrag.preview.dropIndex * ROW_HEIGHT - 1 }}
          />
        )}
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-auto relative">
        <div style={{ width: contentWidth }} className="relative">
          <div className="sticky top-0 z-10 bg-paper border-b border-rule">
            <DateHeader range={range} dayWidth={dayWidth} zoom={zoom} />
          </div>
          <div className="relative" style={{ height: bodyHeight }}>
            <GridLayer range={range} dayWidth={dayWidth} zoom={zoom} height={bodyHeight} />
            <TodayLine range={range} dayWidth={dayWidth} height={bodyHeight} />
            <ArrowsLayer
              tasks={sortedTasks}
              dependencies={dependencies}
              rangeStart={range.start}
              dayWidth={dayWidth}
              rowHeight={ROW_HEIGHT}
              width={contentWidth}
              height={bodyHeight}
            />
            {sortedTasks.map((t, i) => {
              const pic = members.find((m) => m.id === t.picUserId);
              return (
                <GanttBar
                  key={t.id}
                  task={t}
                  pic={pic}
                  rangeStart={range.start}
                  dayWidth={dayWidth}
                  top={i * ROW_HEIGHT}
                  height={ROW_HEIGHT}
                  selected={selectedId === t.id}
                  onSelect={() => nav({ to: '.', search: { task: t.id }, replace: true })}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
