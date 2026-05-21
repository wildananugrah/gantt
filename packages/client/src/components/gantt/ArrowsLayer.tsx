import type { Task, Dependency } from '@app/shared';
import { daysBetween } from '../../lib/date';

export function ArrowsLayer({
  tasks, dependencies, rangeStart, dayWidth, rowHeight, width, height,
}: {
  tasks: Task[];
  dependencies: Dependency[];
  rangeStart: string;
  dayWidth: number;
  rowHeight: number;
  width: number;
  height: number;
}) {
  const index = new Map(tasks.map((t, i) => [t.id, { task: t, row: i }]));

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width} height={height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#111" />
        </marker>
        <marker id="arrow-warn" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#b45309" />
        </marker>
      </defs>
      {dependencies.map((d) => {
        const p = index.get(d.predecessorId);
        const s = index.get(d.successorId);
        if (!p || !s) return null;
        const conflict = p.task.endDate > s.task.startDate;
        const x1 = (daysBetween(rangeStart, p.task.endDate) + 1) * dayWidth;
        const y1 = p.row * rowHeight + rowHeight / 2;
        const x2 = daysBetween(rangeStart, s.task.startDate) * dayWidth;
        const y2 = s.row * rowHeight + rowHeight / 2;
        const dropX = Math.max(x1 + 8, x2 - 8);
        const path = `M ${x1},${y1} H ${dropX} V ${y2} H ${x2}`;
        const stroke = conflict ? '#b45309' : '#111';
        return (
          <g key={`${d.predecessorId}-${d.successorId}`}>
            <path d={path} fill="none" stroke={stroke} strokeWidth={1} markerEnd={`url(#${conflict ? 'arrow-warn' : 'arrow'})`} />
            {conflict && (
              <text x={x2 - 14} y={y2 - 6} fontSize={10} fill="#b45309">!</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
