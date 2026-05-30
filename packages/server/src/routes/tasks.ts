import { Hono } from 'hono';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from '@app/shared';
import { db } from '../db/client';
import { tasks, taskDependencies, taskFiles, projects, projectMembers } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireProjectAccess } from '../middleware/project-access';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import { validateMoveTask } from '../lib/move-task';
import type { AppContext } from '../app';

export const projectTasksRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/:projectId/tasks', requireProjectAccess('projectId'), async (c) => {
    const projectId = c.req.param('projectId');
    const ts = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    const ids = ts.map((t) => t.id);
    const deps = ids.length === 0
      ? []
      : await db.select().from(taskDependencies).where(inArray(taskDependencies.successorId, ids));
    return c.json({ tasks: ts, dependencies: deps });
  })

  .post('/:projectId/tasks', requireProjectAccess('projectId'), async (c) => {
    const projectId = c.req.param('projectId');
    const body = await parseBody(c, CreateTaskInput);
    if (body.picUserId) await assertProjectMember(projectId, body.picUserId);
    const [t] = await db.insert(tasks).values({
      projectId,
      title: body.title,
      description: body.description ?? null,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      picUserId: body.picUserId ?? null,
      sortOrder: body.sortOrder ?? 0,
    }).returning();
    return c.json(t, 201);
  })

  .post('/:projectId/tasks/reorder', requireProjectAccess('projectId'), async (c) => {
    const projectId = c.req.param('projectId');
    const { taskIds } = await parseBody(c, z.object({ taskIds: z.array(z.string().uuid()).min(1) }));
    // Verify all IDs belong to this project — refuse if any are foreign
    const rows = await db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, taskIds)));
    if (rows.length !== taskIds.length) {
      throw new HttpError(409, 'CONFLICT', 'reorder list contains tasks not in this project');
    }
    await db.transaction(async (tx) => {
      for (let i = 0; i < taskIds.length; i++) {
        await tx.update(tasks)
          .set({ sortOrder: i, updatedAt: sql`now()` as any })
          .where(eq(tasks.id, taskIds[i]!));
      }
    });
    return c.json({ ok: true });
  });

export const ticketRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/:ticket', async (c) => {
    const ticket = c.req.param('ticket');
    if (!/^[a-z0-9]{10}$/.test(ticket)) {
      throw new HttpError(404, 'NOT_FOUND', 'ticket not found');
    }
    const [t] = await db.select().from(tasks).where(eq(tasks.ticketNumber, ticket));
    if (!t) throw new HttpError(404, 'NOT_FOUND', 'ticket not found');
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(t.projectId, me.id);
    const files = await db.select().from(taskFiles).where(eq(taskFiles.taskId, t.id));
    const deps = await db.select().from(taskDependencies).where(eq(taskDependencies.successorId, t.id));
    return c.json({ ...t, files, dependencies: deps });
  });

export const taskRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!t) throw new HttpError(404, 'NOT_FOUND', 'task not found');
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(t.projectId, me.id);
    const files = await db.select().from(taskFiles).where(eq(taskFiles.taskId, id));
    const deps = await db.select().from(taskDependencies).where(eq(taskDependencies.successorId, id));
    return c.json({ ...t, files, dependencies: deps });
  })

  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await parseBody(c, UpdateTaskInput);
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'task not found');
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(existing.projectId, me.id);
    if (body.picUserId) await assertProjectMember(existing.projectId, body.picUserId);
    const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: sql`now()` as any };
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.startDate !== undefined) patch.startDate = body.startDate;
    if (body.endDate !== undefined) patch.endDate = body.endDate;
    if (body.status !== undefined) patch.status = body.status;
    if (body.picUserId !== undefined) patch.picUserId = body.picUserId;
    if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
    const [t] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
    return c.json(t);
  })

  .post('/:id/move', async (c) => {
    const id = c.req.param('id');
    const body = await parseBody(c, MoveTaskInput);
    const me = c.get('user');

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'task not found');

    // Source-side access: same rule as PATCH.
    if (me.role !== 'admin') await assertProjectMember(existing.projectId, me.id);

    // Gather inputs for the validator.
    const [destProject] = await db.select({ id: projects.id })
      .from(projects).where(eq(projects.id, body.targetProjectId)).limit(1);

    const [requesterInDest] = await db.select({ uid: projectMembers.userId })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, body.targetProjectId),
        eq(projectMembers.userId, me.id),
      )).limit(1);

    const depsRows = await db.select({ p: taskDependencies.predecessorId })
      .from(taskDependencies)
      .where(or(
        eq(taskDependencies.predecessorId, id),
        eq(taskDependencies.successorId, id),
      )).limit(1);

    let picInDest = true;
    if (existing.picUserId) {
      const [picRow] = await db.select({ uid: projectMembers.userId })
        .from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, body.targetProjectId),
          eq(projectMembers.userId, existing.picUserId),
        )).limit(1);
      picInDest = !!picRow;
    }

    const decision = validateMoveTask({
      task: { id: existing.id, projectId: existing.projectId, picUserId: existing.picUserId },
      targetProjectId: body.targetProjectId,
      requester: { id: me.id, role: me.role },
      destinationExists: !!destProject,
      requesterInDestination: !!requesterInDest,
      dependencyCount: depsRows.length,
      picInDestination: picInDest,
    });
    if (!decision.ok) throw new HttpError(decision.status, decision.code, decision.message);

    const updated = await db.transaction(async (tx) => {
      const [maxRow] = await tx
        .select({ m: sql<number | null>`max(${tasks.sortOrder})` })
        .from(tasks)
        .where(eq(tasks.projectId, body.targetProjectId));
      const nextSort = (maxRow?.m ?? -1) + 1;
      const [t] = await tx.update(tasks).set({
        projectId: body.targetProjectId,
        sortOrder: nextSort,
        updatedAt: sql`now()` as any,
      }).where(eq(tasks.id, id)).returning();
      return t;
    });
    return c.json(updated);
  })

  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'task not found');
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(existing.projectId, me.id);
    await db.delete(tasks).where(eq(tasks.id, id));
    return c.json({ ok: true });
  });
