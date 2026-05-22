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
            <th className="px-4 py-2.5 font-medium border-b border-rule w-[110px]">Ticket</th>
            <th className="px-4 py-2.5 font-medium border-b border-rule">Task</th>
            <th className="px-4 py-2.5 font-medium border-b border-rule w-[160px]">PIC</th>
            <th className="px-4 py-2.5 font-medium border-b border-rule w-[110px]">Start</th>
            <th className="px-4 py-2.5 font-medium border-b border-rule w-[110px]">End</th>
            <th className="px-4 py-2.5 font-medium border-b border-rule w-[72px] text-right">Days</th>
            <th className="px-4 py-2.5 font-medium border-b border-rule w-[120px]">Status</th>
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
                <td className="px-4 py-2 align-middle">
                  <a
                    href={`/tasks/${t.ticketNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-[11px] text-muted hover:text-ink tracking-wider uppercase"
                    title="Open ticket in new tab"
                  >{t.ticketNumber} ↗</a>
                </td>
                <td className="px-4 py-2 align-middle">
                  <div className={`truncate ${t.status === 'done' ? 'text-muted line-through' : ''}`}>
                    {t.title}
                  </div>
                </td>
                <td className="px-4 py-2 align-middle text-muted">{pic?.name ?? '—'}</td>
                <td className="px-4 py-2 align-middle font-mono text-[12px]">{t.startDate}</td>
                <td className="px-4 py-2 align-middle font-mono text-[12px]">{t.endDate}</td>
                <td className="px-4 py-2 align-middle text-right font-mono text-[12px]">{days}</td>
                <td className="px-4 py-2 align-middle">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${STATUS_CHIP[t.status]}`}>
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
