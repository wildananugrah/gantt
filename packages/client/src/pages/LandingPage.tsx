import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Project } from '@app/shared';
import { AppTopBar } from '../components/AppTopBar';

export function LandingPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: '/login' });
  }, [loading, user, nav]);

  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!user,
  });

  useEffect(() => {
    if (data && data.length > 0) nav({ to: '/projects/$id', params: { id: data[0]!.id } });
  }, [data, nav]);

  if (loading || !user) return <div className="p-8 text-muted">Loading…</div>;
  if (!data) return <div className="p-8 text-muted">Loading…</div>;
  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <AppTopBar />
        <div className="p-8 max-w-md mx-auto text-center mt-12">
          <h2 className="text-base font-semibold mb-2">No projects yet</h2>
          <p className="text-muted text-[13px]">
            {user.role === 'admin'
              ? 'Use the project switcher in the top bar to create your first project.'
              : 'Ask an admin to add you to a project.'}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
