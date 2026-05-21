import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { requireAuth, requireAdmin } from './auth';
import { signJwt } from '../lib/jwt';

const SECRET = process.env.JWT_SECRET!;

function makeApp() {
  const app = new Hono();
  app.use('/secure/*', requireAuth);
  app.get('/secure/me', (c) => c.json(c.get('user')));
  app.use('/admin/*', requireAuth, requireAdmin);
  app.get('/admin/x', (c) => c.json({ ok: true }));
  return app;
}

describe('auth middleware', () => {
  it('returns 401 with no cookie', async () => {
    const res = await makeApp().request('/secure/me');
    expect(res.status).toBe(401);
  });

  it('attaches user when cookie is valid', async () => {
    const tok = await signJwt({ sub: 'u1', role: 'member' }, SECRET, 60);
    const res = await makeApp().request('/secure/me', {
      headers: { cookie: `auth=${tok}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'u1', role: 'member' });
  });

  it('403 for non-admin on admin route', async () => {
    const tok = await signJwt({ sub: 'u1', role: 'member' }, SECRET, 60);
    const res = await makeApp().request('/admin/x', {
      headers: { cookie: `auth=${tok}` },
    });
    expect(res.status).toBe(403);
  });
});
