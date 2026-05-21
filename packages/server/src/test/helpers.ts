import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { env } from '../env';
import * as schema from '../db/schema';
import { createApp } from '../app';

const TEST_URL = env.DATABASE_URL_TEST!;

export async function resetTestDb() {
  const admin = postgres(env.DATABASE_URL, { max: 1 });
  await admin`DROP DATABASE IF EXISTS gantt_test`;
  await admin`CREATE DATABASE gantt_test`;
  await admin.end();

  const sqlClient = postgres(TEST_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });
  await sqlClient`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  await sqlClient.end();
}

export async function truncateAll() {
  const c = postgres(TEST_URL, { max: 1 });
  await c`TRUNCATE task_files, task_dependencies, tasks, project_members, projects, users RESTART IDENTITY CASCADE`;
  await c.end();
}

export function makeTestApp() {
  process.env.NODE_ENV = 'test';
  return createApp();
}

export async function loginAs(app: ReturnType<typeof makeTestApp>, email: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/auth=([^;]+)/);
  if (!match) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return match[1]!;
}
