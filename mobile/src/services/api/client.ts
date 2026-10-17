import { errorMessage } from './errorMessages';

export class ApiError extends Error {
  constructor(public code: string, public status = 0, public details: Record<string, unknown> = {}) {
    super(status === 0 ? 'Could not reach your server. Check your connection and server address, then retry.' : errorMessage(code));
  }
}
export function normalizeServer(value: string) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Enter an http:// or https:// server address without credentials, queries or fragments.');
  return url.toString().replace(/\/+$/, '');
}
export function createClient(server: string, token?: string, unauthorized?: () => Promise<void>) {
  async function request<T>(path: string, method = 'GET', body?: unknown, binary = false): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${server}/api/v1${path}`, { method, signal: controller.signal,
        headers: { Accept: binary ? 'application/pdf' : 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 && token) await unauthorized?.();
        throw new ApiError(payload.error?.code || 'SERVICE_UNAVAILABLE', response.status, payload.error?.details);
      }
      return (binary ? await response.blob() : await response.json()) as T;
    } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('NETWORK_ERROR'); }
    finally { clearTimeout(timer); }
  }
  async function list<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await request<{ data: T[]; total: number }>(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`);
      if (!Array.isArray(page.data) || !Number.isInteger(page.total)) throw new ApiError('SERVICE_UNAVAILABLE', 502);
      items.push(...page.data);
      if (items.length >= page.total || page.data.length === 0) return items;
    }
  }
  return { request, list };
}
export type Client = ReturnType<typeof createClient>;
