import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Task, TaskFile, Dependency, User } from '@app/shared';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { TaskForm } from './TaskForm';
import { DependencyPicker } from './DependencyPicker';
import { FileUploader } from './FileUploader';
import { TaskExcalidraw } from './TaskExcalidraw';
import { TaskComments } from './TaskComments';

type Detail = Task & { files: TaskFile[]; dependencies: Dependency[] };

export function TaskDetailPanel({ taskId, projectMembers, allTasks }: {
  taskId: string;
  projectMembers: User[];
  allTasks: Task[];
}) {
  const nav = useNavigate();
  const [drawing, setDrawing] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get<Detail>(`/tasks/${taskId}`),
  });

  return (
    <aside className="absolute top-0 right-0 bottom-0 left-0 sm:left-auto w-full sm:w-[46%] sm:min-w-[420px] sm:max-w-[640px] bg-paper border-l border-rule shadow-[-6px_0_16px_rgba(0,0,0,0.05)] flex flex-col z-30">
      <header className="h-12 border-b border-rule flex items-center px-4 gap-3">
        <div className="flex flex-col min-w-0 flex-1">
          {data ? (
            <a
              href={`/tasks/${data.ticketNumber}`}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] font-semibold truncate leading-tight hover:underline decoration-rule decoration-1 underline-offset-2"
              title="Open ticket in new tab"
            >{data.title}</a>
          ) : (
            <h2 className="text-[14px] font-semibold truncate leading-tight">…</h2>
          )}
          {data && (
            <a
              href={`/tasks/${data.ticketNumber}`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono text-muted hover:text-ink tracking-wider uppercase leading-none mt-0.5 self-start"
              title="Open ticket in new tab"
            >{data.ticketNumber} ↗</a>
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
              onPredecessorClick={(p) => nav({ to: '.', search: { task: p.id }, replace: true })}
            />
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] uppercase tracking-wider text-muted">Whiteboard</h3>
              <Button type="button" variant="ghost" onClick={() => setDrawing(true)}>Open whiteboard</Button>
            </section>
            <FileUploader taskId={data.id} files={data.files} />
            <TaskComments taskId={data.id} />
          </>
        )}
      </div>
      {drawing && data && (
        <TaskExcalidraw
          taskId={data.id}
          taskTitle={data.title}
          onClose={() => setDrawing(false)}
        />
      )}
    </aside>
  );
}
