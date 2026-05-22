import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { tasks, taskExcalidraw } from '../db/schema';
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

// Excalidraw payload is opaque from the server's POV; we just persist the JSON.
// Cap is generous (~4 MB serialised) but bounded so a runaway client can't fill the DB.
const PUT_BODY = z.object({
  data: z.record(z.any()),
});
const MAX_BYTES = 4 * 1024 * 1024;

export const excalidrawRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/:id/excalidraw', async (c) => {
    const taskId = c.req.param('id');
    await loadTaskAndCheckAccess(c, taskId);
    const [row] = await db.select().from(taskExcalidraw).where(eq(taskExcalidraw.taskId, taskId));
    if (!row) return c.json({ data: null, updatedAt: null, updatedBy: null });
    return c.json({ data: row.data, updatedAt: row.updatedAt, updatedBy: row.updatedBy });
  })

  .put('/:id/excalidraw', async (c) => {
    const taskId = c.req.param('id');
    const { me } = await loadTaskAndCheckAccess(c, taskId);
    const body = await parseBody(c, PUT_BODY);

    const size = JSON.stringify(body.data).length;
    if (size > MAX_BYTES) {
      throw new HttpError(409, 'CONFLICT', `whiteboard exceeds ${MAX_BYTES} bytes`);
    }

    await db.insert(taskExcalidraw)
      .values({ taskId, data: body.data, updatedBy: me.id })
      .onConflictDoUpdate({
        target: taskExcalidraw.taskId,
        set: { data: body.data, updatedBy: me.id, updatedAt: sql`now()` },
      });

    return c.json({ ok: true });
  });
