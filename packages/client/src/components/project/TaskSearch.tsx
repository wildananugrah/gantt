import type { Task } from '@app/shared';
import { useNavigate } from '@tanstack/react-router';
import { Combobox, type ComboboxItem } from '../ui/Combobox';

const STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'Todo', in_progress: 'In Progress', done: 'Done',
};

export function TaskSearch({ tasks, projectId }: { tasks: Task[]; projectId: string }) {
  const nav = useNavigate();
  const items: ComboboxItem<Task>[] = tasks.map((t) => ({
    key: t.id,
    value: t,
    searchable: [t.title, t.ticketNumber, t.description ?? ''],
    render: (_active) => (
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-ink">{t.title}</span>
        <span className="text-[9px] font-mono text-muted tracking-wider uppercase flex-shrink-0">
          {t.ticketNumber}
        </span>
        <span className="text-[10px] text-muted flex-shrink-0">{STATUS_LABEL[t.status]}</span>
      </div>
    ),
  }));

  return (
    <Combobox<Task>
      items={items}
      placeholder="Search tasks by name or ticket…"
      buttonLabel={<span className="text-muted">Search tasks…</span>}
      emptyMessage="No tasks match"
      width="min-w-[360px]"
      onPick={(it) => nav({ to: '/projects/$id', params: { id: projectId }, search: { task: it.value.id }, replace: true })}
    />
  );
}
