import { ApiError, normalizeError } from './errors';
import { apiBase } from './http';
import type { Operator } from './types';

/*
 * The typed authentication surface. Every request goes to the same origin under
 * the API base and sends cookies, because the backend keeps the session in an
 * HttpOnly cookie. The frontend therefore never reads or stores a token itself:
 * it relies on the cookie and on the `me` endpoints to know if it is signed in.
 */

interface AuthRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

/** A single fetch helper: same origin, cookies included, errors normalized. */
async function authRequest<TResponse>(
  path: string,
  options: AuthRequestOptions = {},
): Promise<TResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
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

export interface Credentials {
  email: string;
  password: string;
}

/** The one-time proof of MFA setup: the shared secret and its otpauth URL. */
export interface MfaSetup {
  secret: string;
  otpauth_url: string;
}

/**
 * The result of a sign in attempt. Either the caller is now authenticated, or
 * the account has MFA enabled and must complete a challenge before the session
 * is granted.
 */
export type LoginResult =
  { kind: 'authenticated'; operator: Operator } | { kind: 'mfa_required'; challenge: string };

interface OperatorEnvelope {
  operator?: Operator;
  mfa_required?: boolean;
  challenge?: string;
}

/* Operator endpoints. */

/** Register a new Operator. On success the caller is signed in. */
export async function register(input: Credentials): Promise<Operator> {
  const data = await authRequest<OperatorEnvelope>('/auth/register', {
    method: 'POST',
    body: input,
  });
  if (!data.operator) {
    throw new ApiError(200, 'unexpected_response', 'The sign up response was not understood.');
  }
  return data.operator;
}

/** Sign in an Operator. Returns a discriminated result so the caller can branch on MFA. */
export async function login(input: Credentials): Promise<LoginResult> {
  const data = await authRequest<OperatorEnvelope>('/auth/login', {
    method: 'POST',
    body: input,
  });
  if (data.mfa_required && typeof data.challenge === 'string') {
    return { kind: 'mfa_required', challenge: data.challenge };
  }
  if (data.operator) {
    return { kind: 'authenticated', operator: data.operator };
  }
  throw new ApiError(200, 'unexpected_response', 'The sign in response was not understood.');
}

/** Complete an Operator MFA challenge with the code from the authenticator app. */
export async function mfaVerify(input: { challenge: string; code: string }): Promise<Operator> {
  const data = await authRequest<OperatorEnvelope>('/auth/mfa/verify', {
    method: 'POST',
    body: input,
  });
  if (!data.operator) {
    throw new ApiError(200, 'unexpected_response', 'The verification response was not understood.');
  }
  return data.operator;
}

/** Sign the Operator out. Clears the session cookie on the backend. */
export async function logout(): Promise<void> {
  await authRequest<void>('/auth/logout', { method: 'POST' });
}

/** Read the current Operator session, or throw a 401 ApiError when signed out. */
export async function me(): Promise<Operator> {
  const data = await authRequest<OperatorEnvelope>('/auth/me');
  if (!data.operator) {
    throw new ApiError(200, 'unexpected_response', 'The session response was not understood.');
  }
  return data.operator;
}

/** Begin MFA setup. Returns the shared secret and otpauth URL to show the Operator. */
export async function mfaSetup(): Promise<MfaSetup> {
  return authRequest<MfaSetup>('/auth/mfa/setup', { method: 'POST' });
}

/** Enable MFA by confirming a code generated from the new secret. */
export async function mfaEnable(input: { code: string }): Promise<Operator> {
  const data = await authRequest<OperatorEnvelope>('/auth/mfa/enable', {
    method: 'POST',
    body: input,
  });
  if (!data.operator) {
    throw new ApiError(200, 'unexpected_response', 'The response was not understood.');
  }
  return data.operator;
}

/** Disable MFA. The Operator re-enters the password to confirm. */
export async function mfaDisable(input: { password: string }): Promise<Operator> {
  const data = await authRequest<OperatorEnvelope>('/auth/mfa/disable', {
    method: 'POST',
    body: input,
  });
  if (!data.operator) {
    throw new ApiError(200, 'unexpected_response', 'The response was not understood.');
  }
  return data.operator;
}

/**
 * Which ways in this deployment offers. `password` is always true; `github` is
 * true only when the backend has a GitHub OAuth app configured.
 *
 * A sign in screen reads it so it shows the options that will actually work,
 * rather than a GitHub button that could only ever fail. It needs no session,
 * which is the point: a caller asking has none yet.
 */
export interface AuthProviders {
  password: boolean;
  github: boolean;
}

/**
 * Read which sign in methods are available on this deployment. It never throws
 * for a caller that just wants to render a screen: a failure resolves to password
 * only, so the sign in form always works even if this call does not.
 */
export function getAuthProviders(signal?: AbortSignal): Promise<AuthProviders> {
  return authRequest<AuthProviders>('/auth/providers', { signal }).catch(() => ({
    password: true,
    github: false,
  }));
}

/**
 * The URL that starts signing in with GitHub. Navigate the browser to it: do
 * not fetch it, since the response is a redirect to github.com and the whole
 * round trip is a top-level navigation that ends with a session cookie being set.
 *
 * `returnPath` is where to land afterwards; it must be an in-app path beginning
 * with `/app/`, which the backend enforces so this can never become an open
 * redirect.
 */
export function githubSignInUrl(returnPath?: string): string {
  const base = `${apiBase()}/auth/github/authorize`;
  return returnPath ? `${base}?return=${encodeURIComponent(returnPath)}` : base;
}
