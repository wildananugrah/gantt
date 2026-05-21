import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { tasks, taskDependencies } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import { wouldCreateCycle } from '../lib/cycle-check';
import type { AppContext } from '../app';

const CreateDepBody = z.object({ predecessorId: z.string().uuid() });

export const dependencyRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .post('/:id/dependencies', async (c) => {
    const successorId = c.req.param('id');
    const { predecessorId } = await parseBody(c, CreateDepBody);

    const [succ] = await db.select().from(tasks).where(eq(tasks.id, successorId));
    const [pred] = await db.select().from(tasks).where(eq(tasks.id, predecessorId));
    if (!succ || !pred) throw new HttpError(404, 'NOT_FOUND', 'task not found');
    if (succ.projectId !== pred.projectId) {
      throw new HttpError(409, 'CONFLICT', 'tasks belong to different projects');
    }

    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(succ.projectId, me.id);

    const fetchSuccessors = async (id: string) => {
      const rows = await db.select({ s: taskDependencies.successorId })
        .from(taskDependencies)
        .where(eq(taskDependencies.predecessorId, id));
      return rows.map((r) => r.s);
    };
    if (await wouldCreateCycle(predecessorId, successorId, fetchSuccessors)) {
      throw new HttpError(409, 'CONFLICT', 'dependency would create a cycle');
    }

    await db.insert(taskDependencies).values({ predecessorId, successorId }).onConflictDoNothing();
    return c.json({ predecessorId, successorId }, 201);
  })

  .delete('/:id/dependencies/:predecessorId', async (c) => {
    const successorId = c.req.param('id');
    const predecessorId = c.req.param('predecessorId');
    const [succ] = await db.select().from(tasks).where(eq(tasks.id, successorId));
    if (!succ) throw new HttpError(404, 'NOT_FOUND', 'task not found');
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(succ.projectId, me.id);

    await db.delete(taskDependencies).where(
      and(eq(taskDependencies.predecessorId, predecessorId), eq(taskDependencies.successorId, successorId)),
    );
    return c.json({ ok: true });
  });
