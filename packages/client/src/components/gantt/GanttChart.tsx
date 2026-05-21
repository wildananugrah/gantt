import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, Dependency, User } from '@app/shared';
import {
  addDays, computeInitialRange, daysBetween, dayWidthFor, expandRangeIfNearEdge, today, type DateRange, type Zoom,
} from '../../lib/date';
import { api } from '../../lib/api';
import { ROW_HEIGHT, LEFT_COLUMN_WIDTH } from './types';
import { DateHeader } from './DateHeader';
import { GridLayer } from './GridLayer';
import { TodayLine } from './TodayLine';
import { GanttBar } from './GanttBar';
import { ArrowsLayer } from './ArrowsLayer';
import { useBarDrag } from './useBarDrag';

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

  const updateTask = useMutation({
    mutationFn: (v: { id: string; startDate: string; endDate: string }) =>
      api.patch(`/tasks/${v.id}`, { startDate: v.startDate, endDate: v.endDate }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const prev = qc.getQueryData<{ tasks: Task[]; dependencies: Dependency[] }>(['tasks', projectId]);
      if (prev) {
        qc.setQueryData(['tasks', projectId], {
          ...prev,
          tasks: prev.tasks.map((t) => t.id === v.id ? { ...t, startDate: v.startDate, endDate: v.endDate } : t),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['tasks', projectId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  return (
    <div className="h-full flex border-t border-rule">
      <div
        className="flex-shrink-0 border-r border-rule bg-paper overflow-y-auto"
        style={{ width: LEFT_COLUMN_WIDTH }}
      >
        <div className="h-12 border-b border-rule px-3 flex items-center text-[11px] text-muted uppercase tracking-wider">
          Task / PIC
        </div>
        {sortedTasks.map((t) => {
          const pic = members.find((m) => m.id === t.picUserId);
          return (
            <div
              key={t.id}
              className={`px-3 border-b border-rule flex items-center gap-2 cursor-pointer hover:bg-mist ${
                selectedId === t.id ? 'bg-mist' : ''
              }`}
              style={{ height: ROW_HEIGHT }}
              onClick={() => nav({ to: '.', search: { task: t.id }, replace: true })}
            >
              <span className="text-[13px] truncate flex-1">{t.title}</span>
              {pic && (
                <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-paper text-ink border border-rule text-[9px] font-semibold">
                  {pic.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              )}
            </div>
          );
        })}
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
                <BarWithDrag
                  key={t.id}
                  task={t}
                  pic={pic}
                  rangeStart={range.start}
                  dayWidth={dayWidth}
                  top={i * ROW_HEIGHT}
                  height={ROW_HEIGHT}
                  selected={selectedId === t.id}
                  onSelect={() => nav({ to: '.', search: { task: t.id }, replace: true })}
                  onCommit={(start, end) => updateTask.mutate({ id: t.id, startDate: start, endDate: end })}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

function BarWithDrag(props: {
  task: Task; pic?: User; rangeStart: string; dayWidth: number; top: number; height: number;
  selected: boolean; onSelect: () => void; onCommit: (s: string, e: string) => void;
}) {
  const drag = useBarDrag({ dayWidth: props.dayWidth, onCommit: props.onCommit });
  return (
    <GanttBar
      task={props.task}
      pic={props.pic}
      rangeStart={props.rangeStart}
      dayWidth={props.dayWidth}
      top={props.top}
      height={props.height}
      selected={props.selected}
      onSelect={props.onSelect}
      onPointerDown={(e) => {
        const initial = { startDate: props.task.startDate, endDate: props.task.endDate };
        drag.onPointerDown(e, initial);
        const el = e.currentTarget;
        const move = drag.onPointerMove as any;
        const up = (ev: any) => {
          drag.onPointerUp(ev);
          el.removeEventListener('pointermove', move);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up, { once: true });
      }}
    />
  );
}
