import { ApiError, normalizeError } from './errors';

/*
 * The shared request path for every Phase 1 resource. Like the auth surface, it
 * talks to the same origin under the API base and always sends cookies, because
 * the backend keeps the Operator session in an HttpOnly cookie. Failures are
 * normalized into a typed ApiError so callers branch on one predictable shape.
 */

/** Resolve the API base once per call so tests can vary the environment. */
export function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE;
  return (configured ?? '/api/v1').replace(/\/$/, '');
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
