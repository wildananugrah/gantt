import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ProjectWithMembers, Task, Dependency } from '@app/shared';
import { AppTopBar } from '../components/AppTopBar';
import { GanttChart, type GanttControl } from '../components/gantt/GanttChart';
import { TaskDetailPanel } from '../components/task-panel/TaskDetailPanel';
import { NewTaskDialog } from '../components/task-panel/NewTaskDialog';
import type { Zoom } from '../lib/date';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { TaskSearch } from '../components/project/TaskSearch';
import { EditProjectDialog } from '../components/project/EditProjectDialog';
import { TaskListView } from '../components/task-list/TaskListView';
import { useIsMobile } from '../lib/responsive';

type ViewMode = 'gantt' | 'list';
const VIEW_STORAGE_KEY = 'projectViewMode';

function readInitialView(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === 'list' ? 'list' : 'gantt';
  } catch { return 'gantt'; }
}

export function ProjectPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const params = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { task?: string };
  const [zoom, setZoom] = useState<Zoom>('week');
  const [view, setViewState] = useState<ViewMode>(readInitialView);
  const setView = (v: ViewMode) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* ignore */ }
  };
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const ganttRef = useRef<GanttControl>(null);
  const isMobile = useIsMobile();
  // On mobile the Gantt chart isn't usable; force list view regardless of the user's saved preference.
  const effectiveView: ViewMode = isMobile ? 'list' : view;

  useEffect(() => { if (!loading && !user) nav({ to: '/login' }); }, [loading, user, nav]);

  const projectQ = useQuery({
    queryKey: ['project', params.id],
    queryFn: () => api.get<ProjectWithMembers>(`/projects/${params.id}`),
    enabled: !!user && !!params.id,
  });
  const tasksQ = useQuery({
    queryKey: ['tasks', params.id],
    queryFn: () => api.get<{ tasks: Task[]; dependencies: Dependency[] }>(`/projects/${params.id}/tasks`),
    enabled: !!user && !!params.id,
  });

  if (loading || !user) return <div className="p-8 text-muted">Loading…</div>;

  const hasTasks = tasksQ.data && tasksQ.data.tasks.length > 0;

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      {(tasksQ.error || projectQ.error) && (
        <ErrorBanner
          message={`Couldn't load this project: ${(tasksQ.error || projectQ.error)!.message}`}
          onRetry={() => { tasksQ.refetch(); projectQ.refetch(); }}
        />
      )}
      <div className="min-h-10 border-b border-rule bg-paper flex flex-wrap items-center px-3 sm:px-4 py-1.5 gap-x-3 gap-y-1.5">
        <h1 className="text-[14px] font-semibold truncate max-w-[60vw] sm:max-w-none">{projectQ.data?.name ?? '…'}</h1>
        <span className="hidden sm:inline text-[11px] text-muted">
          {projectQ.data ? `${projectQ.data.members.length} member${projectQ.data.members.length === 1 ? '' : 's'}` : ''}
        </span>
        {user.role === 'admin' && projectQ.data && (
          <button
            onClick={() => setEditOpen(true)}
            className="hidden sm:inline text-[12px] text-muted hover:text-ink"
            title="Edit project name & description"
          >Edit</button>
        )}
        {tasksQ.data && tasksQ.data.tasks.length > 0 && (
          <div className="hidden sm:block">
            <TaskSearch tasks={tasksQ.data.tasks} projectId={params.id} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/projects/$id/members"
            params={{ id: params.id }}
            className="hidden sm:inline text-[12px] text-muted hover:text-ink"
          >Members</Link>
          <Button onClick={() => setNewOpen(true)}>+ Task</Button>
          <button
            onClick={async () => {
              if (!tasksQ.data || !projectQ.data) return;
              try {
                const { exportGanttToExcel } = await import('../lib/excel-export');
                await exportGanttToExcel({
                  projectName: projectQ.data.name,
                  tasks: tasksQ.data.tasks,
                  members: projectQ.data.members,
                  zoom,
                });
              } catch (e: any) {
                alert(`Export failed: ${e.message ?? e}`);
              }
            }}
            disabled={!tasksQ.data || tasksQ.data.tasks.length === 0}
            className="hidden sm:inline-block h-7 px-2.5 text-[11px] border border-rule rounded bg-paper hover:bg-mist disabled:opacity-50 disabled:cursor-not-allowed"
          >Export</button>
          {!isMobile && (
            <div className="inline-flex border border-rule rounded overflow-hidden">
              {(['gantt', 'list'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`h-7 px-2.5 text-[11px] capitalize ${view === v ? 'bg-ink text-paper' : 'bg-paper hover:bg-mist'}`}
                  title={v === 'gantt' ? 'Gantt chart view' : 'Task list view'}
                >{v}</button>
              ))}
            </div>
          )}
          {effectiveView === 'gantt' && (
            <>
              <button
                onClick={() => ganttRef.current?.scrollToToday()}
                className="h-7 px-2.5 text-[11px] border border-rule rounded bg-paper hover:bg-mist"
              >Today</button>
              <div className="inline-flex border border-rule rounded overflow-hidden">
                {(['day','week','month'] as Zoom[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`h-7 px-2.5 text-[11px] capitalize ${zoom === z ? 'bg-ink text-paper' : 'bg-paper hover:bg-mist'}`}
                  >{z}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <main className="flex-1 overflow-hidden relative">
        {!tasksQ.data || !projectQ.data ? (
          <div className="p-8 text-muted">Loading…</div>
        ) : !hasTasks ? (
          <div className="h-full grid place-items-center">
            <div className="text-center max-w-sm">
              <h3 className="text-[15px] font-semibold mb-1">No tasks yet</h3>
              <p className="text-muted text-[13px] mb-4">Create the first task to start planning.</p>
              <Button onClick={() => setNewOpen(true)}>+ Create first task</Button>
            </div>
          </div>
        ) : (
          <>
            {effectiveView === 'gantt' ? (
              <GanttChart
                ref={ganttRef}
                tasks={tasksQ.data.tasks}
                dependencies={tasksQ.data.dependencies}
                members={projectQ.data.members}
                zoom={zoom}
                projectId={params.id}
              />
            ) : (
              <TaskListView
                tasks={tasksQ.data.tasks}
                members={projectQ.data.members}
              />
            )}
            {search.task && (
              <TaskDetailPanel
                key={search.task}
                taskId={search.task}
                projectMembers={projectQ.data.members}
                allTasks={tasksQ.data.tasks}
              />
            )}
          </>
        )}
      </main>
      {projectQ.data && (
        <NewTaskDialog
          open={newOpen}
          onClose={() => setNewOpen(false)}
          projectId={params.id}
          members={projectQ.data.members}
        />
      )}
      {projectQ.data && user.role === 'admin' && (
        <EditProjectDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          project={projectQ.data}
        />
      )}
    </div>
  );
}
