import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@app/shared';
import { api, ApiException } from './api';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiException) || e.status !== 401) console.warn(e);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Ctx.Provider value={{
      user, loading,
      login: async (email, password) => {
        const r = await api.post<{ user: User }>('/auth/login', { email, password });
        setUser(r.user);
      },
      logout: async () => {
        await api.post('/auth/logout');
        setUser(null);
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
