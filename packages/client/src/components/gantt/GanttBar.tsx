import type { Task, User } from '@app/shared';
import { daysBetween } from '../../lib/date';

const STATUS_BAR: Record<Task['status'], string> = {
  todo:        'bg-paper border border-ink text-ink',
  in_progress: 'bg-ink text-paper border border-ink',
  done:        'bg-mist text-muted border border-rule line-through',
};


export function GanttBar({
  task, rangeStart, dayWidth, top, height, pic, selected, onSelect,
}: {
  task: Task;
  rangeStart: string;
  dayWidth: number;
  top: number;
  height: number;
  pic?: User;
  selected: boolean;
  onSelect: () => void;
}) {
  const left = daysBetween(rangeStart, task.startDate) * dayWidth;
  const width = (daysBetween(task.startDate, task.endDate) + 1) * dayWidth;
  const inset = 2;
  const barHeight = height - inset * 2;
  const initials = pic ? pic.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '';

  return (
    <div
      data-task-id={task.id}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{ left, top: top + inset, width: Math.max(width, 8), height: barHeight }}
      className={`absolute rounded text-[11px] flex items-center px-2 gap-1.5 cursor-pointer select-none ${STATUS_BAR[task.status]} ${selected ? 'ring-2 ring-focus/60 ring-offset-1' : ''}`}
    >
      {task.status === 'done' && (
        <span className="absolute inset-0 pointer-events-none rounded hatch-overlay" />
      )}
      {initials && width > 60 && (
        <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-paper text-ink border border-rule text-[9px] font-semibold flex-shrink-0">
          {initials}
        </span>
      )}
      <span className="truncate">{task.title}</span>
    </div>
  );
}
