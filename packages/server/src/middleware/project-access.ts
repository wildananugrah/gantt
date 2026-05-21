import type { MiddlewareHandler } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { projectMembers, projects } from '../db/schema';
import type { AppContext } from '../app';

export function requireProjectAccess(paramName: string): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const projectId = c.req.param(paramName);
    if (!projectId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'missing project id' } }, 404);
    }
    const user = c.get('user');
    const project = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project[0]) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'project not found' } }, 404);
    }
    if (user.role === 'admin') return next();
    const m = await db.select({ uid: projectMembers.userId }).from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
      .limit(1);
    if (!m[0]) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'not a member of this project' } }, 403);
    }
    await next();
  };
}
