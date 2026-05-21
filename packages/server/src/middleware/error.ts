import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import type { AppContext } from '../app';

export const errorHandler: ErrorHandler<AppContext> = (err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'invalid input', issues: err.issues } }, 400);
  }
  if ((err as any).status && (err as any).code) {
    const e = err as any;
    return c.json({ error: { code: e.code, message: e.message } }, e.status);
  }
  console.error('[unhandled]', err);
  return c.json({ error: { code: 'INTERNAL', message: 'internal error' } }, 500);
};

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
