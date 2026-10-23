/**
 * Proton API client.
 *
 * Every call to the Proton API from the browser goes through `apiFetch`. It is a
 * drop-in replacement for `fetch` that:
 *
 *   1. Attaches the Proton clinical session token as a Bearer credential.
 *   2. Normalises relative `/api/...` paths against VITE_API_URL when the web and
 *      API deployments are on different origins. In development it leaves them
 *      relative so Vite's proxy is used (same-origin, no CORS surprises).
 *   3. Converts an authenticated 401 into a single `proton:session-expired` event
 *      so the shell can end the session once, instead of every panel racing to
 *      redirect.
 *
 * It does not set Content-Type: the caller owns the body encoding. It does not
 * retry: a clinician's signed action must never be silently replayed.
 */

import { API_BASE_URL } from '../config';
import { clearSessionToken, getSessionToken } from './sessionToken';

const CONFIGURED_API_ORIGIN =
  typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL.trim() !== ''
    ? API_BASE_URL
    : null;

export const SESSION_EXPIRED_EVENT = 'proton:session-expired';

export interface ApiErrorOptions {
  status: number;
  code?: string;
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;

  constructor(message: string, { status, code, body }: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!CONFIGURED_API_ORIGIN) return input;
  if (typeof input === 'string' && input.startsWith('/')) {
    return `${CONFIGURED_API_ORIGIN}${input}`;
  }
  return input;
}

function announceExpiredSession(): void {
  if (typeof window === 'undefined') return;

  clearSessionToken();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
    detail: { code: 'SESSION_EXPIRED' }
  }));
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getSessionToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(resolveApiUrl(input), {
    ...init,
    headers
  });

  // Only an authenticated request can "expire". A 401 from an unauthenticated
  // probe (health checks, public patient routes) must not end the session.
  if (response.status === 401 && token) {
    announceExpiredSession();
  }

  return response;
}

/**
 * JSON convenience wrapper for new call sites. Throws a typed ApiError so callers
 * can distinguish auth (401) from validation (4xx) from upstream failure (5xx)
 * without re-parsing OperationOutcome shapes.
 */
export async function apiJson<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init);

  let body: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    throw new ApiError(
      typeof record.error === 'string' ? record.error : `Request failed with status ${response.status}`,
      {
        status: response.status,
        code: typeof record.code === 'string' ? record.code : undefined,
        body
      }
    );
  }

  return body as T;
}

/** The Proton API's own health endpoint — useful for connectivity chips. */
export function apiHealthUrl(): string {
  return resolveApiUrl('/health') as string;
}
