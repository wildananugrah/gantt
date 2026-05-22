import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { env } from './env';
import { errorHandler } from './middleware/error';
import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { projectsRoutes } from './routes/projects';
import { projectTasksRoutes, taskRoutes, ticketRoutes } from './routes/tasks';
import { dependencyRoutes } from './routes/dependencies';
import { taskFilesRoutes, fileRoutes } from './routes/files';
import { excalidrawRoutes } from './routes/excalidraw';
import { taskCommentsRoutes, commentRoutes } from './routes/comments';

// Port the HTTP server listens on. Sourced from .env (PORT=…), default 3000.
export const PORT: number = env.PORT;

// Allowed CORS origin (used by the cors() middleware below). Sourced from .env.
export const CLIENT_ORIGIN: string = env.CLIENT_ORIGIN;

export type AppContext = {
  Variables: {
    user: { id: string; role: 'admin' | 'member' };
  };
};

export function createApp() {
  const app = new Hono<AppContext>();

  app.use('*', cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }));

  app.onError(errorHandler);

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.route('/api/auth', authRoutes);
  app.route('/api/users', usersRoutes);
  app.route('/api/projects', projectsRoutes);
  app.route('/api/projects', projectTasksRoutes);
  app.route('/api/tasks', taskRoutes);
  app.route('/api/tasks', dependencyRoutes);
  app.route('/api/tasks', taskFilesRoutes);
  app.route('/api/tasks', excalidrawRoutes);
  app.route('/api/tasks', taskCommentsRoutes);
  app.route('/api/tickets', ticketRoutes);
  app.route('/api/files', fileRoutes);
  app.route('/api/comments', commentRoutes);

  if (env.NODE_ENV === 'production') {
    app.use('/*', serveStatic({ root: '../client/dist' }));
    app.get('*', serveStatic({ path: '../client/dist/index.html' }));
  }

  return app;
}
