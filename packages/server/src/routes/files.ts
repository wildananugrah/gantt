import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { tasks, taskFiles } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import { buildS3Key, deleteObject, putObject, getObject } from '../lib/s3';
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

  // Single-step upload: multipart/form-data with field `file`.
  // Server PUTs to S3 itself so the browser never needs to reach the bucket.
  .post('/:id/files', async (c) => {
    const taskId = c.req.param('id');
    const { me } = await loadTaskAndCheckAccess(c, taskId);

    const form = await c.req.parseBody({ all: false });
    const file = form.file;
    if (!(file instanceof File)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'multipart field "file" required');
    }
    if (file.size === 0) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'file is empty');
    }
    if (file.size > env.MAX_UPLOAD_BYTES) {
      throw new HttpError(409, 'CONFLICT', `file exceeds ${env.MAX_UPLOAD_BYTES} bytes`);
    }
    const rawType = file.type || 'application/octet-stream';
    // Strip MIME params like "; charset=utf-8" before comparing to the allowlist.
    const contentType = rawType.split(';')[0]!.trim().toLowerCase();
    if (!env.ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new HttpError(409, 'CONFLICT', `content type not allowed: ${contentType}`);
    }

    const s3Key = buildS3Key(taskId, file.name);
    await putObject(s3Key, file, contentType);

    const [row] = await db.insert(taskFiles).values({
      taskId,
      filename: file.name,
      s3Key,
      contentType,
      sizeBytes: file.size,
      uploadedBy: me.id,
    }).returning();
    return c.json(row, 201);
  });

export const fileRoutes = new Hono<AppContext>()
  .use('*', requireAuth)

  // Stream-download: server fetches the object from S3 and pipes the bytes back to the client.
  .get('/:id/download', async (c) => {
    const id = c.req.param('id');
    const [f] = await db.select().from(taskFiles).where(eq(taskFiles.id, id));
    if (!f) throw new HttpError(404, 'NOT_FOUND', 'file not found');
    const [t] = await db.select().from(tasks).where(eq(tasks.id, f.taskId));
    const me = c.get('user');
    if (me.role !== 'admin') await assertProjectMember(t!.projectId, me.id);

    const upstream = await getObject(f.s3Key);
    if (!upstream.ok || !upstream.body) {
      throw new HttpError(502, 'INTERNAL', `S3 fetch failed: ${upstream.status}`);
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': f.contentType,
        'content-length': String(f.sizeBytes),
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
        'cache-control': 'private, max-age=0',
      },
    });
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
