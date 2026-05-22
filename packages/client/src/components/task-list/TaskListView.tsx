import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { Task, User } from '@app/shared';
import { daysBetween } from '../../lib/date';

const STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

const STATUS_CHIP: Record<Task['status'], string> = {
  todo:        'border border-ink text-ink',
  in_progress: 'bg-ink text-paper border border-ink',
  done:        'bg-mist text-muted border border-rule line-through',
};

export function TaskListView({
  tasks, members,
}: {
  tasks: Task[];
  members: User[];
}) {
  const nav = useNavigate();
  const search = useSearch({ strict: false }) as { task?: string };
  const selectedId = search.task;

  const sorted = useMemo(
    () => [...tasks].sort((a, b) =>
      a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate),
    ),
    [tasks],
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  return (
    <div className="h-full overflow-auto border-t border-rule">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-paper z-10">
          <tr className="text-left text-muted text-[11px] uppercase tracking-wider">
            <th className="px-3 sm:px-4 py-2.5 font-medium border-b border-rule w-[100px] sm:w-[110px]">Ticket</th>
            <th className="px-3 sm:px-4 py-2.5 font-medium border-b border-rule">Task</th>
            <th className="hidden md:table-cell px-4 py-2.5 font-medium border-b border-rule w-[160px]">PIC</th>
            <th className="hidden lg:table-cell px-4 py-2.5 font-medium border-b border-rule w-[110px]">Start</th>
            <th className="hidden lg:table-cell px-4 py-2.5 font-medium border-b border-rule w-[110px]">End</th>
            <th className="hidden lg:table-cell px-4 py-2.5 font-medium border-b border-rule w-[72px] text-right">Days</th>
            <th className="px-3 sm:px-4 py-2.5 font-medium border-b border-rule w-[88px] sm:w-[120px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const pic = t.picUserId ? memberById.get(t.picUserId) : undefined;
            const days = daysBetween(t.startDate, t.endDate) + 1;
            const selected = selectedId === t.id;
            return (
              <tr
                key={t.id}
                onClick={() => nav({ to: '.', search: { task: t.id }, replace: true })}
                className={`cursor-pointer border-b border-rule hover:bg-mist ${selected ? 'bg-mist' : ''}`}
              >
                <td className="px-3 sm:px-4 py-2 align-middle">
                  <a
                    href={`/tasks/${t.ticketNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-[11px] text-muted hover:text-ink tracking-wider uppercase"
                    title="Open ticket in new tab"
                  >{t.ticketNumber} <span className="hidden sm:inline">↗</span></a>
                </td>
                <td className="px-3 sm:px-4 py-2 align-middle">
                  <div className={`truncate ${t.status === 'done' ? 'text-muted line-through' : ''}`}>
                    {t.title}
                  </div>
                  {/* Mobile-only metadata under the title */}
                  <div className="md:hidden mt-0.5 text-[11px] text-muted truncate">
                    {pic?.name ? <span>{pic.name}</span> : null}
                    {pic?.name ? <span className="mx-1">·</span> : null}
                    <span className="font-mono">{t.startDate} → {t.endDate}</span>
                    <span className="mx-1">·</span>
                    <span>{days}d</span>
                  </div>
                </td>
                <td className="hidden md:table-cell px-4 py-2 align-middle text-muted">{pic?.name ?? '—'}</td>
                <td className="hidden lg:table-cell px-4 py-2 align-middle font-mono text-[12px]">{t.startDate}</td>
                <td className="hidden lg:table-cell px-4 py-2 align-middle font-mono text-[12px]">{t.endDate}</td>
                <td className="hidden lg:table-cell px-4 py-2 align-middle text-right font-mono text-[12px]">{days}</td>
                <td className="px-3 sm:px-4 py-2 align-middle">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] sm:text-[11px] whitespace-nowrap ${STATUS_CHIP[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
