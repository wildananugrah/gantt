import type { ZodSchema, z } from 'zod';
import type { Context } from 'hono';

export async function parseBody<S extends ZodSchema>(c: Context, schema: S): Promise<z.infer<S>> {
  const body = await c.req.json().catch(() => ({}));
  return schema.parse(body);
}
