import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { Task, TaskFile, Dependency, ProjectWithMembers } from '@app/shared';
import { api, ApiException } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AppTopBar } from '../components/AppTopBar';
import { TaskForm } from '../components/task-panel/TaskForm';
import { DependencyPicker } from '../components/task-panel/DependencyPicker';
import { FileUploader } from '../components/task-panel/FileUploader';

type Detail = Task & { files: TaskFile[]; dependencies: Dependency[] };

export function TicketPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const params = useParams({ strict: false }) as { ticketNumber: string };

  useEffect(() => { if (!loading && !user) nav({ to: '/login' }); }, [loading, user, nav]);

  const taskQ = useQuery<Detail, ApiException>({
    queryKey: ['ticket', params.ticketNumber],
    queryFn: () => api.get<Detail>(`/tickets/${params.ticketNumber}`),
    enabled: !!user && !!params.ticketNumber,
    retry: false,
  });

  const projectQ = useQuery({
    queryKey: ['project', taskQ.data?.projectId],
    queryFn: () => api.get<ProjectWithMembers>(`/projects/${taskQ.data!.projectId}`),
    enabled: !!taskQ.data,
  });

  const tasksQ = useQuery({
    queryKey: ['tasks', taskQ.data?.projectId],
    queryFn: () => api.get<{ tasks: Task[]; dependencies: Dependency[] }>(`/projects/${taskQ.data!.projectId}/tasks`),
    enabled: !!taskQ.data,
  });

  if (loading || !user) return <div className="p-8 text-muted">Loading…</div>;

  if (taskQ.isError) {
    const status = taskQ.error?.status;
    const msg = status === 404 ? `Ticket "${params.ticketNumber}" not found`
      : status === 403 ? 'You do not have access to this ticket'
      : `Couldn't load this ticket: ${taskQ.error?.message ?? 'unknown error'}`;
    return (
      <div className="h-full flex flex-col">
        <AppTopBar />
        <main className="flex-1 grid place-items-center">
          <div className="text-center max-w-md">
            <h2 className="text-[15px] font-semibold mb-2">{msg}</h2>
            <Link to="/" className="text-[12px] text-muted hover:text-ink underline">Back to projects</Link>
          </div>
        </main>
      </div>
    );
  }

  const task = taskQ.data;
  const project = projectQ.data;
  const allTasks = tasksQ.data?.tasks ?? [];

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3 text-[12px] text-muted">
        {project ? (
          <Link to="/projects/$id" params={{ id: project.id }} className="hover:text-ink">{project.name}</Link>
        ) : (
          <span>…</span>
        )}
        <span>›</span>
        <span className="font-mono uppercase tracking-wider">{params.ticketNumber}</span>
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto w-full px-6 py-6 flex flex-col gap-6">
          <header>
            <h1 className="text-[20px] font-semibold leading-tight">{task?.title ?? '…'}</h1>
            {task && (
              <p className="text-[11px] font-mono text-muted tracking-wider uppercase mt-1">
                {task.ticketNumber}
              </p>
            )}
          </header>

          {!task || !project ? (
            <div className="text-muted text-[13px]">Loading…</div>
          ) : (
            <>
              <TaskForm
                task={task}
                projectMembers={project.members}
                onDeleted={() => nav({ to: '/projects/$id', params: { id: project.id } })}
              />
              <DependencyPicker
                task={task}
                allTasks={allTasks}
                dependencies={task.dependencies}
              />
              <FileUploader taskId={task.id} files={task.files} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
