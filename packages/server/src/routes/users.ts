import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { CreateUserInput, UpdateUserInput } from '@app/shared';
import { db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from '../lib/password';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { parseBody } from '../middleware/validate';
import type { AppContext } from '../app';

export const usersRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/', async (c) => {
    const rows = await db.select({
      id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
    }).from(users);
    return c.json(rows);
  })

  .post('/', requireAdmin, async (c) => {
    const body = await parseBody(c, CreateUserInput);
    const hash = await hashPassword(body.password);
    try {
      const [u] = await db.insert(users).values({
        email: body.email, passwordHash: hash, name: body.name, role: body.role,
      }).returning({
        id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
      });
      return c.json(u, 201);
    } catch (e: any) {
      if (String(e).includes('users_email_unique') || e?.code === '23505') {
        throw new HttpError(409, 'CONFLICT', 'email already in use');
      }
      throw e;
    }
  })

  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    const me = c.get('user');
    const body = await parseBody(c, UpdateUserInput);
    if (me.role !== 'admin') {
      if (me.id !== id) throw new HttpError(403, 'FORBIDDEN', 'cannot edit another user');
      if (body.role) throw new HttpError(403, 'FORBIDDEN', 'cannot change own role');
    }
    const patch: Partial<typeof users.$inferInsert> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.role !== undefined) patch.role = body.role;
    if (body.password !== undefined) patch.passwordHash = await hashPassword(body.password);
    const [u] = await db.update(users).set(patch).where(eq(users.id, id)).returning({
      id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
    });
    if (!u) throw new HttpError(404, 'NOT_FOUND', 'user not found');
    return c.json(u);
  })

  .delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const me = c.get('user');
    if (me.id === id) throw new HttpError(409, 'CONFLICT', 'cannot delete self');
    await db.delete(users).where(eq(users.id, id));
    return c.json({ ok: true });
  });
