import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_FORCE_PATH_STYLE: z.string().transform((v) => v === 'true').default('true'),
  MAX_UPLOAD_BYTES: z.string().transform((v) => Number(v)).default('26214400'),
  ALLOWED_CONTENT_TYPES: z.string().transform((v) => v.split(',').map((s) => s.trim())),
  PORT: z.string().transform((v) => Number(v)).default('3000'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = Env.parse(process.env);
export type AppEnv = z.infer<typeof Env>;
