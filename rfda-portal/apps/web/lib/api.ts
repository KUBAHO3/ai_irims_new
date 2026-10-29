import type { Issue } from '@rfda/shared';

export class ApiError extends Error {
  constructor(message: string, public status: number, public issues?: Issue[]) { super(message); }
}

/** Calls the NestJS API through the /api proxy. `body` may be JSON-able or FormData. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join(' ') : data.message || `Request failed (${res.status})`;
    throw new ApiError(res.status === 413 ? 'The file is too large to upload.' : msg, res.status, data.issues);
  }
  return data as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);
export const fileUrl = (id: string, inline = true) => `/api/files/${id}${inline ? '?inline=1' : ''}`;
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');
