import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function RegisterPage() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
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
          setErr(null);
          if (pw !== confirm) { setErr('Passwords do not match.'); return; }
          if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
          setBusy(true);
          try { await register(name, email, pw); nav({ to: '/' }); }
          catch (x: any) { setErr(x.message ?? 'registration failed'); }
          finally { setBusy(false); }
        }}
        className="w-[340px] flex flex-col gap-3 p-6 border border-rule rounded-md bg-paper"
      >
        <h1 className="text-lg font-semibold">Create an account</h1>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="full name" autoComplete="name" required minLength={1} maxLength={120} />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" autoComplete="email" required />
        <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password (min 8)" type="password" autoComplete="new-password" required minLength={8} />
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="confirm password" type="password" autoComplete="new-password" required minLength={8} />
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <Button disabled={busy} type="submit">{busy ? 'Creating account…' : 'Create account'}</Button>
        <p className="text-[12px] text-muted text-center mt-1">
          Already have an account?{' '}
          <Link to="/login" className="text-ink hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
