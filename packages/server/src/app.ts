import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env';
import { errorHandler } from './middleware/error';
import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';

export type AppContext = {
  Variables: {
    user: { id: string; role: 'admin' | 'member' };
  };
};

export function createApp() {
  const app = new Hono<AppContext>();

  app.use('*', cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }));

  app.onError(errorHandler);

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.route('/api/auth', authRoutes);
  app.route('/api/users', usersRoutes);

  return app;
}
