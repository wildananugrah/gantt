import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ProjectWithMembers } from '@app/shared';
import { AppTopBar } from '../components/AppTopBar';

export function ProjectPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const params = useParams({ strict: false }) as { id: string };

  useEffect(() => { if (!loading && !user) nav({ to: '/login' }); }, [loading, user, nav]);

  const projectQ = useQuery({
    queryKey: ['project', params.id],
    queryFn: () => api.get<ProjectWithMembers>(`/projects/${params.id}`),
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
      </div>
      <main className="flex-1 overflow-hidden">
        <div className="p-8 text-muted text-[13px]">Gantt chart lands in Phase 7.</div>
      </main>
    </div>
  );
}
