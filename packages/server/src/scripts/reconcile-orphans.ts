import { AwsClient } from 'aws4fetch';
import { db } from '../db/client';
import { taskFiles } from '../db/schema';
import { env } from '../env';

const client = new AwsClient({
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  region: env.S3_REGION,
  service: 's3',
});

const ROOT = env.S3_FORCE_PATH_STYLE
  ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`
  : env.S3_ENDPOINT.replace('://', `://${env.S3_BUCKET}.`);

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(`${ROOT}/?list-type=2&prefix=${encodeURIComponent(prefix)}`);
    if (token) url.searchParams.set('continuation-token', token);
    const res = await client.fetch(url.toString());
    const xml = await res.text();
    const matches = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)];
    for (const m of matches) keys.push(m[1]!);
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1];
  } while (token);
  return keys;
}

const known = new Set((await db.select({ k: taskFiles.s3Key }).from(taskFiles)).map((r) => r.k));
const found = await listKeys('tasks/');
const orphans = found.filter((k) => !known.has(k));
console.log(`Found ${found.length} keys; ${orphans.length} orphans`);

for (const k of orphans) {
  await client.fetch(`${ROOT}/${encodeURIComponent(k).replace(/%2F/g, '/')}`, { method: 'DELETE' });
  console.log(`deleted ${k}`);
}
console.log('done');
process.exit(0);
