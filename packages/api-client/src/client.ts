import { ApiError, normalizeError } from './errors';

export interface ApiClientOptions {
  /** Base URL of the backend API, for example https://api.slideops.com. */
  baseUrl: string;
  /** Returns the current auth token, or null when the Operator is signed out. */
  getToken?: () => string | null | undefined;
  /** Called when a request returns 401 so the app can route to sign in. */
  onUnauthorized?: () => void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * A small typed fetch wrapper. It attaches the auth header, sends and parses
 * JSON, and normalizes every failure into an ApiError. This is the only thing
 * in the frontend that talks to the backend over HTTP.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken?: () => string | null | undefined;
  private readonly onUnauthorized?: () => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getToken = options.getToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  async request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.getToken?.();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (cause) {
      throw new ApiError(0, 'network_error', 'The network request failed.', cause);
    }

    if (response.status === 401) {
      this.onUnauthorized?.();
    }

    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      throw normalizeError(response.status, parsed);
    }
    return parsed as TResponse;
  }

  get<TResponse>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<TResponse>(path, { ...options, method: 'GET' });
  }

  post<TResponse>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) {
    return this.request<TResponse>(path, { ...options, method: 'POST', body });
  }
}
