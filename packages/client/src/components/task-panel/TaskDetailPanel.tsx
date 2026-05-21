import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Task, TaskFile, Dependency, User } from '@app/shared';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { TaskForm } from './TaskForm';
import { DependencyPicker } from './DependencyPicker';
import { FileUploader } from './FileUploader';

type Detail = Task & { files: TaskFile[]; dependencies: Dependency[] };

export function TaskDetailPanel({ taskId, projectMembers, allTasks }: {
  taskId: string;
  projectMembers: User[];
  allTasks: Task[];
}) {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get<Detail>(`/tasks/${taskId}`),
  });

  return (
    <aside className="absolute top-0 right-0 bottom-0 w-[46%] min-w-[420px] max-w-[640px] bg-paper border-l border-rule shadow-[-6px_0_16px_rgba(0,0,0,0.05)] flex flex-col z-30">
      <header className="h-12 border-b border-rule flex items-center px-4 gap-3">
        <div className="flex flex-col min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold truncate leading-tight">{data?.title ?? '…'}</h2>
          {data && (
            <span className="text-[10px] font-mono text-muted tracking-wider uppercase leading-none mt-0.5">
              {data.ticketNumber}
            </span>
          )}
        </div>
        <Button variant="ghost" onClick={() => nav({ to: '.', search: {}, replace: true })}>Close</Button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {isLoading || !data ? (
          <div className="text-muted text-[13px]">Loading…</div>
        ) : (
          <>
            <TaskForm
              task={data}
              projectMembers={projectMembers}
              onDeleted={() => nav({ to: '.', search: {}, replace: true })}
            />
            <DependencyPicker
              task={data}
              allTasks={allTasks}
              dependencies={data.dependencies}
            />
            <FileUploader taskId={data.id} files={data.files} />
          </>
        )}
      </div>
    </aside>
  );
}
