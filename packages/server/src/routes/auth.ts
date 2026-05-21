import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { LoginInput, ChangePasswordInput } from '@app/shared';
import { db } from '../db/client';
import { users } from '../db/schema';
import { verifyPassword, hashPassword } from '../lib/password';
import { signJwt } from '../lib/jwt';
import { env } from '../env';
import { parseBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { HttpError } from '../middleware/error';
import type { AppContext } from '../app';

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export const authRoutes = new Hono<AppContext>()

  .post('/login', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), async (c) => {
    const { email, password } = await parseBody(c, LoginInput);
    const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = row[0];
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'UNAUTHORIZED', 'invalid credentials');
    }
    const token = await signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, SEVEN_DAYS);
    setCookie(c, 'auth', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: SEVEN_DAYS,
    });
    return c.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt,
      },
    });
  })

  .post('/logout', async (c) => {
    deleteCookie(c, 'auth', { path: '/' });
    return c.json({ ok: true });
  })

  .get('/me', requireAuth, async (c) => {
    const u = c.get('user');
    const row = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
    if (!row[0]) throw new HttpError(401, 'UNAUTHORIZED', 'user not found');
    const user = row[0];
    return c.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt,
      },
    });
  })

  .post('/change-password', requireAuth, async (c) => {
    const { currentPassword, newPassword } = await parseBody(c, ChangePasswordInput);
    const me = c.get('user');
    const row = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
    if (!row[0]) throw new HttpError(401, 'UNAUTHORIZED', 'user not found');
    if (!(await verifyPassword(currentPassword, row[0].passwordHash))) {
      throw new HttpError(401, 'UNAUTHORIZED', 'current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new HttpError(409, 'CONFLICT', 'new password must differ from current');
    }
    const hash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, me.id));
    return c.json({ ok: true });
  });
