import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { PresignUploadInput, ConfirmUploadInput } from '@app/shared';
import { db } from '../db/client';
import { tasks, taskFiles } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import { buildS3Key, presignPut, presignGet, deleteObject } from '../lib/s3';
import { env } from '../env';
import type { AppContext } from '../app';

async function loadTaskAndCheckAccess(c: any, taskId: string) {
  const [t] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'task not found');
  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(t.projectId, me.id);
  return { task: t, me };
}

export const taskFilesRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .post('/:id/files/presign', async (c) => {
    const taskId = c.req.param('id');
    await loadTaskAndCheckAccess(c, taskId);
    const body = await parseBody(c, PresignUploadInput);
    if (body.sizeBytes > env.MAX_UPLOAD_BYTES) {
      throw new HttpError(409, 'CONFLICT', `file exceeds ${env.MAX_UPLOAD_BYTES} bytes`);
    }
    if (!env.ALLOWED_CONTENT_TYPES.includes(body.contentType)) {
      throw new HttpError(409, 'CONFLICT', `content type not allowed: ${body.contentType}`);
    }
    const s3Key = buildS3Key(taskId, body.filename);
    const uploadUrl = await presignPut(s3Key, body.contentType, 300);
    return c.json({ uploadUrl, s3Key, expiresAt: new Date(Date.now() + 300_000).toISOString() });
  })

  .post('/:id/files', async (c) => {
    const taskId = c.req.param('id');
    const { me } = await loadTaskAndCheckAccess(c, taskId);
    const body = await parseBody(c, ConfirmUploadInput);
    const [row] = await db.insert(taskFiles).values({
      taskId,
      filename: body.filename,
      s3Key: body.s3Key,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      uploadedBy: me.id,
    }).returning();
    return c.json(row, 201);
  });

export const fileRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  .get('/:id/download', async (c) => {
    const id = c.req.param('id');
    const [f] = await db.select().from(taskFiles).where(eq(taskFiles.id, id));
    if (!f) throw new HttpError(404, 'NOT_FOUND', 'file not found');
    const [t] = await db.select().from(tasks).where(eq(tasks.id, f.taskId));
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(t!.projectId, me.id);
    const url = await presignGet(f.s3Key, 300);
    return c.redirect(url, 302);
  })

  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [f] = await db.select().from(taskFiles).where(eq(taskFiles.id, id));
    if (!f) throw new HttpError(404, 'NOT_FOUND', 'file not found');
    const [t] = await db.select().from(tasks).where(eq(tasks.id, f.taskId));
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(t!.projectId, me.id);
    try {
      await deleteObject(f.s3Key);
    } catch (e) {
      console.warn('[files] S3 delete failed, row removed anyway:', e);
    }
    await db.delete(taskFiles).where(eq(taskFiles.id, id));
    return c.json({ ok: true });
  });
