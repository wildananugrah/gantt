import { db } from '../db/client';
import { users } from '../db/schema';
import { env } from '../env';
import { hashPassword } from './password';
import { sql } from 'drizzle-orm';

export async function ensureBootstrapAdmin(): Promise<void> {
  const row = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  const count = row[0]?.c ?? 0;
  if (count > 0) return;

  const hash = await hashPassword(env.ADMIN_PASSWORD);
  await db.insert(users).values({
    email: env.ADMIN_EMAIL,
    passwordHash: hash,
    name: 'Admin',
    role: 'admin',
  });

  console.log(`[bootstrap] created admin user: ${env.ADMIN_EMAIL}`);
}
