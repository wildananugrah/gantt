import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { CreateProjectInput, UpdateProjectInput } from '@app/shared';
import { db } from '../db/client';
import { projects, projectMembers, users } from '../db/schema';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { requireProjectAccess } from '../middleware/project-access';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import type { AppContext } from '../app';

export const projectsRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/', async (c) => {
    const me = c.get('user');
    if (me.role === 'admin') {
      return c.json(await db.select().from(projects));
    }
    const rows = await db
      .select({ p: projects })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, me.id));
    return c.json(rows.map((r) => r.p));
  })

  .post('/', requireAdmin, async (c) => {
    const body = await parseBody(c, CreateProjectInput);
    const me = c.get('user');
    const [p] = await db.insert(projects).values({
      name: body.name,
      description: body.description ?? null,
      createdBy: me.id,
    }).returning();
    return c.json(p, 201);
  })

  .get('/:id', requireProjectAccess('id'), async (c) => {
    const id = c.req.param('id');
    const [p] = await db.select().from(projects).where(eq(projects.id, id));
    if (!p) throw new HttpError(404, 'NOT_FOUND', 'project not found');
    const members = await db
      .select({
        id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, id));
    return c.json({ ...p, members });
  })

  .patch('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const body = await parseBody(c, UpdateProjectInput);
    const [p] = await db.update(projects)
      .set({ ...body, updatedAt: sql`now()` })
      .where(eq(projects.id, id))
      .returning();
    if (!p) throw new HttpError(404, 'NOT_FOUND', 'project not found');
    return c.json(p);
  })

  .delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    await db.delete(projects).where(eq(projects.id, id));
    return c.json({ ok: true });
  })

  .post('/:id/members', requireAdmin, async (c) => {
    const projectId = c.req.param('id');
    const body = await c.req.json() as { userId?: string };
    if (!body.userId) throw new HttpError(400, 'VALIDATION_ERROR', 'userId required');
    await db.insert(projectMembers).values({ projectId, userId: body.userId }).onConflictDoNothing();
    return c.json({ ok: true });
  })

  .delete('/:id/members/:userId', requireAdmin, async (c) => {
    const projectId = c.req.param('id');
    const userId = c.req.param('userId');
    await db.delete(projectMembers).where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    );
    return c.json({ ok: true });
  });
