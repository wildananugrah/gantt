import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { User } from '@app/shared';
import { api, ApiException } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AppTopBar } from '../components/AppTopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Dialog } from '../components/ui/Dialog';

export function UsersAdminPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: '/login' }); }, [loading, user, nav]);

  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  if (loading || !user) return <div className="p-8 text-muted">Loading…</div>;
  if (user.role !== 'admin') {
    return (
      <div className="h-full flex flex-col">
        <AppTopBar />
        <div className="p-8 text-muted">Admin only.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3">
        <h1 className="text-[14px] font-semibold">Users</h1>
        <Button onClick={() => setOpen(true)} className="ml-auto">+ Add user</Button>
      </div>
      <main className="flex-1 overflow-y-auto p-6 max-w-[700px] mx-auto w-full">
        <ul className="flex flex-col gap-1">
          {(usersQ.data ?? []).map((u) => (
            <li key={u.id} className="flex items-center gap-3 border border-rule rounded px-3 py-2 text-[13px]">
              <span className="flex-1">
                <span className="font-medium">{u.name}</span>
                <span className="text-muted"> · {u.email}</span>
              </span>
              <span className="text-[11px] text-muted uppercase tracking-wider">{u.role}</span>
              {u.id !== user.id && (
                <Button
                  variant="ghost"
                  onClick={() => { if (confirm(`Delete user ${u.email}?`)) del.mutate(u.id); }}
                >Delete</Button>
              )}
            </li>
          ))}
        </ul>
      </main>
      <NewUserDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<User>('/users', { email, name, password, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEmail(''); setName(''); setPassword(''); setRole('member');
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Add user">
      <form
        onSubmit={(e) => { e.preventDefault(); setErr(null); create.mutate(); }}
        className="flex flex-col gap-3"
      >
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input placeholder="email@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input placeholder="Password (min 8)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}
