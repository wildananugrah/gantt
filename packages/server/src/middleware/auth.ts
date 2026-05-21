import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJwt } from '../lib/jwt';
import { env } from '../env';
import type { AppContext } from '../app';

export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = getCookie(c, 'auth');
  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'missing auth cookie' } }, 401);
  }
  try {
    const payload = await verifyJwt(token, env.JWT_SECRET);
    c.set('user', { id: payload.sub, role: payload.role });
    await next();
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'invalid or expired token' } }, 401);
  }
};

export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'admin only' } }, 403);
  }
  await next();
};
