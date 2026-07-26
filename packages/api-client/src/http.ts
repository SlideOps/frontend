import { ApiError, normalizeError } from './errors';

/*
 * The shared request path for every Phase 1 resource. Like the auth surface, it
 * talks to the same origin under the API base and always sends cookies, because
 * the backend keeps the Operator session in an HttpOnly cookie. Failures are
 * normalized into a typed ApiError so callers branch on one predictable shape.
 */

/**
 * Resolve the API base once per call, so a test can vary the environment.
 *
 * Two shapes are accepted, and which you use decides the deployment:
 *
 * - **A path** such as `/api/v1`, the default. The app and the API share one
 *   origin, the session cookie is same-site, and nothing else is needed. This is
 *   the ordinary deployment and the one to prefer.
 * - **An absolute URL** such as `https://api.example.com/api/v1`. The backend
 *   lives somewhere else entirely. That works, but the backend must name this
 *   app's origin in `CORS_ALLOWED_ORIGINS`, which also switches its session
 *   cookie to SameSite=None with Secure so the browser will actually send it.
 *   Both sides must be HTTPS for that cookie to be honoured.
 *
 * `VITE_API_BASE_URL` is the name to reach for; `VITE_API_BASE` is kept as an
 * alias so an existing deployment keeps working unchanged.
 */
export function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE;
  return (configured ?? '/api/v1').replace(/\/$/, '');
}

/**
 * Whether the API lives on another origin, which is true exactly when the base
 * is an absolute URL. The stream reads it to build a websocket URL that points
 * at the API rather than at wherever this page happens to be served from.
 */
export function apiIsCrossOrigin(): boolean {
  return /^https?:\/\//i.test(apiBase());
}

export interface ResourceRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
}

/** A single fetch helper: same origin, cookies included, errors normalized. */
export async function apiRequest<TResponse>(
  path: string,
  options: ResourceRequestOptions = {},
): Promise<TResponse> {
  const base = apiBase();
  const url = new URL(`${base}${path}`, resolveOrigin());
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (cause) {
    throw new ApiError(0, 'network_error', 'The network request failed.', cause);
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    throw normalizeError(response.status, parsed);
  }
  return parsed as TResponse;
}

/**
 * Unwrap the backend envelope tolerantly. The backend wraps a single resource in
 * a named key and a list in a named array, so `{ automation: {...} }` or
 * `{ automations: [...] }`. This accepts either the named key or the already bare
 * value, so a client keeps working whether or not the envelope is present.
 */
export function unwrap<T>(value: unknown, key: string): T {
  if (value !== null && typeof value === 'object' && key in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>)[key] as T;
  }
  return value as T;
}

/**
 * A base for the URL constructor. When the API base is already absolute the
 * origin is ignored; when it is a same origin path (the default `/api/v1`) the
 * browser location supplies the origin. In non browser test environments a
 * neutral placeholder keeps the URL constructor happy.
 */
function resolveOrigin(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost';
}
