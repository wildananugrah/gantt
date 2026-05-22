import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { User } from '@app/shared';
import { api, ApiException } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AppTopBar } from '../components/AppTopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';

export function ProfilePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => { if (!loading && !user) nav({ to: '/login' }); }, [loading, user, nav]);

  if (loading || !user) return <div className="p-8 text-muted">Loading…</div>;

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4">
        <h1 className="text-[14px] font-semibold">Profile</h1>
      </div>
      <main className="flex-1 overflow-y-auto p-6 max-w-[520px] mx-auto w-full flex flex-col gap-8">
        <ProfileForm user={user} />
        <PasswordForm />
      </main>
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.patch<User>(`/users/${user.id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      // refresh /auth/me so the topbar reflects the new name
      qc.invalidateQueries({ queryKey: ['me'] });
      setOkMsg('Profile saved.');
      setErr(null);
    },
    onError: (e) => {
      setOkMsg(null);
      setErr(e instanceof ApiException ? e.message : 'save failed');
    },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setOkMsg(null); setErr(null); save.mutate(); }}
      className="flex flex-col gap-3 border border-rule rounded-md p-5"
    >
      <h2 className="text-[13px] uppercase tracking-wider text-muted">Profile</h2>
      <Field label="Email"><Input value={user.email} disabled /></Field>
      <Field label="Role"><Input value={user.role} disabled /></Field>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={120} />
      </Field>
      {okMsg && <p className="text-[12px] text-emerald-700">{okMsg}</p>}
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={save.isPending || name === user.name}>
          {save.isPending ? 'Saving…' : 'Save name'}
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      setOkMsg('Password changed.');
      setErr(null);
      setCurrent(''); setNew(''); setConfirm('');
    },
    onError: (e) => {
      setOkMsg(null);
      setErr(e instanceof ApiException ? e.message : 'change failed');
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    if (newPassword !== confirm) {
      setErr('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setErr('New password must be at least 8 characters.');
      return;
    }
    change.mutate();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border border-rule rounded-md p-5">
      <h2 className="text-[13px] uppercase tracking-wider text-muted">Change password</h2>
      <Field label="Current password">
        <PasswordInput autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="New password (min 8)">
        <PasswordInput autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} required minLength={8} />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      </Field>
      {okMsg && <p className="text-[12px] text-emerald-700">{okMsg}</p>}
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={change.isPending || !currentPassword || !newPassword || !confirm}>
          {change.isPending ? 'Updating…' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
