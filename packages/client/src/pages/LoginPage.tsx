import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    nav({ to: '/' });
    return null;
  }

  return (
    <div className="min-h-full grid place-items-center bg-paper">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null); setBusy(true);
          try { await login(email, pw); nav({ to: '/' }); }
          catch (x: any) { setErr(x.message ?? 'login failed'); }
          finally { setBusy(false); }
        }}
        className="w-[320px] flex flex-col gap-3 p-6 border border-rule rounded-md bg-paper"
      >
        <h1 className="text-lg font-semibold">Sign in</h1>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" autoComplete="email" />
        <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password" type="password" autoComplete="current-password" />
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <Button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  );
}
