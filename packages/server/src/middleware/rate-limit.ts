import type { Context, MiddlewareHandler } from 'hono';

type Opts = {
  max: number;
  windowMs: number;
  keyer?: (c: Context) => string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(opts: Opts): MiddlewareHandler {
  const keyer = opts.keyer ?? ((c) => c.req.header('x-forwarded-for') ?? 'anon');
  return async (c, next) => {
    const key = keyer(c);
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    b.count += 1;
    if (b.count > opts.max) {
      return c.json({ error: { code: 'CONFLICT', message: 'too many requests' } }, 429);
    }
    return next();
  };
}
