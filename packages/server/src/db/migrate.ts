import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../env';

const url = env.NODE_ENV === 'test' && env.DATABASE_URL_TEST
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
await migrate(db, { migrationsFolder: './src/db/migrations' });
await sql.end();
console.log('migrations applied');
