import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { projectMembers } from '../db/schema';
import { HttpError } from '../middleware/error';

export async function assertProjectMember(projectId: string, userId: string): Promise<void> {
  const r = await db.select({ uid: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  if (!r[0]) throw new HttpError(409, 'CONFLICT', 'PIC is not a project member');
}
