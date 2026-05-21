import { AwsClient } from 'aws4fetch';
import { env } from '../env';

const client = new AwsClient({
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  region: env.S3_REGION,
  service: 's3',
});

function objectUrl(key: string): string {
  if (env.S3_FORCE_PATH_STYLE) {
    return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }
  return `${env.S3_ENDPOINT.replace('://', `://${env.S3_BUCKET}.`)}/${key}`;
}

export function buildS3Key(taskId: string, originalFilename: string): string {
  const sanitized = originalFilename.replace(/[^A-Za-z0-9._-]/g, '_');
  return `tasks/${taskId}/${crypto.randomUUID()}-${sanitized}`;
}

export async function presignPut(key: string, contentType: string, ttlSeconds: number): Promise<string> {
  const url = `${objectUrl(key)}?X-Amz-Expires=${ttlSeconds}`;
  const req = await client.sign(url, {
    method: 'PUT',
    aws: { signQuery: true },
    headers: { 'content-type': contentType },
  });
  return req.url;
}

export async function presignGet(key: string, ttlSeconds: number): Promise<string> {
  const url = `${objectUrl(key)}?X-Amz-Expires=${ttlSeconds}`;
  const req = await client.sign(url, { method: 'GET', aws: { signQuery: true } });
  return req.url;
}

export async function deleteObject(key: string): Promise<void> {
  const res = await client.fetch(objectUrl(key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`S3 delete failed: ${res.status}`);
  }
}

/** Server-side PUT to S3. Used when the browser cannot reach S3 directly. */
export async function putObject(key: string, body: Blob | ArrayBuffer | ReadableStream, contentType: string): Promise<void> {
  const res = await client.fetch(objectUrl(key), {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: body as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`S3 put failed: ${res.status} ${text}`);
  }
}

/** Server-side GET from S3. Returns the upstream Response so the caller can stream it. */
export async function getObject(key: string): Promise<Response> {
  return client.fetch(objectUrl(key), { method: 'GET' });
}
