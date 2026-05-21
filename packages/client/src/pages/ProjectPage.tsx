import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ProjectWithMembers, Task, Dependency } from '@app/shared';
import { AppTopBar } from '../components/AppTopBar';
import { GanttChart, type GanttControl } from '../components/gantt/GanttChart';
import type { Zoom } from '../lib/date';
import { Button } from '../components/ui/Button';

export function ProjectPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const params = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { task?: string };
  const [zoom, setZoom] = useState<Zoom>('week');
  const ganttRef = useRef<GanttControl>(null);

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

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3">
        <h1 className="text-[14px] font-semibold">{projectQ.data?.name ?? '…'}</h1>
        <span className="text-[11px] text-muted">
          {projectQ.data ? `${projectQ.data.members.length} member${projectQ.data.members.length === 1 ? '' : 's'}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/projects/$id/members" params={{ id: params.id }} className="text-[12px] text-muted hover:text-ink">Members</Link>
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
        </div>
      </div>
      <main className="flex-1 overflow-hidden relative">
        {tasksQ.data && projectQ.data ? (
          <GanttChart
            ref={ganttRef}
            tasks={tasksQ.data.tasks}
            dependencies={tasksQ.data.dependencies}
            members={projectQ.data.members}
            zoom={zoom}
            projectId={params.id}
          />
        ) : (
          <div className="p-8 text-muted">Loading…</div>
        )}
      </main>
    </div>
  );
}
