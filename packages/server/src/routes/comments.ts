import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { CreateCommentInput, UpdateCommentInput } from '@app/shared';
import { db } from '../db/client';
import { tasks, taskComments, users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import type { AppContext } from '../app';

async function loadTaskAndCheckAccess(c: any, taskId: string) {
  const [t] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'task not found');
  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(t.projectId, me.id);
  return { task: t, me };
}

function shape(row: {
  id: string; taskId: string; authorId: string | null;
  authorName: string | null; body: string; createdAt: string | Date; updatedAt: string | Date;
}) {
  const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt;
  return {
    id: row.id,
    taskId: row.taskId,
    authorId: row.authorId,
    authorName: row.authorName ?? '(deleted user)',
    body: row.body,
    createdAt,
    updatedAt,
    edited: createdAt !== updatedAt,
  };
}

// Routes mounted under /api/tasks/:id/comments and /api/comments/:id
export const taskCommentsRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/:id/comments', async (c) => {
    const taskId = c.req.param('id');
    await loadTaskAndCheckAccess(c, taskId);
    const rows = await db
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        authorId: taskComments.authorId,
        authorName: users.name,
        body: taskComments.body,
        createdAt: taskComments.createdAt,
        updatedAt: taskComments.updatedAt,
      })
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorId))
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt);
    return c.json(rows.map(shape));
  })

  .post('/:id/comments', async (c) => {
    const taskId = c.req.param('id');
    const { me } = await loadTaskAndCheckAccess(c, taskId);
    const { body } = await parseBody(c, CreateCommentInput);
    const [inserted] = await db.insert(taskComments).values({
      taskId,
      authorId: me.id,
      body: body.trim(),
    }).returning();
    // Join author name for response
    const [author] = await db.select({ name: users.name }).from(users).where(eq(users.id, me.id));
    return c.json(shape({ ...inserted!, authorName: author?.name ?? '(deleted user)' }), 201);
  });

export const commentRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    const { body } = await parseBody(c, UpdateCommentInput);
    const [existing] = await db.select().from(taskComments).where(eq(taskComments.id, id));
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'comment not found');
    const me = c.get('user');
    if (existing.authorId !== me.id) {
      throw new HttpError(403, 'FORBIDDEN', 'only the author can edit this comment');
    }
    const [updated] = await db.update(taskComments)
      .set({ body: body.trim(), updatedAt: sql`now()` as any })
      .where(eq(taskComments.id, id))
      .returning();
    const [author] = await db.select({ name: users.name }).from(users).where(eq(users.id, me.id));
    return c.json(shape({ ...updated!, authorName: author?.name ?? '(deleted user)' }));
  })

  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(taskComments).where(eq(taskComments.id, id));
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'comment not found');
    const me = c.get('user');
    if (existing.authorId !== me.id && me.role !== 'admin') {
      throw new HttpError(403, 'FORBIDDEN', 'only the author or an admin can delete this comment');
    }
    await db.delete(taskComments).where(eq(taskComments.id, id));
    return c.json({ ok: true });
  });
