import type { ApiError } from '@app/shared';

class ApiException extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.location.assign('/login');
    throw new ApiException(401, 'UNAUTHORIZED', 'session expired');
  }
  if (!res.ok) {
    const err = (data as ApiError | undefined)?.error;
    throw new ApiException(res.status, err?.code ?? 'INTERNAL', err?.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  get:    <T>(p: string) => request<T>('GET', p),
  post:   <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  patch:  <T>(p: string, body?: unknown) => request<T>('PATCH', p, body),
  delete: <T>(p: string) => request<T>('DELETE', p),
};

export { ApiException };
