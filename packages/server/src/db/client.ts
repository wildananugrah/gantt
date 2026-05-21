import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

const url = env.NODE_ENV === 'test' && env.DATABASE_URL_TEST
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

export const queryClient = postgres(url, { max: 10 });
export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
