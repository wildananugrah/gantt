import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ProjectWithMembers, User } from '@app/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AppTopBar } from '../components/AppTopBar';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

export function MembersPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const params = useParams({ strict: false }) as { id: string };
  const qc = useQueryClient();
  const [adding, setAdding] = useState('');

  useEffect(() => { if (!loading && !user) nav({ to: '/login' }); }, [loading, user, nav]);

  const projectQ = useQuery({
    queryKey: ['project', params.id],
    queryFn: () => api.get<ProjectWithMembers>(`/projects/${params.id}`),
    enabled: !!user && !!params.id,
  });
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
    enabled: user?.role === 'admin',
  });

  const add = useMutation({
    mutationFn: (userId: string) => api.post(`/projects/${params.id}/members`, { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', params.id] }),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`/projects/${params.id}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', params.id] }),
  });

  if (loading || !user) return <div className="p-8 text-muted">Loading…</div>;

  const memberIds = new Set(projectQ.data?.members.map((m) => m.id) ?? []);
  const candidates = (usersQ.data ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3">
        <h1 className="text-[14px] font-semibold">{projectQ.data?.name ?? '…'} · Members</h1>
        <Link to="/projects/$id" params={{ id: params.id }} className="text-[12px] text-muted hover:text-ink ml-auto">← Back to Gantt</Link>
      </div>
      <main className="flex-1 overflow-y-auto p-6 max-w-[600px] mx-auto w-full flex flex-col gap-4">
        <ul className="flex flex-col gap-1">
          {(projectQ.data?.members ?? []).map((m) => (
            <li key={m.id} className="flex items-center gap-3 border border-rule rounded px-3 py-2 text-[13px]">
              <span className="flex-1">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted"> · {m.email} · {m.role}</span>
              </span>
              {user?.role === 'admin' && (
                <Button variant="ghost" onClick={() => remove.mutate(m.id)}>Remove</Button>
              )}
            </li>
          ))}
          {projectQ.data?.members.length === 0 && <li className="text-[13px] text-muted">No members yet.</li>}
        </ul>
        {user?.role === 'admin' && (
          <div className="flex gap-2">
            <Select value={adding} onChange={(e) => setAdding(e.target.value)} className="flex-1">
              <option value="">+ add user…</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </Select>
            <Button
              disabled={!adding || add.isPending}
              onClick={() => { add.mutate(adding); setAdding(''); }}
            >Add</Button>
          </div>
        )}
      </main>
    </div>
  );
}
